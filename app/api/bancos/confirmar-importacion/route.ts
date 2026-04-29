import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FilaPreview = {
  filaOrigen: number
  fecha: string
  sucursal: string | null
  numeroDocumento: string | null
  descripcionOriginal: string
  rutDetectado: string | null
  nombreDetectado: string | null
  cargo: number
  abono: number
  saldo: number | null
  tipoDetectado: 'cargo' | 'abono'
  tipoSugerido: 'ingreso' | 'egreso'
  hashMovimiento: string
  esDuplicado: boolean
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

    const cuentaBancariaId = String(body.cuentaBancariaId || '')
    const archivo = String(body.archivo || 'cartola.xlsx')
    const bancoDetectado = String(body.bancoDetectado || '')
    const formatoDetectado = String(body.formatoDetectado || '')
    const filas = (body.filas || []) as FilaPreview[]

    if (!cuentaBancariaId) {
      return jsonError('Debes indicar la cuenta bancaria.', 400)
    }

    if (!Array.isArray(filas) || filas.length === 0) {
      return jsonError('No hay filas para importar.', 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const cuentaResp = await adminClient
      .from('cuentas_bancarias')
      .select('id, empresa_id, banco, nombre_cuenta, numero_cuenta, moneda, activa')
      .eq('id', cuentaBancariaId)
      .is('deleted_at', null)
      .maybeSingle()

    if (cuentaResp.error) {
      return jsonError(`No se pudo cargar la cuenta bancaria: ${cuentaResp.error.message}`, 500)
    }

    if (!cuentaResp.data) {
      return jsonError('No se encontró la cuenta bancaria seleccionada.', 404)
    }

    const cuenta = cuentaResp.data

    const permisoResp = await adminClient
      .from('usuario_empresas')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', cuenta.empresa_id)
      .eq('activo', true)
      .maybeSingle()

    if (permisoResp.error || !permisoResp.data) {
      return jsonError('No tienes permisos para importar cartolas en esta empresa.', 403)
    }

    const hashes = filas.map((fila) => fila.hashMovimiento).filter(Boolean)

    let duplicatedHashes = new Set<string>()

    if (hashes.length > 0) {
      const duplicadosResp = await adminClient
        .from('banco_importacion_filas')
        .select('hash_movimiento')
        .eq('empresa_id', cuenta.empresa_id)
        .eq('cuenta_bancaria_id', cuentaBancariaId)
        .in('hash_movimiento', hashes)

      if (duplicadosResp.error) {
        return jsonError(
          `No se pudieron validar duplicados: ${duplicadosResp.error.message}`,
          500
        )
      }

      duplicatedHashes = new Set(
        (duplicadosResp.data ?? []).map((item) => item.hash_movimiento as string)
      )
    }

    const filasValidas = filas.filter(
      (fila) =>
        fila.hashMovimiento &&
        !fila.esDuplicado &&
        !duplicatedHashes.has(fila.hashMovimiento)
    )

    const importacionResp = await adminClient
      .from('banco_importaciones')
      .insert({
        empresa_id: cuenta.empresa_id,
        cuenta_bancaria_id: cuentaBancariaId,
        banco: bancoDetectado || cuenta.banco || 'No identificado',
        formato: formatoDetectado || 'auto',
        nombre_archivo: archivo,
        total_filas: filas.length,
        total_validas: filasValidas.length,
        total_duplicadas: filas.length - filasValidas.length,
        total_importadas: 0,
        estado: 'pendiente_revision',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (importacionResp.error) {
      return jsonError(
        `No se pudo crear la importación: ${importacionResp.error.message}`,
        500
      )
    }

    const importacionId = importacionResp.data.id as string

    if (filasValidas.length > 0) {
      const filasInsert = filasValidas.map((fila) => ({
        importacion_id: importacionId,
        empresa_id: cuenta.empresa_id,
        cuenta_bancaria_id: cuentaBancariaId,

        fila_origen: fila.filaOrigen,
        fecha: fila.fecha,
        sucursal: fila.sucursal,
        numero_documento: fila.numeroDocumento,
        descripcion_original: fila.descripcionOriginal,

        rut_detectado: fila.rutDetectado,
        nombre_detectado: fila.nombreDetectado,

        cargo: fila.cargo || 0,
        abono: fila.abono || 0,
        saldo: fila.saldo,

        tipo_detectado: fila.tipoDetectado,
        tipo_sugerido: fila.tipoSugerido,

        hash_movimiento: fila.hashMovimiento,
        es_duplicado: false,

        estado: 'pendiente',
      }))

      const filasResp = await adminClient
        .from('banco_importacion_filas')
        .insert(filasInsert)

      if (filasResp.error) {
        return jsonError(
          `No se pudieron guardar las filas importadas: ${filasResp.error.message}`,
          500
        )
      }
    }

    return jsonResponse({
      importacionId,
      totalFilas: filas.length,
      totalGuardadas: filasValidas.length,
      totalDuplicadas: filas.length - filasValidas.length,
      estado: 'pendiente_revision',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo confirmar la importación.'
    return jsonError(message, 500)
  }
}