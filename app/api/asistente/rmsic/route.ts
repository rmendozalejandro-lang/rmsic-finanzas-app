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
    if (!pregunta) return jsonError('Escribe una consulta técnica.', 400)

    const eventos = Array.isArray(body.eventos) ? body.eventos.slice(-40) : []
    const relaciones = Array.isArray(body.relaciones) ? body.relaciones.slice(-30) : []

    const contexto = {
      ot: body.ot ?? {},
      eventos,
      relaciones,
    }

    const instructions = [
      'Eres el Asistente Técnico RMSIC dentro de Tralixia.',
      'Actúas como segundo profesional técnico, no como autoridad automática.',
      'Distingue claramente hechos observados, mediciones, información reportada, hipótesis y conclusiones confirmadas.',
      'No inventes mediciones, estados internos ni datos que no aparezcan en el contexto.',
      'Cuestiona hipótesis cuando la evidencia sea insuficiente y propone pruebas reversibles y seguras antes de concluir.',
      'Si una conclusión requiere inspección física, medición o procedimiento de seguridad, indícalo expresamente.',
      'No declares una máquina segura, energizada correctamente ni apta para operar solo por inferencia textual.',
      'Responde en español técnico, conciso y útil para trabajo en terreno.',
      'Cuando corresponda, estructura la respuesta como: Hechos, Interpretación, Qué falta comprobar, Próxima prueba sugerida.',
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
        max_output_tokens: 900,
      }),
      cache: 'no-store',
    })

    const payload = await openaiResp.json().catch(() => null)

    if (!openaiResp.ok) {
      const message = payload?.error?.message || payload?.message || 'No se pudo obtener respuesta del Asistente RMSIC.'
      return jsonError(message, openaiResp.status >= 400 && openaiResp.status < 600 ? openaiResp.status : 502)
    }

    const respuesta = extraerTextoRespuesta(payload)
    if (!respuesta) return jsonError('El modelo no devolvió texto utilizable.', 502)

    return jsonResponse({
      respuesta,
      model: payload?.model || openaiModel,
      response_id: payload?.id || null,
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Error inesperado en el Asistente RMSIC.', 500)
  }
}
