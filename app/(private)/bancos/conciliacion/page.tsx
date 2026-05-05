'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Banco = {
  id: string
  banco: string | null
  nombre_cuenta: string | null
  numero_cuenta: string | null
  tipo_cuenta: string | null
  moneda: string | null
}

type Sugerencia = {
  fila_banco_id: string
  empresa_id: string
  cuenta_bancaria_id: string
  fecha_banco: string | null
  descripcion_original: string
  documento_banco: string | null
  cargo: number | string
  abono: number | string
  tipo_banco: string
  monto_banco: number | string
  movimiento_id: string
  fecha_movimiento: string | null
  tipo_movimiento: string
  documento_movimiento: string | null
  descripcion_movimiento: string | null
  monto_total: number | string
  dias_diferencia: number
  puntaje: number
}

type FilaBanco = {
  id: string
  empresa_id: string
  cuenta_bancaria_id: string
  fecha: string | null
  descripcion_original: string
  numero_documento: string | null
  cargo: number | string
  abono: number | string
  estado: string
  movimiento_id: string | null
  conciliado_at: string | null
  conciliacion_tipo: string | null
  diferencia_conciliacion: number | string | null
}

type Movimiento = {
  id: string
  fecha: string | null
  tipo_movimiento: string
  numero_documento: string | null
  descripcion: string | null
  monto_total: number | string
  estado: string
  cuenta_bancaria_id: string | null
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function formatCLP(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value

  return `${day}-${month}-${year}`
}

function getBancoLabel(banco: Banco | undefined) {
  if (!banco) return 'Cuenta no identificada'

  const nombreCuenta = banco.nombre_cuenta || 'Cuenta bancaria'
  const bancoNombre = banco.banco ? ` - ${banco.banco}` : ''
  const numeroCuenta = banco.numero_cuenta ? ` - ${banco.numero_cuenta}` : ''
  const tipoCuenta = banco.tipo_cuenta ? ` - ${banco.tipo_cuenta}` : ''
  const moneda = banco.moneda ? ` (${banco.moneda})` : ''

  return `${nombreCuenta}${bancoNombre}${numeroCuenta}${tipoCuenta}${moneda}`
}

export default function ConciliacionBancariaPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [bancos, setBancos] = useState<Banco[]>([])
  const [cuentaFiltro, setCuentaFiltro] = useState('')
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [pendientes, setPendientes] = useState<FilaBanco[]>([])
  const [conciliadas, setConciliadas] = useState<FilaBanco[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [pendientesCount, setPendientesCount] = useState(0)
  const [conciliadasCount, setConciliadasCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const cargarEmpresaActiva = useCallback(() => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)
  }, [])

  const bancosPorId = useMemo(() => {
    const map = new Map<string, Banco>()

    for (const banco of bancos) {
      map.set(banco.id, banco)
    }

    return map
  }, [bancos])

  const movimientosPorId = useMemo(() => {
    const map = new Map<string, Movimiento>()

    for (const movimiento of movimientos) {
      map.set(movimiento.id, movimiento)
    }

    return map
  }, [movimientos])

  const cargarDatos = useCallback(async () => {
    if (!empresaActivaId) {
      setBancos([])
      setSugerencias([])
      setPendientes([])
      setConciliadas([])
      setMovimientos([])
      setPendientesCount(0)
      setConciliadasCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const bancosResp = await supabase
      .from('cuentas_bancarias')
      .select(`
        id,
        banco,
        nombre_cuenta,
        numero_cuenta,
        tipo_cuenta,
        moneda
      `)
      .eq('empresa_id', empresaActivaId)
      .eq('activa', true)
      .is('deleted_at', null)
      .order('nombre_cuenta', { ascending: true })

    if (bancosResp.error) {
      setError(`Error al cargar cuentas bancarias: ${bancosResp.error.message}`)
      setLoading(false)
      return
    }

    setBancos((bancosResp.data ?? []) as Banco[])

    let sugerenciasQuery = supabase
      .from('v_conciliacion_bancaria_sugerencias')
      .select(`
        fila_banco_id,
        empresa_id,
        cuenta_bancaria_id,
        fecha_banco,
        descripcion_original,
        documento_banco,
        cargo,
        abono,
        tipo_banco,
        monto_banco,
        movimiento_id,
        fecha_movimiento,
        tipo_movimiento,
        documento_movimiento,
        descripcion_movimiento,
        monto_total,
        dias_diferencia,
        puntaje
      `)
      .eq('empresa_id', empresaActivaId)
      .order('puntaje', { ascending: false })
      .order('dias_diferencia', { ascending: true })
      .order('fecha_banco', { ascending: false })
      .limit(30)

    if (cuentaFiltro) {
      sugerenciasQuery = sugerenciasQuery.eq('cuenta_bancaria_id', cuentaFiltro)
    }

    const sugerenciasResp = await sugerenciasQuery

    if (sugerenciasResp.error) {
      setError(`Error al cargar sugerencias: ${sugerenciasResp.error.message}`)
      setLoading(false)
      return
    }

    setSugerencias((sugerenciasResp.data ?? []) as Sugerencia[])

    let pendientesQuery = supabase
      .from('banco_importacion_filas')
      .select(
        `
        id,
        empresa_id,
        cuenta_bancaria_id,
        fecha,
        descripcion_original,
        numero_documento,
        cargo,
        abono,
        estado,
        movimiento_id,
        conciliado_at,
        conciliacion_tipo,
        diferencia_conciliacion
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaActivaId)
      .is('movimiento_id', null)
      .neq('estado', 'omitida')
      .eq('es_duplicado', false)
      .eq('tipo_registro', 'movimiento')
      .order('fecha', { ascending: false })
      .limit(30)

    if (cuentaFiltro) {
      pendientesQuery = pendientesQuery.eq('cuenta_bancaria_id', cuentaFiltro)
    }

    const pendientesResp = await pendientesQuery

    if (pendientesResp.error) {
      setError(`Error al cargar pendientes: ${pendientesResp.error.message}`)
      setLoading(false)
      return
    }

    setPendientes((pendientesResp.data ?? []) as FilaBanco[])
    setPendientesCount(pendientesResp.count ?? 0)

    let conciliadasQuery = supabase
      .from('banco_importacion_filas')
      .select(
        `
        id,
        empresa_id,
        cuenta_bancaria_id,
        fecha,
        descripcion_original,
        numero_documento,
        cargo,
        abono,
        estado,
        movimiento_id,
        conciliado_at,
        conciliacion_tipo,
        diferencia_conciliacion
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaActivaId)
      .eq('estado', 'conciliada')
      .not('movimiento_id', 'is', null)
      .order('conciliado_at', { ascending: false })
      .limit(20)

    if (cuentaFiltro) {
      conciliadasQuery = conciliadasQuery.eq('cuenta_bancaria_id', cuentaFiltro)
    }

    const conciliadasResp = await conciliadasQuery

    if (conciliadasResp.error) {
      setError(`Error al cargar conciliadas: ${conciliadasResp.error.message}`)
      setLoading(false)
      return
    }

    const conciliadasData = (conciliadasResp.data ?? []) as FilaBanco[]
    setConciliadas(conciliadasData)
    setConciliadasCount(conciliadasResp.count ?? 0)

    const movimientosIds = conciliadasData
      .map((fila) => fila.movimiento_id)
      .filter((id): id is string => Boolean(id))

    if (movimientosIds.length > 0) {
      const movimientosResp = await supabase
        .from('movimientos')
        .select(`
          id,
          fecha,
          tipo_movimiento,
          numero_documento,
          descripcion,
          monto_total,
          estado,
          cuenta_bancaria_id
        `)
        .in('id', movimientosIds)

      if (movimientosResp.error) {
        setError(`Error al cargar movimientos: ${movimientosResp.error.message}`)
        setLoading(false)
        return
      }

      setMovimientos((movimientosResp.data ?? []) as Movimiento[])
    } else {
      setMovimientos([])
    }

    setLoading(false)
  }, [empresaActivaId, cuentaFiltro])

  useEffect(() => {
    cargarEmpresaActiva()

    window.addEventListener('empresa-activa-cambiada', cargarEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', cargarEmpresaActiva)
    }
  }, [cargarEmpresaActiva])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const conciliarSugerencia = async (sugerencia: Sugerencia) => {
    const confirmar = window.confirm(
      `¿Conciliar esta sugerencia por ${formatCLP(
        sugerencia.monto_banco
      )}?`
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'conciliar_movimiento_bancario',
      {
        p_fila_id: sugerencia.fila_banco_id,
        p_movimiento_id: sugerencia.movimiento_id,
        p_observacion: 'Conciliación manual desde pantalla de conciliación',
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    setSuccess('Movimiento conciliado correctamente.')
    await cargarDatos()
    setProcessing(false)
  }

  const conciliarExactas = async () => {
    const confirmar = window.confirm(
      '¿Conciliar automáticamente las coincidencias exactas? Solo se tomarán sugerencias no ambiguas con misma fecha, monto, tipo y cuenta bancaria.'
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { data, error: rpcError } = await supabase.rpc(
      'conciliar_sugerencias_bancarias_exactas',
      {
        p_empresa_id: empresaActivaId || null,
        p_cuenta_bancaria_id: cuentaFiltro || null,
        p_limite: 50,
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    const conciliadasOk = (data ?? []).filter(
      (item: { resultado: string }) => item.resultado === 'conciliada'
    ).length

    setSuccess(`Conciliación automática finalizada. Registros conciliados: ${conciliadasOk}.`)
    await cargarDatos()
    setProcessing(false)
  }

  const reversarConciliacion = async (fila: FilaBanco) => {
    const confirmar = window.confirm(
      '¿Reversar esta conciliación? La línea bancaria volverá a estado pendiente.'
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'reversar_conciliacion_bancaria',
      {
        p_fila_id: fila.id,
        p_observacion: 'Conciliación reversada desde pantalla de conciliación',
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    setSuccess('Conciliación reversada correctamente.')
    await cargarDatos()
    setProcessing(false)
  }
const crearMovimientoSimple = async (fila: FilaBanco) => {
  const monto = Number(fila.cargo ?? 0) > 0 ? fila.cargo : fila.abono

  const confirmar = window.confirm(
    `¿Crear movimiento simple no afecto por ${formatCLP(
      monto
    )}? Esta opción debe usarse solo para comisiones, intereses, cargos bancarios, ajustes o movimientos no tributarios.`
  )

  if (!confirmar) return

  const descripcion = window.prompt(
    'Descripción del movimiento:',
    fila.descripcion_original
  )

  if (descripcion === null) return

  setProcessing(true)
  setError('')
  setSuccess('')

  const { error: rpcError } = await supabase.rpc(
    'crear_movimiento_simple_desde_fila_bancaria',
    {
      p_fila_id: fila.id,
      p_descripcion: descripcion,
    }
  )

  if (rpcError) {
    setError(rpcError.message)
    setProcessing(false)
    return
  }

  setSuccess('Movimiento simple creado y conciliado correctamente.')
  await cargarDatos()
  setProcessing(false)
}
  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Bancos
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Conciliación bancaria
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Empresa activa:{' '}
            <span className="font-medium text-slate-900">
              {empresaActivaNombre || 'Sin empresa activa'}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading || processing}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Actualizar
          </button>

          <button
            type="button"
            onClick={conciliarExactas}
            disabled={loading || processing || sugerencias.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {processing ? 'Procesando...' : 'Conciliar exactas'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Cuenta bancaria
        </label>

        <select
          value={cuentaFiltro}
          onChange={(event) => setCuentaFiltro(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 md:max-w-xl"
        >
          <option value="">Todas las cuentas</option>

          {bancos.map((banco) => (
            <option key={banco.id} value={banco.id}>
              {getBancoLabel(banco)}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes cartola</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {pendientesCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Sugerencias visibles</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {sugerencias.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Conciliadas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {conciliadasCount}
          </p>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando conciliación bancaria...
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {success ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">
          {success}
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Sugerencias automáticas
            </h2>
            <p className="text-sm text-slate-500">
              Coincidencias entre cartola bancaria y movimientos internos por cuenta, tipo, monto y fecha cercana.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {sugerencias.length > 0 ? (
              sugerencias.map((sugerencia) => (
                <div
                  key={`${sugerencia.fila_banco_id}-${sugerencia.movimiento_id}`}
                  className="rounded-2xl border p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase text-slate-500">
                        Cartola banco
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {sugerencia.descripcion_original}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(sugerencia.fecha_banco)} · {sugerencia.tipo_banco}
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCLP(sugerencia.monto_banco)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs font-medium uppercase text-blue-700">
                        Movimiento Auren
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {sugerencia.descripcion_movimiento || 'Sin descripción'}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(sugerencia.fecha_movimiento)} · Doc:{' '}
                        {sugerencia.documento_movimiento || '-'}
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCLP(sugerencia.monto_total)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <p>
                          Puntaje:{' '}
                          <span className="font-semibold">
                            {sugerencia.puntaje}
                          </span>
                        </p>
                        <p>
                          Diferencia días:{' '}
                          <span className="font-semibold">
                            {sugerencia.dias_diferencia}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => conciliarSugerencia(sugerencia)}
                        disabled={processing}
                        className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Conciliar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                No hay sugerencias disponibles con los filtros actuales.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Pendientes de cartola
          </h2>

          <div className="mt-5 overflow-hidden rounded-xl border text-sm">
            <div className="grid grid-cols-6 bg-slate-50 text-xs uppercase text-slate-500">
              <div className="px-4 py-3 font-semibold">Fecha</div>
              <div className="px-4 py-3 font-semibold">Descripción</div>
              <div className="px-4 py-3 font-semibold">Cuenta</div>
              <div className="px-4 py-3 font-semibold">Cargo</div>
              <div className="px-4 py-3 font-semibold">Abono</div>
            </div>

            {pendientes.length > 0 ? (
              <div className="divide-y">
                {pendientes.map((fila) => (
                  <div
                    key={fila.id}
                    className="grid grid-cols-6 items-center"
                  >
                    <div className="px-4 py-3">
                      {formatDate(fila.fecha)}
                    </div>

                    <div className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {fila.descripcion_original}
                      </p>
                      <p className="text-xs text-slate-500">
                        Doc: {fila.numero_documento || '-'}
                      </p>
                    </div>

                    <div className="px-4 py-3 text-xs text-slate-600">
                      {getBancoLabel(bancosPorId.get(fila.cuenta_bancaria_id))}
                    </div>

                    <div className="px-4 py-3 font-medium text-red-700">
                      {Number(fila.cargo ?? 0) > 0
                        ? formatCLP(fila.cargo)
                        : '-'}
                    </div>

                    <div className="px-4 py-3 font-medium text-emerald-700">
                      {Number(fila.abono ?? 0) > 0
                        ? formatCLP(fila.abono)
                        : '-'}
                    </div>
<div className="px-4 py-3">
  <button
    type="button"
    onClick={() => crearMovimientoSimple(fila)}
    disabled={processing}
    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
  >
    Crear mov. simple
  </button>
</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-5 text-center text-slate-500">
                No hay líneas pendientes con los filtros actuales.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Conciliadas recientes
          </h2>

          <div className="mt-5 space-y-3">
            {conciliadas.length > 0 ? (
              conciliadas.map((fila) => {
                const movimiento = fila.movimiento_id
                  ? movimientosPorId.get(fila.movimiento_id)
                  : undefined

                return (
                  <div
                    key={fila.id}
                    className="rounded-2xl border p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-500">
                          Cartola bancaria
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">
                          {fila.descripcion_original}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDate(fila.fecha)} ·{' '}
                          {Number(fila.cargo ?? 0) > 0
                            ? formatCLP(fila.cargo)
                            : formatCLP(fila.abono)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 p-4">
                        <p className="text-xs font-medium uppercase text-emerald-700">
                          Movimiento conciliado
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">
                          {movimiento?.descripcion || 'Movimiento no encontrado'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {movimiento?.numero_documento || '-'} ·{' '}
                          {formatCLP(movimiento?.monto_total)}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          {fila.conciliacion_tipo || 'conciliada'} · diferencia{' '}
                          {formatCLP(fila.diferencia_conciliacion)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => reversarConciliacion(fila)}
                        disabled={processing}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Reversar
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                No hay conciliaciones recientes con los filtros actuales.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  )
}