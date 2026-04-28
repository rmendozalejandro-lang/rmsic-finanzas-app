import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

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
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar RESEND_API_KEY.' },
        { status: 500 }
      )
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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'

    const registroUrl = `${appUrl.replace(/\/$/, '')}/registro`
    const rolLabel = ROLE_LABELS[rol] || rol
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || 'Auren <onboarding@resend.dev>'

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 620px; margin: 0 auto;">
        <div style="background: #163A5F; color: white; padding: 24px; border-radius: 18px 18px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Auren</h1>
          <p style="margin: 8px 0 0;">Invitación a plataforma empresarial</p>
        </div>

        <div style="border: 1px solid #e2e8f0; border-top: 0; padding: 24px; border-radius: 0 0 18px 18px;">
          <p>Hola,</p>

          <p>
            Has sido invitado a participar en la plataforma <strong>Auren</strong>
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
        </div>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `Invitación a Auren - ${empresa.nombre}`,
      html,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
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