import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  pregunta?: string
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
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

    if (!openAiKey) {
      return jsonError('El asistente IA no está configurado en este entorno.', 503)
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

    const body = (await request.json()) as Body
    const pregunta = String(body.pregunta || '').trim()

    if (!pregunta) {
      return jsonError('Escribe una consulta para el asistente técnico.', 400)
    }

    if (pregunta.length > 4000) {
      return jsonError('La consulta es demasiado extensa.', 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const otResp = await admin
      .from('ot_ordenes_trabajo')
      .select('id,empresa_id,cliente_id,folio,titulo,descripcion_solicitud')
      .eq('id', otId)
      .maybeSingle()

    if (otResp.error) return jsonError(otResp.error.message, 500)
    if (!otResp.data) return jsonError('No se encontró la OT.', 404)

    const ot = otResp.data

    const accesoResp = await admin
      .from('usuario_empresas')
      .select('id,rol,activo')
      .eq('usuario_id', user.id)
      .eq('empresa_id', ot.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (accesoResp.error || !accesoResp.data) {
      return jsonError('No tienes acceso a la empresa de esta OT.', 403)
    }

    const capacidadResp = await admin
      .from('empresa_capacidades')
      .select('habilitado,configuracion')
      .eq('empresa_id', ot.empresa_id)
      .eq('capacidad', 'asistente_ia')
      .maybeSingle()

    if (capacidadResp.error) return jsonError(capacidadResp.error.message, 500)

    if (!capacidadResp.data?.habilitado) {
      return jsonError('La IA no está habilitada para esta empresa.', 403)
    }

    const casoLinkResp = await admin
      .from('asistente_caso_ots')
      .select('caso_id')
      .eq('empresa_id', ot.empresa_id)
      .eq('ot_id', ot.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (casoLinkResp.error) return jsonError(casoLinkResp.error.message, 500)
    if (!casoLinkResp.data?.caso_id) {
      return jsonError('Primero habilita OT Viva para esta orden.', 400)
    }

    const casoId = casoLinkResp.data.caso_id

    const [casoResp, sesionResp, eventosResp] = await Promise.all([
      admin
        .from('asistente_casos')
        .select('id,titulo,descripcion_inicial,estado')
        .eq('id', casoId)
        .eq('empresa_id', ot.empresa_id)
        .maybeSingle(),
      admin
        .from('asistente_sesiones')
        .select('id,estado,iniciado_at')
        .eq('caso_id', casoId)
        .eq('empresa_id', ot.empresa_id)
        .eq('estado', 'en_curso')
        .order('iniciado_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('asistente_eventos')
        .select('id,tipo_evento,nivel_certeza,autor_tipo,texto_original,ocurrido_at,estado_validacion')
        .eq('caso_id', casoId)
        .eq('empresa_id', ot.empresa_id)
        .eq('estado', 'activo')
        .order('ocurrido_at', { ascending: false })
        .limit(30),
    ])

    if (casoResp.error || !casoResp.data) {
      return jsonError(casoResp.error?.message || 'No se encontró el caso OT Viva.', 404)
    }
    if (sesionResp.error) return jsonError(sesionResp.error.message, 500)
    if (eventosResp.error) return jsonError(eventosResp.error.message, 500)

    const eventos = eventosResp.data || []

    const contextoEventos = eventos
      .map(
        (item, index) =>
          `${index + 1}. [${item.tipo_evento} | ${item.nivel_certeza} | ${item.autor_tipo}] ${item.texto_original}`
      )
      .join('\n')

    const developerInstructions = `
Eres el Asistente Técnico de Tralixia para una orden de trabajo industrial.

Reglas obligatorias:
- Trabaja únicamente con el contexto entregado de ESTA empresa, ESTA OT y ESTE caso.
- No inventes información que no aparezca en el contexto.
- No asumas datos de otras empresas, clientes, OT o conversaciones.
- Si falta información, dilo explícitamente.
- Distingue entre hechos registrados, hipótesis y sugerencias.
- No confirmes ni descartes una hipótesis como decisión final: eso corresponde a una persona.
- Puedes proponer verificaciones, pruebas o hipótesis, pero debes identificarlas como propuestas.
- Prioriza seguridad industrial y no sugieras intervenir equipos energizados o protegidos sin procedimientos adecuados.
- Responde en español de Chile, de forma técnica y clara.
`.trim()

    const userInput = `
Contexto autorizado de Tralixia:
Empresa ID: ${ot.empresa_id}
OT: ${ot.folio || ot.id}
Título: ${ot.titulo || 'No informado'}
Solicitud: ${ot.descripcion_solicitud || 'No informada'}
Caso OT Viva: ${casoResp.data.titulo || 'Sin título'}
Estado caso: ${casoResp.data.estado}

Eventos registrados en este caso:
${contextoEventos || 'No hay eventos registrados.'}

Consulta del técnico:
${pregunta}
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
        max_output_tokens: 1200,
        input: [
          { role: 'developer', content: developerInstructions },
          { role: 'user', content: userInput },
        ],
      }),
    })

    const aiData = await aiResp.json()

    if (!aiResp.ok) {
      return jsonError(
        aiData?.error?.message || 'No fue posible consultar el asistente IA.',
        aiResp.status
      )
    }

    const respuesta = extraerTextoRespuesta(aiData)

    if (!respuesta) {
      return jsonError('El asistente IA no devolvió una respuesta utilizable.', 500)
    }

    const externalKey = crypto.randomUUID()
    const insertResp = await admin
      .from('asistente_eventos')
      .insert({
        empresa_id: ot.empresa_id,
        caso_id: casoId,
        sesion_id: sesionResp.data?.id || null,
        tipo_evento: 'respuesta_ia',
        nivel_certeza: 'propuesto',
        autor_tipo: 'asistente',
        origen_captura: 'ia',
        usuario_id: null,
        texto_original: respuesta,
        descripcion_normalizada: null,
        contexto_etiqueta: 'asistente_tecnico',
        prioridad: null,
        visible_externo: false,
        incluir_resumen: false,
        estado: 'activo',
        estado_validacion: 'pendiente',
        datos: {
          ot_id: ot.id,
          pregunta,
          origen_modulo: 'ot_viva',
          alcance: 'empresa_y_caso_actual',
          empresa_id_fijada_por_servidor: ot.empresa_id,
        },
        created_by: user.id,
        origen_externo: 'ot_viva_ia',
        clave_externa: externalKey,
      })
      .select('id')
      .single()

    if (insertResp.error) {
      return jsonError(
        `La IA respondió, pero no fue posible registrar la trazabilidad: ${insertResp.error.message}`,
        500
      )
    }

    return jsonResponse({
      respuesta,
      eventoId: insertResp.data.id,
      empresaId: ot.empresa_id,
      casoId,
    })
  } catch (error) {
    console.error('Error Asistente Técnico OT Viva:', error)
    return jsonError('Error interno al procesar la consulta del asistente.', 500)
  }
}
