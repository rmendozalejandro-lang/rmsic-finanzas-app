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
      'La memoria técnica registrada en Tralixia y tu razonamiento deben permanecer separados de forma inequívoca.',
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
      'Responde en español técnico, conciso y útil para trabajo en terreno.',
      'Cuando la consulta sea diagnóstica, estructura preferentemente la respuesta con estas secciones: Registrado en Tralixia; Interpretación de la IA; Hipótesis nuevas sugeridas por IA; Qué falta comprobar; Próxima prueba sugerida.',
      'Dentro de Registrado en Tralixia conserva literalmente la categoría disponible: Observado, Medido, Informado, Hipótesis abierta, Hipótesis confirmada o Hipótesis descartada.',
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
