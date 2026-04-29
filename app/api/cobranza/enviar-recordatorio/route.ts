import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CuentaPorCobrar = {
  id: string
  empresa_id: string
  movimiento_id: string
  cliente_id: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  estado: string
}

type Cliente = {
  id: string
  nombre: string
  rut: string | null
  email: string | null
}

type Movimiento = {
  id: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
  observaciones: string | null
}

type ConfigCorreo = {
  nombre_remitente: string | null
  email_respuesta: string | null
  email_copia: string | null
  telefono_contacto: string | null
  sitio_web: string | null
  firma_correo: string | null
  texto_pie_correo: string | null
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

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function htmlLines(value: string | null | undefined) {
  return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

function getDocumentoLabel(movimiento: Movimiento | null) {
  const tipo = movimiento?.tipo_documento || 'Documento'
  const numero = movimiento?.numero_documento || 'Sin número'

  return `${tipo} N° ${numero}`
}

function getSenderEmail(fromValue: string) {
  const match = fromValue.match(/<([^>]+)>/)
  if (match?.[1]) return match[1].trim()

  return fromValue.trim()
}

function splitEmails(value: string | null | undefined) {
  return String(value ?? '')
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendApiKey = process.env.RESEND_API_KEY
    const resendFromEmail =
      process.env.RESEND_FROM_EMAIL || 'Auren <noreply@mail.rmsic.cl>'

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

    const body = await request.json()
    const cuentaPorCobrarId = String(body.cuentaPorCobrarId || '')
    const movimientoId = String(body.movimientoId || '')

    if (!cuentaPorCobrarId && !movimientoId) {
      return jsonError('Debes indicar la cuenta por cobrar o el movimiento.', 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    let cxcQuery = adminClient
      .from('cuentas_por_cobrar')
      .select(
        'id, empresa_id, movimiento_id, cliente_id, fecha_emision, fecha_vencimiento, monto_total, monto_pagado, saldo_pendiente, estado'
      )
      .eq('activo', true)
      .is('deleted_at', null)

    if (cuentaPorCobrarId) {
      cxcQuery = cxcQuery.eq('id', cuentaPorCobrarId)
    } else {
      cxcQuery = cxcQuery.eq('movimiento_id', movimientoId)
    }

    const cxcResp = await cxcQuery.maybeSingle()

    if (cxcResp.error) {
      return jsonError(`No se pudo cargar la cuenta por cobrar: ${cxcResp.error.message}`, 500)
    }

    if (!cxcResp.data) {
      return jsonError('No se encontró la cuenta por cobrar.', 404)
    }

    const cxc = cxcResp.data as CuentaPorCobrar

    const permisoResp = await adminClient
      .from('usuario_empresas')
      .select('id, rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', cxc.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (permisoResp.error || !permisoResp.data) {
      return jsonError('No tienes permisos para enviar recordatorios en esta empresa.', 403)
    }

    if (Number(cxc.saldo_pendiente || 0) <= 0 || cxc.estado === 'pagado') {
      return jsonError('La cuenta por cobrar no tiene saldo pendiente.', 400)
    }

    let cliente: Cliente | null = null

    if (cxc.cliente_id) {
      const clienteResp = await adminClient
        .from('clientes')
        .select('id, nombre, rut, email')
        .eq('id', cxc.cliente_id)
        .eq('empresa_id', cxc.empresa_id)
        .eq('activo', true)
        .is('deleted_at', null)
        .maybeSingle()

      if (clienteResp.error) {
        return jsonError(`No se pudo cargar el cliente: ${clienteResp.error.message}`, 500)
      }

      cliente = (clienteResp.data ?? null) as Cliente | null
    }

    if (!cliente?.email) {
      return jsonError('El cliente no tiene email registrado.', 400)
    }

    const movimientoResp = await adminClient
      .from('movimientos')
      .select('id, tipo_documento, numero_documento, descripcion, observaciones')
      .eq('id', cxc.movimiento_id)
      .eq('empresa_id', cxc.empresa_id)
      .maybeSingle()

    if (movimientoResp.error) {
      return jsonError(`No se pudo cargar el movimiento: ${movimientoResp.error.message}`, 500)
    }

    const movimiento = (movimientoResp.data ?? null) as Movimiento | null
    const documento = getDocumentoLabel(movimiento)

    const empresaResp = await adminClient
      .from('empresas')
      .select('id, nombre')
      .eq('id', cxc.empresa_id)
      .maybeSingle()

    const empresaNombre =
      empresaResp.data && 'nombre' in empresaResp.data
        ? String(empresaResp.data.nombre || 'Auren')
        : 'Auren'

    const configResp = await adminClient
      .from('empresa_config_correo')
      .select(
        'nombre_remitente, email_respuesta, email_copia, telefono_contacto, sitio_web, firma_correo, texto_pie_correo, activo'
      )
      .eq('empresa_id', cxc.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    const config = (configResp.data ?? null) as ConfigCorreo | null

    const nombreRemitente =
      config?.nombre_remitente?.trim() || `${empresaNombre} Cobranzas`

    const senderEmail = getSenderEmail(resendFromEmail)
    const from = `${nombreRemitente} <${senderEmail}>`

    const replyTo = config?.email_respuesta?.trim() || undefined
    const cc = splitEmails(config?.email_copia)

    const firma =
      config?.firma_correo?.trim() ||
      `Área de Administración y Finanzas\n${empresaNombre}`

    const pieCorreo =
      config?.texto_pie_correo?.trim() ||
      'Correo enviado automáticamente desde Auren, sistema de gestión financiera de la empresa.'

    const telefono = config?.telefono_contacto?.trim()
    const sitioWeb = config?.sitio_web?.trim()

    const asunto = `Recordatorio de pago - ${documento} - ${empresaNombre}`

    const contactoHtml = [
      telefono ? `<p style="margin: 4px 0;">Teléfono: ${escapeHtml(telefono)}</p>` : '',
      sitioWeb ? `<p style="margin: 4px 0;">Sitio web: ${escapeHtml(sitioWeb)}</p>` : '',
    ].filter(Boolean).join('')

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Recordatorio de pago</h2>

        <p>Estimado/a ${escapeHtml(cliente.nombre)},</p>

        <p>
          Junto con saludar, recordamos que mantiene un documento pendiente de pago con
          <strong>${escapeHtml(empresaNombre)}</strong>.
        </p>

        <table style="border-collapse: collapse; width: 100%; max-width: 620px; margin: 16px 0;">
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Documento</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(documento)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Descripción</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(movimiento?.descripcion || '-')}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Fecha emisión</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${formatDate(cxc.fecha_emision)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Fecha vencimiento</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${formatDate(cxc.fecha_vencimiento)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Monto total</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${formatCurrency(cxc.monto_total)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Monto pagado</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${formatCurrency(cxc.monto_pagado)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;"><strong>Saldo pendiente</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;"><strong>${formatCurrency(cxc.saldo_pendiente)}</strong></td>
          </tr>
        </table>

        <p>
          Agradecemos regularizar el pago o contactarnos en caso de existir alguna observación.
        </p>

        <p style="margin-top: 20px;">
          Saludos cordiales,<br />
          ${htmlLines(firma)}
        </p>

        ${contactoHtml}

        <p style="margin-top: 20px; color: #64748b; font-size: 12px;">
          ${htmlLines(pieCorreo)}
        </p>
      </div>
    `

    const text = [
      'Recordatorio de pago',
      '',
      `Cliente: ${cliente.nombre}`,
      `Empresa: ${empresaNombre}`,
      `Documento: ${documento}`,
      `Descripción: ${movimiento?.descripcion || '-'}`,
      `Fecha emisión: ${formatDate(cxc.fecha_emision)}`,
      `Fecha vencimiento: ${formatDate(cxc.fecha_vencimiento)}`,
      `Monto total: ${formatCurrency(cxc.monto_total)}`,
      `Monto pagado: ${formatCurrency(cxc.monto_pagado)}`,
      `Saldo pendiente: ${formatCurrency(cxc.saldo_pendiente)}`,
      '',
      'Agradecemos regularizar el pago o contactarnos en caso de existir alguna observación.',
      '',
      firma,
      telefono ? `Teléfono: ${telefono}` : '',
      sitioWeb ? `Sitio web: ${sitioWeb}` : '',
      '',
      pieCorreo,
    ].filter(Boolean).join('\n')

    const emailPayload: Record<string, unknown> = {
      from,
      to: [cliente.email],
      subject: asunto,
      html,
      text,
    }

    if (replyTo) {
      emailPayload.reply_to = replyTo
    }

    if (cc.length > 0) {
      emailPayload.cc = cc
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const resendJson = await resendResp.json().catch(() => null)

    await adminClient.from('cobranza_recordatorios').insert({
      empresa_id: cxc.empresa_id,
      cuenta_por_cobrar_id: cxc.id,
      movimiento_id: cxc.movimiento_id,
      cliente_id: cxc.cliente_id,
      destinatario: cliente.email,
      asunto,
      estado: resendResp.ok ? 'enviado' : 'error',
      error: resendResp.ok ? null : JSON.stringify(resendJson),
      enviado_por: user.id,
    })

    if (!resendResp.ok) {
      return jsonError(
        resendJson?.message || resendJson?.error || 'No se pudo enviar el correo por Resend.',
        500
      )
    }

    return jsonResponse({
      ok: true,
      destinatario: cliente.email,
      asunto,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo enviar el recordatorio de cobranza.'

    return jsonError(message, 500)
  }
}