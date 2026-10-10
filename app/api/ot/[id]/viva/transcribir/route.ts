import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status = 500) {
  return jsonResponse({ error: message }, status)
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

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonError('Faltan variables de entorno Supabase.', 500)
    }

    if (!openAiKey) {
      return jsonError('La transcripción por voz no está configurada en este entorno.', 503)
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
      .select('id,empresa_id')
      .eq('id', otId)
      .maybeSingle()

    if (otResp.error) return jsonError(otResp.error.message, 500)
    if (!otResp.data) return jsonError('No se encontró la OT.', 404)

    const accesoResp = await admin
      .from('usuario_empresas')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', otResp.data.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (accesoResp.error || !accesoResp.data) {
      return jsonError('No tienes acceso a la empresa de esta OT.', 403)
    }

    const capacidadResp = await admin
      .from('empresa_capacidades')
      .select('habilitado')
      .eq('empresa_id', otResp.data.empresa_id)
      .eq('capacidad', 'asistente_ia')
      .maybeSingle()

    if (capacidadResp.error) return jsonError(capacidadResp.error.message, 500)
    if (!capacidadResp.data?.habilitado) {
      return jsonError('La IA no está habilitada para esta empresa.', 403)
    }

    const formData = await request.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof File)) {
      return jsonError('No se recibió audio para transcribir.', 400)
    }

    if (audio.size === 0) {
      return jsonError('La grabación está vacía.', 400)
    }

    if (audio.size > 15 * 1024 * 1024) {
      return jsonError('La grabación supera el límite de 15 MB.', 400)
    }

    const openAiForm = new FormData()
    openAiForm.append('file', audio, audio.name || 'voz.webm')
    openAiForm.append('model', 'gpt-4o-mini-transcribe')
    openAiForm.append('language', 'es')
    openAiForm.append(
      'prompt',
      'Transcribe español de Chile. Contexto: mantenimiento industrial, OT, máquinas, PLC, HMI, sensores, variadores, rodamientos, bujes, ejes, neumática y diagnóstico técnico. Conserva nombres técnicos, números, unidades y referencias.'
    )

    const openAiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: openAiForm,
    })

    const data = await openAiResponse.json()

    if (!openAiResponse.ok) {
      const message =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : 'No fue posible transcribir el audio.'
      return jsonError(message, openAiResponse.status >= 400 && openAiResponse.status < 600 ? openAiResponse.status : 502)
    }

    const texto = String(data?.text || '').trim()

    if (!texto) {
      return jsonError('No se detectó voz clara en la grabación.', 422)
    }

    return jsonResponse({ texto })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'No fue posible transcribir el audio.',
      500
    )
  }
}
