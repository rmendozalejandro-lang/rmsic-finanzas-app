import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EventoEntrada = {
  tipo_evento: string
  nivel_certeza: string
  texto_original: string
  ocurrido_at?: string
}

type RelacionEntrada = {
  tipo_relacion: string
  origen_texto?: string
  destino_texto?: string
}

type Body = {
  pregunta?: string
  ot_id?: string
  ot?: {
    folio?: string | null
    titulo?: string | null
    cliente?: string | null
    equipo?: string | null
  }
  eventos?: EventoEntrada[]
  relaciones?: RelacionEntrada[]
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

function extraerTextoRespuesta(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  const partes: string[] = []
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        partes.push(content.text)
      }
    }
  }
  return partes.join('\n').trim()
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let supabaseStartedAt = startedAt
  let supabaseFinishedAt = startedAt
  let openaiStartedAt = 0
  let openaiFinishedAt = 0

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY
    const openaiModel = process.env.OPENAI_MODEL

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonError('Faltan variables de entorno Supabase.', 500)
    }

    if (!openaiApiKey || !openaiModel) {
      return jsonError('El Asistente RMSIC todavía no tiene configuradas OPENAI_API_KEY y OPENAI_MODEL en Vercel.', 503)
    }

    supabaseStartedAt = Date.now()

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) return jsonError('No autorizado.', 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) return jsonError('Sesión no válida.', 401)

    const body = (await request.json()) as Body
    const pregunta = String(body.pregunta || '').trim()
    const otId = String(body.ot_id || '').trim()

    if (!pregunta) return jsonError('Escribe una consulta técnica.', 400)
    if (!otId) return jsonError('No se recibió la OT asociada a la consulta.', 400)

    const { data: ot, error: otError } = await authClient
      .from('ot_ordenes_trabajo')
      .select('id, empresa_id, folio, titulo, cliente_id, tecnico_responsable_id, fecha_ot, fecha_cierre, tipo_servicio, area_trabajo, descripcion_solicitud, problema_reportado, diagnostico, causa_probable, trabajo_realizado, hallazgos, conclusiones_tecnicas, recomendaciones, resultado_servicio, observaciones_cierre')
      .eq('id', otId)
      .eq('activo', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (otError) {
      return jsonError(`No se pudo validar la OT: ${otError.message}`, 500)
    }

    if (!ot) {
      return jsonError('No tienes acceso a esta OT o la OT no existe.', 403)
    }

    const responsableId = (ot as any).tecnico_responsable_id || null

    const { data: accesoAsistente, error: accesoError } = await authClient.rpc(
      'usuario_tiene_acceso_asistente',
      {
        p_empresa_id: (ot as any).empresa_id,
        p_dominio: 'tecnico',
      }
    )

    if (accesoError) {
      return jsonError(`No se pudo validar el acceso al Asistente: ${accesoError.message}`, 500)
    }

    if (accesoAsistente !== true) {
      return jsonError('No tienes permisos para usar el Asistente Técnico en esta empresa.', 403)
    }

    const { data: accesoCaso, error: accesoCasoError } = await authClient.rpc(
      'usuario_puede_acceder_caso_asistente',
      {
        p_empresa_id: (ot as any).empresa_id,
        p_dominio: 'tecnico',
        p_responsable_id: responsableId,
      }
    )

    if (accesoCasoError) {
      return jsonError(`No se pudo validar el acceso a esta OT: ${accesoCasoError.message}`, 500)
    }

    if (accesoCaso !== true) {
      return jsonError('No tienes permisos para consultar el Asistente sobre esta OT.', 403)
    }

    const eventosLocales = Array.isArray(body.eventos) ? body.eventos.slice(-40) : []
    const relacionesLocales = Array.isArray(body.relaciones) ? body.relaciones.slice(-30) : []

    // La IA debe poder razonar sobre la memoria técnica ya sincronizada aunque el
    // Preview cambie de origen y el localStorage del navegador esté vacío.
    const { data: vinculoCaso, error: vinculoError } = await authClient
      .from('asistente_caso_ots')
      .select('caso_id')
      .eq('ot_id', otId)
      .eq('empresa_id', (ot as any).empresa_id)
      .maybeSingle()

    if (vinculoError) {
      return jsonError(`No se pudo cargar la memoria técnica de la OT: ${vinculoError.message}`, 500)
    }

    let eventosSincronizados: Array<EventoEntrada & { id?: string }> = []
    let relacionesSincronizadas: RelacionEntrada[] = []

    if (vinculoCaso?.caso_id) {
      const { data: eventosDb, error: eventosDbError } = await authClient
        .from('asistente_eventos')
        .select('id, tipo_evento, nivel_certeza, texto_original, ocurrido_at')
        .eq('caso_id', vinculoCaso.caso_id)
        .eq('estado', 'activo')
        .order('ocurrido_at', { ascending: true })
        .limit(80)

      if (eventosDbError) {
        return jsonError(`No se pudieron cargar los eventos sincronizados: ${eventosDbError.message}`, 500)
      }

      eventosSincronizados = (eventosDb ?? []).map((evento: any) => ({
        id: evento.id,
        tipo_evento: String(evento.tipo_evento || ''),
        nivel_certeza: String(evento.nivel_certeza || ''),
        texto_original: String(evento.texto_original || ''),
        ocurrido_at: evento.ocurrido_at || undefined,
      }))

      const eventoTexto = new Map(
        eventosSincronizados
          .filter((evento) => evento.id)
          .map((evento) => [evento.id as string, evento.texto_original]),
      )

      const { data: relacionesDb, error: relacionesDbError } = await authClient
        .from('asistente_evento_relaciones')
        .select('tipo_relacion, evento_origen_id, evento_destino_id')
        .eq('caso_id', vinculoCaso.caso_id)
        .order('created_at', { ascending: true })
        .limit(60)

      if (relacionesDbError) {
        return jsonError(`No se pudieron cargar las relaciones sincronizadas: ${relacionesDbError.message}`, 500)
      }

      relacionesSincronizadas = (relacionesDb ?? []).map((relacion: any) => ({
        tipo_relacion: String(relacion.tipo_relacion || ''),
        origen_texto: eventoTexto.get(relacion.evento_origen_id),
        destino_texto: eventoTexto.get(relacion.evento_destino_id),
      }))
    }

    const claveEvento = (evento: EventoEntrada) =>
      [
        evento.tipo_evento?.trim().toLowerCase(),
        evento.nivel_certeza?.trim().toLowerCase(),
        evento.texto_original?.trim().toLowerCase(),
        evento.ocurrido_at || '',
      ].join('|')

    const eventosMap = new Map<string, EventoEntrada>()
    for (const evento of [...eventosSincronizados, ...eventosLocales]) {
      if (!evento.texto_original?.trim()) continue
      eventosMap.set(claveEvento(evento), {
        tipo_evento: evento.tipo_evento,
        nivel_certeza: evento.nivel_certeza,
        texto_original: evento.texto_original,
        ocurrido_at: evento.ocurrido_at,
      })
    }
    // No se excluyen eventos por palabras clave: términos como "pérdida de conexión"
    // pueden ser ruido de prueba o evidencia técnica según el contexto de la OT.
    const eventos = Array.from(eventosMap.values()).slice(-40)

    const claveRelacion = (relacion: RelacionEntrada) =>
      [
        relacion.tipo_relacion?.trim().toLowerCase(),
        relacion.origen_texto?.trim().toLowerCase() || '',
        relacion.destino_texto?.trim().toLowerCase() || '',
      ].join('|')

    const relacionesMap = new Map<string, RelacionEntrada>()
    for (const relacion of [...relacionesSincronizadas, ...relacionesLocales]) {
      relacionesMap.set(claveRelacion(relacion), relacion)
    }
    const textosIncluidos = new Set(eventos.map((evento) => evento.texto_original.trim().toLowerCase()))
    const relaciones = Array.from(relacionesMap.values())
      .filter((relacion) => {
        const origen = relacion.origen_texto?.trim().toLowerCase() || ''
        const destino = relacion.destino_texto?.trim().toLowerCase() || ''
        return (origen && textosIncluidos.has(origen)) || (destino && textosIncluidos.has(destino))
      })
      .slice(-30)

    supabaseFinishedAt = Date.now()

    const camposAntecedentes = {
      fecha_ot: (ot as any).fecha_ot ?? null,
      fecha_cierre: (ot as any).fecha_cierre ?? null,
      tipo_servicio: (ot as any).tipo_servicio ?? null,
      area_trabajo: (ot as any).area_trabajo ?? null,
      descripcion_solicitud: (ot as any).descripcion_solicitud ?? null,
      problema_reportado: (ot as any).problema_reportado ?? null,
      diagnostico: (ot as any).diagnostico ?? null,
      causa_probable: (ot as any).causa_probable ?? null,
      trabajo_realizado: (ot as any).trabajo_realizado ?? null,
      hallazgos: (ot as any).hallazgos ?? null,
      conclusiones_tecnicas: (ot as any).conclusiones_tecnicas ?? null,
      recomendaciones: (ot as any).recomendaciones ?? null,
      resultado_servicio: (ot as any).resultado_servicio ?? null,
      observaciones_cierre: (ot as any).observaciones_cierre ?? null,
    }

    const antecedentesOtFormal = Object.fromEntries(
      Object.entries(camposAntecedentes).filter(([, valor]) =>
        valor !== null && valor !== undefined && String(valor).trim() !== ''
      ),
    )

    const contexto = {
      ot: {
        id: otId,
        folio: (ot as any).folio ?? body.ot?.folio ?? null,
        titulo: (ot as any).titulo ?? body.ot?.titulo ?? null,
        cliente: body.ot?.cliente ?? null,
        equipo: body.ot?.equipo ?? null,
      },
      antecedentes_ot_formal: antecedentesOtFormal,
      memoria_ot_viva: {
        eventos,
        relaciones,
      },
    }

    const instructions = [
      'Eres el Asistente Técnico RMSIC dentro de Tralixia.',
      'Actúas como segundo profesional técnico, no como autoridad automática.',
      'La memoria técnica registrada en Tralixia y tu razonamiento deben permanecer separados de forma inequívoca.',
      'El contexto puede contener dos fuentes distintas: antecedentes_ot_formal y memoria_ot_viva. Mantén esa separación explícita.',
      'antecedentes_ot_formal contiene documentación histórica de la OT formal y es de solo lectura para esta consulta. No la conviertas automáticamente en eventos OT Viva ni en hipótesis confirmadas.',
      'memoria_ot_viva contiene eventos y relaciones estructuradas del asistente. Solo esas relaciones explícitas pueden confirmar o descartar hipótesis OT Viva.',
      'Cuando uses información de antecedentes_ot_formal, identifícala como Antecedentes de la OT formal o Registro histórico de la OT, sin reclasificarla automáticamente como Observado, Medido o Informado.',
      'Si la OT formal declara incertidumbre, por ejemplo que una causa no pudo establecerse con certeza, conserva expresamente esa incertidumbre aunque exista un hallazgo mecánico posterior.',
      'OBSERVADO, MEDIDO e INFORMADO son categorías de procedencia y NO equivalen a CONFIRMADO.',
      'Una HIPÓTESIS solo puede llamarse CONFIRMADA o DESCARTADA si el contexto estructurado contiene evidencia o una relación que indique explícitamente ese estado.',
      'No llames hecho confirmado a un hallazgo observado, una medición o información reportada solo por estar registrada.',
      'Usa la palabra registros o evidencias registradas al referirte colectivamente a OBSERVADO, MEDIDO o INFORMADO.',
      'No presentes como hipótesis abiertas de Tralixia causas alternativas que tú hayas inferido. Etiquétalas como Hipótesis nuevas sugeridas por IA y aclara que aún no forman parte de la memoria técnica.',
      'Cuando propongas hipótesis nuevas, formula causas técnicas concretas y separadas, no recomendaciones ni pruebas.',
      'No inventes mediciones, estados internos ni datos que no aparezcan en el contexto.',
      'Cuestiona hipótesis cuando la evidencia sea insuficiente y propone pruebas reversibles y seguras antes de concluir.',
      'No recomiendes una técnica de medición específica como continuidad, resistencia, puenteo, forzado de señal o energización si el contexto no identifica el circuito, tecnología y condiciones seguras necesarias.',
      'Cuando falte ese contexto, recomienda verificar el estado y las señales de la cadena o circuito conforme al esquema eléctrico, manual del fabricante y procedimiento de seguridad aplicable.',
      'Si una conclusión requiere inspección física, medición o procedimiento de seguridad, indícalo expresamente.',
      'No declares una máquina segura, energizada correctamente ni apta para operar solo por inferencia textual.',
      'Responde en español técnico, conciso y útil para trabajo en terreno. Evita repetir el mismo hecho en más de una sección.',
      'Cuando la consulta sea diagnóstica, usa solo las secciones necesarias entre: Antecedentes de la OT formal; Memoria OT Viva; Interpretación de la IA; Hipótesis nuevas sugeridas por IA; Qué falta comprobar; Próxima prueba sugerida.',
      'Dentro de Memoria OT Viva conserva literalmente la categoría disponible: Observado, Medido, Informado, Hipótesis abierta, Hipótesis confirmada o Hipótesis descartada.',
      'Si una sección no aplica, puedes omitirla. No confundas propuesta de IA con dato registrado.',
    ].join(' ')

    const input = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Contexto técnico estructurado de la OT:\n${JSON.stringify(contexto, null, 2)}\n\nConsulta del técnico:\n${pregunta}`,
          },
        ],
      },
    ]

    openaiStartedAt = Date.now()
    const openaiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiModel,
        instructions,
        input,
        max_output_tokens: 600,
      }),
      cache: 'no-store',
    })

    const payload = await openaiResp.json().catch(() => null)
    openaiFinishedAt = Date.now()

    if (!openaiResp.ok) {
      const message = payload?.error?.message || payload?.message || 'No se pudo obtener respuesta del Asistente RMSIC.'
      return jsonError(message, openaiResp.status >= 400 && openaiResp.status < 600 ? openaiResp.status : 502)
    }

    const respuesta = extraerTextoRespuesta(payload)
    if (!respuesta) return jsonError('El modelo no devolvió texto utilizable.', 502)

    const finishedAt = Date.now()

    return jsonResponse({
      respuesta,
      model: payload?.model || openaiModel,
      response_id: payload?.id || null,
      timing_ms: {
        supabase: Math.max(0, supabaseFinishedAt - supabaseStartedAt),
        openai: openaiStartedAt > 0 ? Math.max(0, openaiFinishedAt - openaiStartedAt) : 0,
        total: Math.max(0, finishedAt - startedAt),
      },
      context_counts: {
        eventos: eventos.length,
        relaciones: relaciones.length,
      },
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Error inesperado en el Asistente RMSIC.', 500)
  }
}
