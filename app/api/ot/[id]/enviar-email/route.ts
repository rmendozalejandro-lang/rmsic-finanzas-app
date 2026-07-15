import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OTEmailDetalle = {
  id: string
  empresa_id: string
  cliente_id: string
  folio: string | null
  titulo: string | null
  numero_om_cliente: string | null
  contacto_cliente_id: string | null
  contacto_cliente_email: string | null
  contacto_cliente_nombre: string | null
  contacto_cliente_cargo: string | null
}

type ClienteContacto = {
  id: string
  cliente_id: string
  nombre: string
  cargo: string | null
  area: string | null
  linea: string | null
  email: string | null
  telefono: string | null
  tipo_contacto: string | null
  recibe_informes_ot: boolean | null
  activo: boolean | null
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

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getSenderEmail(fromValue: string) {
  const match = fromValue.match(/<([^>]+)>/)
  if (match?.[1]) return match[1].trim()

  return fromValue.trim()
}

async function registrarEnvio(params: {
  adminClient: SupabaseClient
  empresaId: string
  otId: string
  contactoClienteId: string | null
  destinatarioNombre: string | null
  destinatarioCargo: string | null
  destinatarioEmail: string
  asunto: string
  folioOt: string | null
  numeroOmCliente: string | null
  estado: 'enviado' | 'error'
  proveedorMessageId?: string | null
  errorMensaje?: string | null
  enviadoPor: string
}) {
  const { error } = await params.adminClient.from('ot_envios_email').insert({
    empresa_id: params.empresaId,
    ot_id: params.otId,
    contacto_cliente_id: params.contactoClienteId,
    destinatario_nombre: params.destinatarioNombre,
    destinatario_cargo: params.destinatarioCargo,
    destinatario_email: params.destinatarioEmail,
    asunto: params.asunto,
    folio_ot: params.folioOt,
    numero_om_cliente: params.numeroOmCliente,
    estado: params.estado,
    proveedor_email: 'resend',
    proveedor_message_id: params.proveedorMessageId || null,
    error_mensaje: params.errorMensaje || null,
    enviado_at: new Date().toISOString(),
    enviado_por: params.enviadoPor,
  })

  return error
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: otId } = await context.params

    if (!otId) {
      return jsonError('No se recibió el identificador de la OM.', 400)
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendApiKey = process.env.RESEND_API_KEY
    const resendFromEmail =
      process.env.RESEND_FROM_EMAIL || 'Tralixia <notificaciones@tralixia.app>'

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonError('Faltan variables de entorno Supabase.', 500)
    }

    if (!resendApiKey) {
      return jsonError('Falta RESEND_API_KEY.', 500)
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) {
      return jsonError('No autorizado.', 401)
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return jsonError('Sesión no válida.', 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const otResp = await adminClient
      .from('ot_ordenes_trabajo')
      .select(
        'id, empresa_id, cliente_id, folio, titulo, numero_om_cliente, contacto_cliente_id, contacto_cliente_email, contacto_cliente_nombre, contacto_cliente_cargo'
      )
      .eq('id', otId)
      .eq('activo', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (otResp.error) {
      return jsonError(`No se pudo cargar la OM: ${otResp.error.message}`, 500)
    }

    if (!otResp.data) {
      return jsonError('No se encontró la OM o fue archivada.', 404)
    }

    const ot = otResp.data as OTEmailDetalle

    const permisoResp = await adminClient
      .from('usuario_empresas')
      .select('id, rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', ot.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (permisoResp.error || !permisoResp.data) {
      return jsonError('No tienes permisos para enviar informes de esta empresa.', 403)
    }

    const rolesPermitidosEnvio = new Set([
      'super_admin',
      'admin',
      'administrador',
      'admin_empresa',
      'admin_operacional',
      'supervisor',
      'supervisor_ot',
      'jefe_ot',
      'jefe_mantenimiento',
      'responsable_ot',
    ])

    const rolUsuario = String(permisoResp.data.rol || '').toLowerCase().trim()

    if (!rolesPermitidosEnvio.has(rolUsuario)) {
      return jsonError(
        'Solo administradores o supervisores pueden enviar informes por email.',
        403
      )
    }

    if (!ot.contacto_cliente_id) {
      return jsonError(
        'La OM no tiene un contacto de cliente seleccionado desde la base de datos.',
        400
      )
    }

    const contactoResp = await adminClient
      .from('cliente_contactos')
      .select(
        'id, cliente_id, nombre, cargo, area, linea, email, telefono, tipo_contacto, recibe_informes_ot, activo'
      )
      .eq('id', ot.contacto_cliente_id)
      .eq('empresa_id', ot.empresa_id)
      .eq('cliente_id', ot.cliente_id)
      .maybeSingle()

    if (contactoResp.error) {
      return jsonError(`No se pudo cargar el contacto: ${contactoResp.error.message}`, 500)
    }

    if (!contactoResp.data) {
      return jsonError('No se encontró el contacto seleccionado para esta OM.', 404)
    }

    const contacto = contactoResp.data as ClienteContacto

    if (contacto.activo === false) {
      return jsonError('El contacto seleccionado está inactivo.', 400)
    }

    if (contacto.recibe_informes_ot === false) {
      return jsonError('El contacto seleccionado no está habilitado para recibir informes OM.', 400)
    }

    const destinatarioEmail = (contacto.email || ot.contacto_cliente_email || '').trim()

    if (!destinatarioEmail) {
      return jsonError('El contacto seleccionado no tiene email registrado.', 400)
    }

    const empresaResp = await adminClient
      .from('empresas')
      .select('id, nombre')
      .eq('id', ot.empresa_id)
      .maybeSingle()

    const empresaNombre =
      empresaResp.data && 'nombre' in empresaResp.data
        ? String(empresaResp.data.nombre || 'Tralixia')
        : 'Tralixia'

    const folioLabel = ot.folio || 'Sin folio'
    const numeroOmLabel = ot.numero_om_cliente || 'Sin N° OM cliente'
    const asunto = `Informe técnico ${numeroOmLabel} - ${folioLabel}`
    const senderEmail = getSenderEmail(resendFromEmail)
    const from = `${empresaNombre} - Informes técnicos <${senderEmail}>`

    const pdfUrl = new URL(`/api/ot-pdf/${otId}`, request.url).toString()
    const pdfResp = await fetch(pdfUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!pdfResp.ok) {
      const pdfError = await pdfResp.text().catch(() => '')
      const errorMensaje = pdfError || 'No se pudo generar el PDF del informe OM.'

      await registrarEnvio({
        adminClient,
        empresaId: ot.empresa_id,
        otId,
        contactoClienteId: contacto.id,
        destinatarioNombre: contacto.nombre,
        destinatarioCargo: contacto.cargo,
        destinatarioEmail,
        asunto,
        folioOt: ot.folio,
        numeroOmCliente: ot.numero_om_cliente,
        estado: 'error',
        errorMensaje,
        enviadoPor: user.id,
      })

      return jsonError(errorMensaje, 500)
    }

    const pdfArrayBuffer = await pdfResp.arrayBuffer()
    const pdfBase64 = Buffer.from(pdfArrayBuffer).toString('base64')
    const safeFolio = (ot.folio || 'om').replace(/[^\w.-]+/g, '_')

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; max-width: 680px; margin: 0 auto;">
        <div style="background: #163A5F; color: white; padding: 22px; border-radius: 16px 16px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Informe técnico</h1>
          <p style="margin: 6px 0 0;">${escapeHtml(empresaNombre)}</p>
        </div>

        <div style="border: 1px solid #e2e8f0; border-top: 0; padding: 22px; border-radius: 0 0 16px 16px;">
          <p>Estimado/a ${escapeHtml(contacto.nombre)},</p>

          <p>
            Junto con saludar, se adjunta informe técnico correspondiente al trabajo realizado.
          </p>

          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Folio Tralixia</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(folioLabel)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>N° orden cliente</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(numeroOmLabel)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Trabajo</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(ot.titulo || '-')}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Contacto</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(contacto.nombre)}${contacto.cargo ? ` - ${escapeHtml(contacto.cargo)}` : ''}</td>
            </tr>
          </table>

          <p style="font-size: 13px; color: #64748b;">
            Este correo fue generado desde Tralixia. El envío queda registrado con fecha, hora, contacto y usuario responsable para respaldo futuro.
          </p>
        </div>
      </div>
    `

    const text = [
      'Informe técnico',
      '',
      `Empresa: ${empresaNombre}`,
      `Folio: ${folioLabel}`,
      `N° orden cliente: ${numeroOmLabel}`,
      `Trabajo: ${ot.titulo || '-'}`,
      `Contacto: ${contacto.nombre}${contacto.cargo ? ` - ${contacto.cargo}` : ''}`,
      '',
      'Se adjunta informe técnico en PDF.',
      '',
      'Correo generado desde Tralixia. El envío queda registrado como respaldo.',
    ].join('\n')

    const resendPayload = {
      from,
      to: [destinatarioEmail],
      subject: asunto,
      html,
      text,
      attachments: [
        {
          filename: `${safeFolio}.pdf`,
          content: pdfBase64,
        },
      ],
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })

    const resendJson = await resendResp.json().catch(() => null)
    const proveedorMessageId =
      resendJson?.id || resendJson?.data?.id || resendJson?.message_id || null

    const registroError = await registrarEnvio({
      adminClient,
      empresaId: ot.empresa_id,
      otId,
      contactoClienteId: contacto.id,
      destinatarioNombre: contacto.nombre,
      destinatarioCargo: contacto.cargo,
      destinatarioEmail,
      asunto,
      folioOt: ot.folio,
      numeroOmCliente: ot.numero_om_cliente,
      estado: resendResp.ok ? 'enviado' : 'error',
      proveedorMessageId,
      errorMensaje: resendResp.ok
        ? null
        : resendJson?.message || resendJson?.error || JSON.stringify(resendJson),
      enviadoPor: user.id,
    })

    if (registroError) {
      return jsonError(
        `El correo ${resendResp.ok ? 'se envió' : 'falló'}, pero no se pudo registrar el historial: ${registroError.message}`,
        500
      )
    }

    if (!resendResp.ok) {
      return jsonError(
        resendJson?.message || resendJson?.error || 'No se pudo enviar el informe por Resend.',
        500
      )
    }

    await adminClient
      .from('ot_ordenes_trabajo')
      .update({
        contacto_cliente_email: destinatarioEmail,
        contacto_cliente_nombre: contacto.nombre,
        contacto_cliente_cargo: contacto.cargo || null,
      })
      .eq('id', otId)
      .eq('empresa_id', ot.empresa_id)

    return jsonResponse({
      ok: true,
      destinatario: destinatarioEmail,
      contacto: contacto.nombre,
      asunto,
      proveedorMessageId,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo enviar el informe.'

    return jsonError(message, 500)
  }
}
