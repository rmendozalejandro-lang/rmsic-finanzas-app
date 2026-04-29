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

    if (!filaId) {
      return jsonError('Debes indicar la fila bancaria a convertir.', 400)
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
          numero_documento,
          descripcion_original,
          cargo,
          abono,
          tipo_sugerido,
          estado,
          movimiento_id
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
      return jsonError('No tienes permisos para crear movimientos en esta empresa.', 403)
    }

    if (fila.movimiento_id) {
      return jsonError('Esta fila ya tiene un movimiento asociado.', 400)
    }

    if (fila.estado === 'importada') {
      return jsonError('Esta fila ya fue importada.', 400)
    }

    const cargo = Number(fila.cargo || 0)
    const abono = Number(fila.abono || 0)
    const montoTotal = abono > 0 ? abono : cargo
    const tipoMovimiento = abono > 0 ? 'ingreso' : 'egreso'

    if (!fila.fecha || montoTotal <= 0) {
      return jsonError('La fila no tiene fecha o monto válido.', 400)
    }

    const movimientoResp = await adminClient
      .from('movimientos')
      .insert({
        empresa_id: fila.empresa_id,
        tipo_movimiento: tipoMovimiento,
        fecha: fila.fecha,
        fecha_vencimiento: null,

        tercero_tipo: null,
        cliente_id: null,
        proveedor_id: null,
        categoria_id: null,
        centro_costo_id: null,
        cuenta_contable_id: null,
        cuenta_bancaria_id: fila.cuenta_bancaria_id,

        tipo_documento: null,
        numero_documento: fila.numero_documento,
        descripcion: fila.descripcion_original,

        monto_neto: 0,
        monto_iva: 0,
        monto_exento: montoTotal,
        monto_total: montoTotal,

        estado: 'pendiente',
        medio_pago: 'transferencia',
        observaciones: 'Movimiento creado desde importación de cartola bancaria. Origen: cartola Excel importada.',

        impuesto_especifico: 0,
        tratamiento_tributario: 'exento',

        activo: true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single()

    if (movimientoResp.error) {
      return jsonError(
        `No se pudo crear el movimiento: ${movimientoResp.error.message}`,
        500
      )
    }

    const movimientoId = movimientoResp.data.id as string

    const updateFilaResp = await adminClient
      .from('banco_importacion_filas')
      .update({
        movimiento_id: movimientoId,
        estado: 'importada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', filaId)

    if (updateFilaResp.error) {
      return jsonError(
        `El movimiento fue creado, pero no se pudo actualizar la fila: ${updateFilaResp.error.message}`,
        500
      )
    }

    return jsonResponse({
      movimientoId,
      filaId,
      tipoMovimiento,
      montoTotal,
      estado: 'importada',
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo crear el movimiento desde la fila bancaria.'

    return jsonError(message, 500)
  }
}