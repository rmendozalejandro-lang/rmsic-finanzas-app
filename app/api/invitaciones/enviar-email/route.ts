import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

type Body = {
  empresaId: string
  email: string
  rol: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador de empresa',
  administracion_financiera: 'Administración financiera',
  cobranzas: 'Cobranzas',
  comercial: 'Comercial',
  tecnico_ot: 'Técnico OT / Solo OT',
  demo_cliente: 'Cliente demo / Solo visualización',
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Faltan variables de Supabase.' },
        { status: 500 }
      )
    }

    const body = (await request.json()) as Body

    const empresaId = String(body.empresaId || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const rol = String(body.rol || '').trim()

    if (!empresaId || !email || !rol) {
      return NextResponse.json(
        { error: 'Faltan datos para enviar la invitación.' },
        { status: 400 }
      )
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
    }

    const { data: puedeAdministrar, error: permisoError } =
      await supabaseUser.rpc('puede_administrar_empresa', {
        p_empresa_id: empresaId,
      })

    if (permisoError || !puedeAdministrar) {
      return NextResponse.json(
        {
          error:
            permisoError?.message ||
            'No tienes permisos para enviar invitaciones de esta empresa.',
        },
        { status: 403 }
      )
    }

    const { data: empresa, error: empresaError } = await supabaseUser
      .from('empresas')
      .select('id, nombre, rut')
      .eq('id', empresaId)
      .maybeSingle()

    if (empresaError || !empresa) {
      return NextResponse.json(
        { error: 'No se encontró la empresa.' },
        { status: 404 }
      )
    }

    const { data: invitacion, error: invitacionError } = await supabaseUser
      .from('invitaciones_empresa')
      .select('id, email_reintentos')
      .eq('empresa_id', empresaId)
      .eq('email', email)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (invitacionError) {
      return NextResponse.json(
        { error: `No se pudo consultar la invitación pendiente: ${invitacionError.message}` },
        { status: 500 }
      )
    }

    if (!invitacion) {
      return NextResponse.json(
        { error: 'No se encontró una invitación pendiente para esta empresa y correo.' },
        { status: 404 }
      )
    }

    const registrarIntento = async (
      estado: 'enviado' | 'error',
      resendId: string | null,
      mensajeError: string | null
    ) => {
      const now = new Date().toISOString()
      const { error: updateError } = await supabaseUser
        .from('invitaciones_empresa')
        .update({
          ...(estado === 'enviado'
            ? { email_enviado_at: now, email_resend_id: resendId }
            : {}),
          ultimo_reenvio_at: now,
          email_error: mensajeError,
          email_ultimo_estado: estado,
          email_reintentos: Number(invitacion.email_reintentos || 0) + 1,
        })
        .eq('id', invitacion.id)

      if (updateError) {
        throw new Error(`No se pudo guardar la trazabilidad del correo: ${updateError.message}`)
      }
    }

    const configurationError = !process.env.RESEND_API_KEY
      ? 'Falta configurar RESEND_API_KEY; el correo de invitación no fue enviado.'
      : process.env.NODE_ENV === 'production' && !process.env.RESEND_FROM_EMAIL
        ? 'Falta configurar RESEND_FROM_EMAIL en producción; no se usará onboarding@resend.dev.'
        : null

    if (configurationError) {
      console.error(`[invitaciones/enviar-email] ${configurationError}`)
      await registrarIntento('error', null, configurationError)
      return NextResponse.json({ error: configurationError }, { status: 500 })
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'

    const registroUrl = `${appUrl.replace(/\/$/, '')}/registro`
    const rolLabel = ROLE_LABELS[rol] || rol
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Tralixia <onboarding@resend.dev>'

    if (!process.env.RESEND_FROM_EMAIL) {
      console.warn(
        '[invitaciones/enviar-email] RESEND_FROM_EMAIL no está configurado; se usa el remitente de prueba solo porque el entorno no es producción.'
      )
    }

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 620px; margin: 0 auto;">
        <div style="background: #163A5F; color: white; padding: 24px; border-radius: 18px 18px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Tralixia</h1>
          <p style="margin: 8px 0 0;">Invitación a plataforma empresarial</p>
        </div>

        <div style="border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 18px 18px;">
          <p>Hola,</p>

          <p>
            Has sido invitado a participar en la plataforma <strong>Tralixia</strong>
            para la empresa:
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin: 18px 0;">
            <p style="margin: 0;"><strong>Empresa:</strong> ${empresa.nombre}</p>
            <p style="margin: 6px 0 0;"><strong>Rol asignado:</strong> ${rolLabel}</p>
          </div>

          <p>
            Para activar tu acceso, crea tu cuenta usando exactamente este correo:
          </p>

          <p style="font-weight: bold;">${email}</p>

          <p style="margin: 24px 0;">
            <a href="${registroUrl}" style="background: #163A5F; color: white; text-decoration: none; padding: 12px 18px; border-radius: 12px; display: inline-block; font-weight: bold;">
              Crear cuenta
            </a>
          </p>

          <p>
            Si ya tienes cuenta, inicia sesión con el mismo correo y la invitación
            será aceptada automáticamente.
          </p>

          <p style="font-size: 13px; color: #64748b;">
            Si no esperabas esta invitación, puedes ignorar este correo.
          </p>

          <p style="margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #64748b;">
            Tralixia es una plataforma desarrollada por RM Servicios de Ingeniería y Construcción.
          </p>
        </div>
      </div>
    `

    let data: { id: string } | null = null

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const result = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject: `Invitación a Tralixia - ${empresa.nombre}`,
        html,
      })

      if (result.error) {
        await registrarIntento('error', null, result.error.message)
        return NextResponse.json(
          { error: `Resend rechazó el correo de invitación: ${result.error.message}` },
          { status: 400 }
        )
      }

      data = result.data
      await registrarIntento('enviado', data?.id || null, null)
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Error desconocido de Resend.'

      if (!message.startsWith('No se pudo guardar la trazabilidad')) {
        await registrarIntento('error', null, message)
      }

      throw sendError
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      mensaje: 'Correo de invitación enviado correctamente.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo enviar el correo de invitación.',
      },
      { status: 500 }
    )
  }
}
