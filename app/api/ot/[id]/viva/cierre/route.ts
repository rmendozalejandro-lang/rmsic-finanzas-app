import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CierreDraft = {
  diagnostico: string
  causa_probable: string
  trabajo_realizado: string
  hallazgos: string
  resultado_servicio: string
  conclusiones_tecnicas: string
  recomendaciones: string
  observaciones_cierre: string
  pendientes: string
}

type Body = {
  accion?: 'generar' | 'aplicar'
  borrador?: Partial<CierreDraft>
  evidenciasSeleccionadas?: string[]
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status = 500) {
  return jsonResponse({ error: message }, status)
}

function extraerTextoRespuesta(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text.trim()
  if (!Array.isArray(data?.output)) return ''

  return data.output
    .flatMap((item: any) => item?.content || [])
    .map((content: any) => {
      if (typeof content?.text === 'string') return content.text
      if (typeof content?.content === 'string') return content.content
      return ''
    })
    .join('\n')
    .trim()
}

function limpiarJson(texto: string) {
  return texto
    .trim()
    .replace(/^\`\`\`json\s*/i, '')
    .replace(/^\`\`\`\s*/i, '')
    .replace(/\s*\`\`\`$/, '')
    .trim()
}

function textoSeguro(value: unknown, max = 12000) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function tipoOtEvidencia(tipoUso: string | null | undefined) {
  if (tipoUso === 'antes') return 'antes'
  if (tipoUso === 'despues') return 'despues'
  if (tipoUso === 'contexto') return 'otro'
  if (tipoUso === 'validacion') return 'despues'
  return 'durante'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: otId } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const openAiKey = process.env.OPENAI_API_KEY
    const openAiModel = process.env.OPENAI_MODEL || 'gpt-5.5'

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonError('Faltan variables de entorno Supabase.', 500)
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) return jsonError('No autorizado.', 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) return jsonError('Sesión no válida.', 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const otResp = await admin
      .from('ot_ordenes_trabajo')
      .select('id,empresa_id,cliente_id,folio,titulo,descripcion_solicitud,diagnostico,causa_probable,trabajo_realizado,hallazgos,resultado_servicio,conclusiones_tecnicas,recomendaciones,observaciones_cierre,hora_inicio,hora_termino')
      .eq('id', otId)
      .maybeSingle()

    if (otResp.error) return jsonError(otResp.error.message, 500)
    if (!otResp.data) return jsonError('No se encontró la OT.', 404)

    const ot = otResp.data

    const accesoResp = await admin
      .from('usuario_empresas')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', ot.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (accesoResp.error || !accesoResp.data) {
      return jsonError('No tienes acceso a la empresa de esta OT.', 403)
    }

    const body = (await request.json()) as Body
    const accion = body.accion || 'generar'

    const linkResp = await admin
      .from('asistente_caso_ots')
      .select('caso_id')
      .eq('empresa_id', ot.empresa_id)
      .eq('ot_id', ot.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (linkResp.error) return jsonError(linkResp.error.message, 500)
    if (!linkResp.data?.caso_id) return jsonError('Esta OT no tiene OT Viva asociada.', 400)

    const casoId = linkResp.data.caso_id

    if (accion === 'aplicar') {
      const borrador = body.borrador || {}
      const pendientes = textoSeguro(borrador.pendientes, 6000)
      const observacionBase = textoSeguro(borrador.observaciones_cierre, 8000)
      const observacionesCierre = [
        observacionBase,
        pendientes ? `Pendientes: ${pendientes}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      const updateData = {
        diagnostico: textoSeguro(borrador.diagnostico) || null,
        causa_probable: textoSeguro(borrador.causa_probable) || null,
        trabajo_realizado: textoSeguro(borrador.trabajo_realizado) || null,
        hallazgos: textoSeguro(borrador.hallazgos) || null,
        resultado_servicio: textoSeguro(borrador.resultado_servicio) || null,
        conclusiones_tecnicas: textoSeguro(borrador.conclusiones_tecnicas) || null,
        recomendaciones: textoSeguro(borrador.recomendaciones) || null,
        observaciones_cierre: observacionesCierre || null,
        updated_at: new Date().toISOString(),
      }

      const updateResp = await admin
        .from('ot_ordenes_trabajo')
        .update(updateData)
        .eq('id', ot.id)
        .eq('empresa_id', ot.empresa_id)

      if (updateResp.error) return jsonError(updateResp.error.message, 500)

      const seleccionadas = Array.from(new Set(body.evidenciasSeleccionadas || []))
      let evidenciasCopiadas = 0

      if (seleccionadas.length > 0) {
        const evidenciasResp = await admin
          .from('asistente_evidencias')
          .select('id,storage_bucket,storage_path,archivo_nombre,mime_type,descripcion')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .in('id', seleccionadas)

        if (evidenciasResp.error) return jsonError(evidenciasResp.error.message, 500)

        const relacionesResp = await admin
          .from('asistente_evento_evidencias')
          .select('evidencia_id,tipo_uso')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .in('evidencia_id', seleccionadas)

        if (relacionesResp.error) return jsonError(relacionesResp.error.message, 500)

        const usoPorEvidencia = new Map<string, string>()
        for (const rel of relacionesResp.data || []) {
          if (!usoPorEvidencia.has(rel.evidencia_id)) {
            usoPorEvidencia.set(rel.evidencia_id, rel.tipo_uso)
          }
        }

        const existentesResp = await admin
          .from('ot_evidencias')
          .select('archivo_nombre,descripcion')
          .eq('ot_id', ot.id)

        if (existentesResp.error) return jsonError(existentesResp.error.message, 500)

        const existentes = new Set(
          (existentesResp.data || []).map(
            (item) => `${item.archivo_nombre || ''}|${item.descripcion || ''}`
          )
        )

        for (const evidencia of evidenciasResp.data || []) {
          if (!evidencia.storage_bucket || !evidencia.storage_path) continue

          const dedupeKey = `${evidencia.archivo_nombre || ''}|${evidencia.descripcion || ''}`
          if (existentes.has(dedupeKey)) continue

          const download = await admin.storage
            .from(evidencia.storage_bucket)
            .download(evidencia.storage_path)

          if (download.error || !download.data) continue

          const originalName = evidencia.archivo_nombre || `evidencia-${evidencia.id}`
          const safeName = originalName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .toLowerCase()

          const targetPath = `${ot.empresa_id}/${ot.id}/viva-${evidencia.id}-${safeName}`
          const upload = await admin.storage
            .from('ot-evidencias')
            .upload(targetPath, download.data, {
              contentType: evidencia.mime_type || undefined,
              upsert: false,
            })

          if (upload.error) continue

          const { data: publicData } = admin.storage
            .from('ot-evidencias')
            .getPublicUrl(targetPath)

          const tipo = tipoOtEvidencia(usoPorEvidencia.get(evidencia.id))
          const ordenResp = await admin
            .from('ot_evidencias')
            .select('orden')
            .eq('ot_id', ot.id)
            .eq('tipo', tipo)
            .order('orden', { ascending: false })
            .limit(1)
            .maybeSingle()

          const nextOrder = Number(ordenResp.data?.orden || 0) + 1

          const insert = await admin.from('ot_evidencias').insert({
            ot_id: ot.id,
            tipo,
            archivo_url: publicData.publicUrl,
            archivo_nombre: originalName,
            descripcion: evidencia.descripcion || 'Evidencia capturada desde OT Viva',
            orden: nextOrder,
            subido_por: user.id,
          })

          if (!insert.error) {
            evidenciasCopiadas += 1
            existentes.add(dedupeKey)
          }
        }
      }

      return jsonResponse({
        ok: true,
        evidenciasCopiadas,
        mensaje: 'Borrador aplicado a la OT principal. Ya puede revisarse y pasar a firma del cliente.',
      })
    }

    if (!openAiKey) {
      return jsonError('El asistente IA no está configurado en este entorno.', 503)
    }

    const [casoResp, eventosResp, decisionesResp, relacionesResp, evidenciasResp, relacionesEvidResp] =
      await Promise.all([
        admin
          .from('asistente_casos')
          .select('id,titulo,descripcion_inicial,estado')
          .eq('id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .maybeSingle(),
        admin
          .from('asistente_eventos')
          .select('id,tipo_evento,nivel_certeza,autor_tipo,texto_original,ocurrido_at,estado_validacion,incluir_resumen')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .eq('estado', 'activo')
          .order('ocurrido_at', { ascending: true }),
        admin
          .from('asistente_decisiones')
          .select('id,evento_id,actor_tipo,actor_nombre_snapshot,decision,motivo,decidido_at')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .order('decidido_at', { ascending: true }),
        admin
          .from('asistente_evento_relaciones')
          .select('evento_origen_id,evento_destino_id,tipo_relacion,observacion,created_at,activo')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .eq('activo', true)
          .order('created_at', { ascending: true }),
        admin
          .from('asistente_evidencias')
          .select('id,tipo_evidencia,archivo_nombre,descripcion,capturado_at')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id)
          .order('capturado_at', { ascending: true }),
        admin
          .from('asistente_evento_evidencias')
          .select('evento_id,evidencia_id,tipo_uso')
          .eq('caso_id', casoId)
          .eq('empresa_id', ot.empresa_id),
      ])

    if (casoResp.error || !casoResp.data) {
      return jsonError(casoResp.error?.message || 'No se encontró el caso OT Viva.', 404)
    }
    if (eventosResp.error) return jsonError(eventosResp.error.message, 500)
    if (decisionesResp.error) return jsonError(decisionesResp.error.message, 500)
    if (relacionesResp.error) return jsonError(relacionesResp.error.message, 500)
    if (evidenciasResp.error) return jsonError(evidenciasResp.error.message, 500)
    if (relacionesEvidResp.error) return jsonError(relacionesEvidResp.error.message, 500)

    const decisionesVigentes = new Map<string, (typeof decisionesResp.data)[number]>()
    for (const decision of decisionesResp.data || []) {
      if (decision.evento_id) decisionesVigentes.set(decision.evento_id, decision)
    }

    const eventos = (eventosResp.data || [])
      .filter((evento) => evento.incluir_resumen !== false && evento.tipo_evento !== 'respuesta_ia')
      .map((evento, index) => {
        const decision = decisionesVigentes.get(evento.id)
        const estado = decision
          ? ` | DECISIÓN HUMANA VIGENTE: ${decision.decision}. Fundamento: ${decision.motivo || 'sin detalle'}`
          : ''
        return `${index + 1}. [${evento.tipo_evento} | ${evento.nivel_certeza}${estado}] ${evento.texto_original}`
      })
      .join('\n')

    const developerInstructions = `
Eres Tralixia preparando el borrador de cierre de una orden de trabajo técnica a partir de registros de OT Viva.

Reglas obligatorias:
- Usa únicamente el contexto entregado de esta OT.
- No inventes trabajos, resultados, causas, repuestos, mediciones ni pruebas.
- La IA propone el borrador; el técnico lo revisará y aprobará antes de aplicarlo.
- Las decisiones humanas estructuradas son la fuente de verdad para hipótesis confirmadas o descartadas.
- No presentes como diagnóstico una hipótesis descartada.
- Si no existe causa confirmada por evidencia o decisión humana, deja causa_probable vacía.
- Conserva pendientes, restricciones y labores que no pudieron realizarse.
- Redacta para una OT profesional que verá el cliente: claro, técnico, breve y verificable.
- No incluyas UUID, razonamiento interno, consultas de IA ni hipótesis descartadas salvo que sean necesarias para explicar una limitación relevante.
- No afirmes que se ejecutó una pauta/checklist si el contexto no lo demuestra.
- Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown, con estas claves exactas:
  diagnostico, causa_probable, trabajo_realizado, hallazgos, resultado_servicio, conclusiones_tecnicas, recomendaciones, observaciones_cierre, pendientes.
- Cada valor debe ser string. Si no hay información suficiente para un campo, usa string vacío.
`.trim()

    const userInput = `
OT: ${ot.folio || ot.id}
Título: ${ot.titulo || 'No informado'}
Solicitud original: ${ot.descripcion_solicitud || 'No informada'}
Caso OT Viva: ${casoResp.data.titulo || 'Sin título'}

Eventos relevantes de la intervención:
${eventos || 'No hay eventos relevantes registrados.'}

Relaciones técnicas activas:
${(relacionesResp.data || [])
  .map(
    (item, index) =>
      `${index + 1}. ${item.evento_origen_id} ${item.tipo_relacion} ${item.evento_destino_id}${item.observacion ? `: ${item.observacion}` : ''}`
  )
  .join('\n') || 'No hay relaciones activas.'}

Evidencias capturadas:
${(evidenciasResp.data || [])
  .map((item, index) => {
    const usos = (relacionesEvidResp.data || [])
      .filter((rel) => rel.evidencia_id === item.id)
      .map((rel) => rel.tipo_uso)
      .join(', ')
    return `${index + 1}. ID ${item.id} | ${item.tipo_evidencia} | uso: ${usos || 'sin clasificar'} | ${item.descripcion || item.archivo_nombre || 'sin descripción'}`
  })
  .join('\n') || 'No hay evidencias.'}
`.trim()

    const aiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openAiModel,
        store: false,
        max_output_tokens: 1800,
        input: [
          { role: 'developer', content: developerInstructions },
          { role: 'user', content: userInput },
        ],
      }),
    })

    const aiData = await aiResp.json()

    if (!aiResp.ok) {
      return jsonError(
        aiData?.error?.message || 'No fue posible preparar el cierre con Tralixia.',
        aiResp.status
      )
    }

    const texto = extraerTextoRespuesta(aiData)
    if (!texto) return jsonError('Tralixia no devolvió un borrador utilizable.', 500)

    let parsed: Partial<CierreDraft>
    try {
      parsed = JSON.parse(limpiarJson(texto))
    } catch {
      return jsonError('El borrador generado no pudo estructurarse. Intenta nuevamente.', 502)
    }

    const borrador: CierreDraft = {
      diagnostico: textoSeguro(parsed.diagnostico),
      causa_probable: textoSeguro(parsed.causa_probable),
      trabajo_realizado: textoSeguro(parsed.trabajo_realizado),
      hallazgos: textoSeguro(parsed.hallazgos),
      resultado_servicio: textoSeguro(parsed.resultado_servicio),
      conclusiones_tecnicas: textoSeguro(parsed.conclusiones_tecnicas),
      recomendaciones: textoSeguro(parsed.recomendaciones),
      observaciones_cierre: textoSeguro(parsed.observaciones_cierre),
      pendientes: textoSeguro(parsed.pendientes),
    }

    return jsonResponse({
      borrador,
      evidencias: evidenciasResp.data || [],
      relacionesEvidencias: relacionesEvidResp.data || [],
      horaInicioOt: ot.hora_inicio,
      horaTerminoOt: ot.hora_termino,
    })
  } catch (error) {
    console.error('Error preparando cierre OT Viva:', error)
    return jsonError(
      error instanceof Error ? error.message : 'Error interno al preparar el cierre OT Viva.',
      500
    )
  }
}
