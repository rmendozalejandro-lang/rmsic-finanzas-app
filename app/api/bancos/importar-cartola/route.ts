import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCartolaExcel, type BancoFormato } from '../../../../lib/bancos/importadores'

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

    const formData = await request.formData()

    const file = formData.get('file')
    const cuentaBancariaId = String(formData.get('cuentaBancariaId') || '')
    const formato = String(formData.get('formato') || 'auto') as BancoFormato

    if (!file || !(file instanceof File)) {
      return jsonError('Debes adjuntar un archivo Excel.', 400)
    }

    if (!cuentaBancariaId) {
      return jsonError('Debes seleccionar una cuenta bancaria.', 400)
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

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const resultado = parseCartolaExcel({
      buffer,
      formato,
      cuentaBancariaId,
    })

    const hashes = resultado.filas.map((fila) => fila.hashMovimiento)

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

    const filas = resultado.filas.map((fila) => ({
      ...fila,
      esDuplicado: duplicatedHashes.has(fila.hashMovimiento),
      tipoSugerido: fila.abono > 0 ? 'ingreso' : 'egreso',
    }))

    return jsonResponse({
      cuenta,
      archivo: file.name,
      formatoDetectado: resultado.formatoDetectado,
      bancoDetectado: resultado.bancoDetectado,
      totalFilas: filas.length,
      totalDuplicadas: filas.filter((fila) => fila.esDuplicado).length,
      filas,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo importar la cartola.'
    return jsonError(message, 500)
  }
}