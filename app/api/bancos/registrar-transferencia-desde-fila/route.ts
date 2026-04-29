import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonError('Faltan variables de entorno Supabase.', 500)
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

    const filaId = String(body.filaId || '')
    const cuentaContraparteId = String(body.cuentaContraparteId || '')
    const descripcionBody =
      typeof body.descripcion === 'string' ? body.descripcion.trim() : ''

    if (!filaId) {
      return jsonError('Debes indicar la fila bancaria.', 400)
    }

    if (!cuentaContraparteId) {
      return jsonError('Debes seleccionar la cuenta contraparte de la transferencia.', 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const filaResp = await adminClient
      .from('banco_importacion_filas')
      .select(
        `
          id,
          empresa_id,
          cuenta_bancaria_id,
          fecha,
          descripcion_original,
          cargo,
          abono,
          estado,
          movimiento_id,
          transferencia_bancaria_id
        `
      )
      .eq('id', filaId)
      .maybeSingle()

    if (filaResp.error) {
      return jsonError(`No se pudo cargar la fila: ${filaResp.error.message}`, 500)
    }

    if (!filaResp.data) {
      return jsonError('No se encontró la fila bancaria.', 404)
    }

    const fila = filaResp.data

    const permisoResp = await adminClient
      .from('usuario_empresas')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', fila.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (permisoResp.error || !permisoResp.data) {
      return jsonError('No tienes permisos para registrar transferencias en esta empresa.', 403)
    }

    if (fila.movimiento_id) {
      return jsonError('Esta fila ya tiene un movimiento asociado. No puede convertirse en transferencia.', 400)
    }

    if (fila.transferencia_bancaria_id) {
      return jsonError('Esta fila ya tiene una transferencia asociada.', 400)
    }

    if (fila.estado === 'importada') {
      return jsonError('Esta fila ya fue importada.', 400)
    }

    const cuentaContraparteResp = await adminClient
      .from('cuentas_bancarias')
      .select('id, empresa_id, banco, nombre_cuenta, numero_cuenta, activa')
      .eq('id', cuentaContraparteId)
      .eq('empresa_id', fila.empresa_id)
      .eq('activa', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (cuentaContraparteResp.error) {
      return jsonError(
        `No se pudo validar la cuenta contraparte: ${cuentaContraparteResp.error.message}`,
        500
      )
    }

    if (!cuentaContraparteResp.data) {
      return jsonError('La cuenta contraparte no existe o no pertenece a la empresa activa.', 400)
    }

    const cargo = Number(fila.cargo || 0)
    const abono = Number(fila.abono || 0)
    const monto = abono > 0 ? abono : cargo

    if (!fila.fecha || monto <= 0) {
      return jsonError('La fila no tiene fecha o monto válido.', 400)
    }

    let cuentaOrigenId: string
    let cuentaDestinoId: string

    if (abono > 0) {
      cuentaOrigenId = cuentaContraparteId
      cuentaDestinoId = fila.cuenta_bancaria_id
    } else {
      cuentaOrigenId = fila.cuenta_bancaria_id
      cuentaDestinoId = cuentaContraparteId
    }

    if (cuentaOrigenId === cuentaDestinoId) {
      return jsonError('La cuenta origen y destino deben ser distintas.', 400)
    }

    const descripcion =
      descripcionBody ||
      `Transferencia interna - ${fila.descripcion_original}`

    const duplicadoResp = await adminClient
      .from('transferencias_bancarias')
      .select('id')
      .eq('empresa_id', fila.empresa_id)
      .eq('fecha', fila.fecha)
      .eq('cuenta_origen_id', cuentaOrigenId)
      .eq('cuenta_destino_id', cuentaDestinoId)
      .eq('monto', monto)
      .eq('estado', 'aplicada')
      .maybeSingle()

    if (duplicadoResp.error) {
      return jsonError(
        `No se pudo validar transferencia duplicada: ${duplicadoResp.error.message}`,
        500
      )
    }

    if (duplicadoResp.data?.id) {
      return jsonResponse(
        {
          error:
            'Ya existe una transferencia aplicada con la misma fecha, cuentas y monto.',
          transferenciaDuplicada: true,
          transferenciaId: duplicadoResp.data.id,
        },
        409
      )
    }

    const transferenciaResp = await adminClient
      .from('transferencias_bancarias')
      .insert({
        empresa_id: fila.empresa_id,
        fecha: fila.fecha,
        cuenta_origen_id: cuentaOrigenId,
        cuenta_destino_id: cuentaDestinoId,
        monto,
        descripcion,
        estado: 'aplicada',
      })
      .select('id')
      .single()

    if (transferenciaResp.error) {
      return jsonError(
        `No se pudo crear la transferencia bancaria: ${transferenciaResp.error.message}`,
        500
      )
    }

    const transferenciaId = transferenciaResp.data.id as string

    const updateFilaResp = await adminClient
      .from('banco_importacion_filas')
      .update({
        transferencia_bancaria_id: transferenciaId,
        tipo_registro: 'transferencia_interna',
        descripcion_editada: descripcion,
        estado: 'importada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', filaId)

    if (updateFilaResp.error) {
      return jsonError(
        `La transferencia fue creada, pero no se pudo actualizar la fila: ${updateFilaResp.error.message}`,
        500
      )
    }

    return jsonResponse({
      transferenciaId,
      filaId,
      estado: 'importada',
      tipoRegistro: 'transferencia_interna',
      monto,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo registrar la transferencia desde la fila bancaria.'

    return jsonError(message, 500)
  }
}