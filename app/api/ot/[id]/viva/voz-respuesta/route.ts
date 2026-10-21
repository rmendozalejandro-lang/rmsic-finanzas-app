import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: otId } = await params
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const aiKey = process.env.OPENAI_API_KEY
    if (!url || !anonKey || !serviceKey || !aiKey) return errorResponse('La síntesis de voz no está configurada.', 503)

    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!token) return errorResponse('No autorizado.', 401)

    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: authError } = await auth.auth.getUser(token)
    if (authError || !user) return errorResponse('Sesión no válida.', 401)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: ot, error: otError } = await admin.from('ot_ordenes_trabajo')
      .select('id,empresa_id').eq('id', otId).maybeSingle()
    if (otError) return errorResponse('Error al consultar la OT.', 500)
    if (!ot) return errorResponse('OT no encontrada.', 404)

    const { data: access } = await admin.from('usuario_empresas')
      .select('id').eq('usuario_id', user.id).eq('empresa_id', ot.empresa_id).eq('activo', true).maybeSingle()
    if (!access) return errorResponse('Sin acceso a esta empresa.', 403)

    const { data: capacity } = await admin.from('empresa_capacidades')
      .select('habilitado').eq('empresa_id', ot.empresa_id).eq('capacidad', 'asistente_ia').maybeSingle()
    if (!capacity?.habilitado) return errorResponse('Asistente no habilitado para esta empresa.', 403)

    const { data: linked } = await admin.from('asistente_caso_ots')
      .select('caso_id').eq('empresa_id', ot.empresa_id).eq('ot_id', ot.id).limit(1).maybeSingle()
    if (!linked?.caso_id) return errorResponse('Esta OT no tiene caso de OT Viva.', 400)

    const body = await request.json()
    const raw = typeof body?.texto === 'string' ? body.texto.trim() : ''
    if (!raw || raw.length > 3500) return errorResponse('La respuesta debe tener entre 1 y 3500 caracteres.', 400)

    // Preserve factual wording, removing only presentation markup. Blank lines mark topic transitions.
    const texto = raw.replace(/\*\*/g, '').replace(/(^|\n)#{1,5}\s*/g, '$1')
      .replace(/(^|\n)\s*[-•]\s+/g, '$1').trim()

    const speech = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'marin',
        response_format: 'mp3',
        input: texto,
        instructions: 'Habla en español latinoamericano de Chile, con voz natural, profesional y cercana, como un especialista técnico explicando verbalmente a otro técnico de mantenimiento industrial. Haz pausas perceptibles entre párrafos y cambios de tema; usa ritmo moderado, entonación conversacional y pronunciación clara de unidades técnicas. No agregues ni cambies información.'
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!speech.ok) return errorResponse('No fue posible generar la voz en este momento.', 502)
    return new Response(speech.body, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    console.error('Error al generar audio OT Viva:', error instanceof Error ? error.name : 'error')
    return errorResponse('No fue posible generar la respuesta hablada.', 500)
  }
}
