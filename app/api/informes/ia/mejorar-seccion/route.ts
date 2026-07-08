import { NextResponse } from 'next/server'

type Body = {
  seccion?: string
  textoActual?: string
  contexto?: {
    titulo?: string
    tipoInforme?: string
    cliente?: string
    areaUbicacion?: string
    equipoTag?: string
  }
}

function limpiarTexto(valor?: string | null) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function extraerTextoRespuesta(data: any) {
  if (typeof data?.output_text === 'string') {
    return data.output_text.trim()
  }

  if (!Array.isArray(data?.output)) {
    return ''
  }

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

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-5.5'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta configurar OPENAI_API_KEY en .env.local.' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as Body
    const seccion = limpiarTexto(body.seccion)
    const textoActual = limpiarTexto(body.textoActual)
    const contexto = body.contexto || {}

    if (!seccion) {
      return NextResponse.json(
        { error: 'Falta indicar la sección a mejorar.' },
        { status: 400 },
      )
    }

    if (!textoActual) {
      return NextResponse.json(
        { error: 'Primero escribe un texto base para que la IA lo mejore.' },
        { status: 400 },
      )
    }

    const developerInstructions = `
Eres un asistente de redacción técnica para informes emitidos por RM Servicios de Ingeniería y Construcción SpA.

Tu tarea es mejorar la redacción de una sección de un informe técnico.

Reglas obligatorias:
- No inventes mediciones, fechas, fallas, equipos, valores, normas, responsables ni conclusiones que no estén en el texto o contexto entregado.
- Mantén el sentido técnico original.
- Corrige ortografía, claridad, coherencia y tono profesional.
- Usa español formal de Chile.
- Evita exageraciones comerciales.
- No incluyas saludos, explicaciones ni encabezados adicionales.
- Devuelve solo el texto mejorado.
- Si el texto original es breve, puedes ampliarlo moderadamente, pero sin agregar datos no entregados.
- No uses listas salvo que el texto original lo requiera.
`.trim()

    const userInput = `
Contexto del informe:
Título: ${limpiarTexto(contexto.titulo) || 'No informado'}
Tipo de informe: ${limpiarTexto(contexto.tipoInforme) || 'No informado'}
Cliente: ${limpiarTexto(contexto.cliente) || 'No informado'}
Área / ubicación: ${limpiarTexto(contexto.areaUbicacion) || 'No informado'}
Equipo / TAG: ${limpiarTexto(contexto.equipoTag) || 'No informado'}

Sección a mejorar:
${seccion}

Texto actual:
${textoActual}
`.trim()

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 900,
        input: [
          {
            role: 'developer',
            content: developerInstructions,
          },
          {
            role: 'user',
            content: userInput,
          },
        ],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            'No fue posible generar la mejora con IA.',
        },
        { status: response.status },
      )
    }

    const textoMejorado = extraerTextoRespuesta(data)

    if (!textoMejorado) {
      return NextResponse.json(
        { error: 'La IA no devolvió texto mejorado.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      texto: textoMejorado,
    })
  } catch (error) {
    console.error('Error IA mejorar sección:', error)

    return NextResponse.json(
      { error: 'Error interno al procesar la solicitud de IA.' },
      { status: 500 },
    )
  }
}
