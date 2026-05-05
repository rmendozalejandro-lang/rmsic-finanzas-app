'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Asiento = {
  id: string
  empresa_id: string
  fecha: string
  numero: string | null
  glosa: string
  origen_tipo: string | null
  origen_id: string | null
  estado: 'borrador' | 'contabilizado' | string
  created_at: string
}

type CuentaContable = {
  codigo: string | null
  nombre: string | null
}

type AsientoDetalle = {
  id: string
  asiento_id: string
  cuenta_contable_id: string
  descripcion: string | null
  debe: number | string
  haber: number | string
  cuentas_contables?: CuentaContable | null
}
type AsientoDetalleRaw = Omit<AsientoDetalle, 'cuentas_contables'> & {
  cuentas_contables?: CuentaContable | CuentaContable[] | null
}

type AsientoResumen = Asiento & {
  total_debe: number
  total_haber: number
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

function estadoClassName(estado: string) {
  if (estado === 'contabilizado') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  if (estado === 'borrador') {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  return 'bg-slate-50 text-slate-700 border-slate-200'
}

export default function AsientosContablesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [asientos, setAsientos] = useState<AsientoResumen[]>([])
  const [detalles, setDetalles] = useState<AsientoDetalle[]>([])
  const [asientoSeleccionadoId, setAsientoSeleccionadoId] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'borrador' | 'contabilizado'>('borrador')
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

  const asientoSeleccionado = useMemo(() => {
    return asientos.find((asiento) => asiento.id === asientoSeleccionadoId) || null
  }, [asientos, asientoSeleccionadoId])

  const detallesSeleccionados = useMemo(() => {
    return detalles.filter((detalle) => detalle.asiento_id === asientoSeleccionadoId)
  }, [detalles, asientoSeleccionadoId])

  const totalDebeSeleccionado = useMemo(() => {
    return detallesSeleccionados.reduce((total, detalle) => {
      return total + Number(detalle.debe ?? 0)
    }, 0)
  }, [detallesSeleccionados])

  const totalHaberSeleccionado = useMemo(() => {
    return detallesSeleccionados.reduce((total, detalle) => {
      return total + Number(detalle.haber ?? 0)
    }, 0)
  }, [detallesSeleccionados])

  const diferenciaSeleccionada = totalDebeSeleccionado - totalHaberSeleccionado

  const cargarDatos = useCallback(async () => {
    if (!empresaActivaId) {
      setAsientos([])
      setDetalles([])
      setAsientoSeleccionadoId('')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    let asientosQuery = supabase
      .from('asientos_contables')
      .select(`
        id,
        empresa_id,
        fecha,
        numero,
        glosa,
        origen_tipo,
        origen_id,
        estado,
        created_at
      `)
      .eq('empresa_id', empresaActivaId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(80)

    if (estadoFiltro !== 'todos') {
      asientosQuery = asientosQuery.eq('estado', estadoFiltro)
    }

    const asientosResp = await asientosQuery

    if (asientosResp.error) {
      setError(`Error al cargar asientos: ${asientosResp.error.message}`)
      setLoading(false)
      return
    }

    const asientosData = (asientosResp.data ?? []) as Asiento[]
    const ids = asientosData.map((asiento) => asiento.id)

    if (ids.length === 0) {
      setAsientos([])
      setDetalles([])
      setAsientoSeleccionadoId('')
      setLoading(false)
      return
    }

    const detallesResp = await supabase
      .from('asiento_detalles')
      .select(`
        id,
        asiento_id,
        cuenta_contable_id,
        descripcion,
        debe,
        haber,
        cuentas_contables:cuenta_contable_id (
          codigo,
          nombre
        )
      `)
      .in('asiento_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (detallesResp.error) {
      setError(`Error al cargar detalle de asientos: ${detallesResp.error.message}`)
      setLoading(false)
      return
    }

    const detallesData = ((detallesResp.data ?? []) as AsientoDetalleRaw[]).map(
  (detalle) => ({
    ...detalle,
    cuentas_contables: Array.isArray(detalle.cuentas_contables)
      ? detalle.cuentas_contables[0] ?? null
      : detalle.cuentas_contables ?? null,
  })
) as AsientoDetalle[]

    const resumen = asientosData.map((asiento) => {
      const detalleAsiento = detallesData.filter(
        (detalle) => detalle.asiento_id === asiento.id
      )

      const totalDebe = detalleAsiento.reduce((total, detalle) => {
        return total + Number(detalle.debe ?? 0)
      }, 0)

      const totalHaber = detalleAsiento.reduce((total, detalle) => {
        return total + Number(detalle.haber ?? 0)
      }, 0)

      return {
        ...asiento,
        total_debe: totalDebe,
        total_haber: totalHaber,
      }
    })

    setAsientos(resumen)
    setDetalles(detallesData)

    setAsientoSeleccionadoId((current) => {
      if (current && resumen.some((asiento) => asiento.id === current)) {
        return current
      }

      return resumen[0]?.id || ''
    })

    setLoading(false)
  }, [empresaActivaId, estadoFiltro])

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

  const contabilizarAsiento = async (asiento: AsientoResumen) => {
    if (asiento.estado !== 'borrador') {
      setError('Solo se pueden contabilizar asientos en estado borrador.')
      return
    }

    if (Math.abs(asiento.total_debe - asiento.total_haber) > 0.49) {
      setError('No se puede contabilizar: el asiento no está cuadrado.')
      return
    }

    const confirmar = window.confirm(
      `¿Contabilizar el asiento ${asiento.numero || ''} por ${formatCLP(
        asiento.total_debe
      )}?`
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc('contabilizar_asiento', {
      p_asiento_id: asiento.id,
    })

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    setSuccess('Asiento contabilizado correctamente.')
    await cargarDatos()
    setProcessing(false)
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Contabilidad</p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Asientos contables
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Empresa activa:{' '}
            <span className="font-medium text-slate-900">
              {empresaActivaNombre || 'Sin empresa activa'}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDatos}
          disabled={loading || processing}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Actualizar
        </button>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Estado
        </label>

        <select
          value={estadoFiltro}
          onChange={(event) =>
            setEstadoFiltro(event.target.value as 'todos' | 'borrador' | 'contabilizado')
          }
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 md:max-w-sm"
        >
          <option value="borrador">Borradores</option>
          <option value="contabilizado">Contabilizados</option>
          <option value="todos">Todos</option>
        </select>
      </section>

      {loading ? (
        <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando asientos contables...
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
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Listado de asientos
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Selecciona un asiento para revisar su detalle.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {asientos.length}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {asientos.length > 0 ? (
                asientos.map((asiento) => {
                  const seleccionado = asiento.id === asientoSeleccionadoId
                  const cuadrado =
                    Math.abs(asiento.total_debe - asiento.total_haber) <= 0.49

                  return (
                    <button
                      key={asiento.id}
                      type="button"
                      onClick={() => setAsientoSeleccionadoId(asiento.id)}
                      className={
                        seleccionado
                          ? 'w-full rounded-2xl border border-slate-900 bg-slate-50 p-4 text-left shadow-sm'
                          : 'w-full rounded-2xl border bg-white p-4 text-left hover:bg-slate-50'
                      }
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {asiento.numero || 'Sin número'}
                            </p>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${estadoClassName(
                                asiento.estado
                              )}`}
                            >
                              {asiento.estado}
                            </span>

                            {cuadrado ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                Cuadrado
                              </span>
                            ) : (
                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                Diferencia
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-slate-700">
                            {asiento.glosa}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(asiento.fecha)} · origen:{' '}
                            {asiento.origen_tipo || '-'}
                          </p>
                        </div>

                        <div className="text-sm md:text-right">
                          <p className="font-semibold text-slate-900">
                            {formatCLP(asiento.total_debe)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Debe / Haber
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                  No hay asientos para el filtro seleccionado.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            {asientoSeleccionado ? (
              <>
                <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Detalle del asiento
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {asientoSeleccionado.numero || 'Sin número'}
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      {asientoSeleccionado.glosa}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${estadoClassName(
                      asientoSeleccionado.estado
                    )}`}
                  >
                    {asientoSeleccionado.estado}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Debe</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatCLP(totalDebeSeleccionado)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Haber</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatCLP(totalHaberSeleccionado)}
                    </p>
                  </div>

                  <div
                    className={
                      Math.abs(diferenciaSeleccionada) <= 0.49
                        ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4'
                        : 'rounded-2xl border border-red-200 bg-red-50 p-4'
                    }
                  >
                    <p className="text-sm text-slate-500">Diferencia</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatCLP(diferenciaSeleccionada)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border text-sm">
                  <div className="grid grid-cols-4 bg-slate-50 text-xs uppercase text-slate-500">
                    <div className="px-4 py-3 font-semibold">Cuenta</div>
                    <div className="px-4 py-3 font-semibold">Descripción</div>
                    <div className="px-4 py-3 font-semibold">Debe</div>
                    <div className="px-4 py-3 font-semibold">Haber</div>
                  </div>

                  {detallesSeleccionados.length > 0 ? (
                    <div className="divide-y">
                      {detallesSeleccionados.map((detalle) => (
                        <div key={detalle.id} className="grid grid-cols-4">
                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {detalle.cuentas_contables?.codigo || '-'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {detalle.cuentas_contables?.nombre ||
                                'Cuenta no encontrada'}
                            </p>
                          </div>

                          <div className="px-4 py-3 text-slate-700">
                            {detalle.descripcion || '-'}
                          </div>

                          <div className="px-4 py-3 font-medium text-slate-900">
                            {Number(detalle.debe ?? 0) > 0
                              ? formatCLP(detalle.debe)
                              : '-'}
                          </div>

                          <div className="px-4 py-3 font-medium text-slate-900">
                            {Number(detalle.haber ?? 0) > 0
                              ? formatCLP(detalle.haber)
                              : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-center text-slate-500">
                      Este asiento no tiene detalle.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600">
                    {asientoSeleccionado.estado === 'borrador'
                      ? 'Revisa que el asiento esté cuadrado antes de contabilizar.'
                      : 'Este asiento ya está contabilizado.'}
                  </div>

                  <button
                    type="button"
                    onClick={() => contabilizarAsiento(asientoSeleccionado)}
                    disabled={
                      processing ||
                      asientoSeleccionado.estado !== 'borrador' ||
                      Math.abs(diferenciaSeleccionada) > 0.49
                    }
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {processing ? 'Procesando...' : 'Contabilizar asiento'}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                Selecciona un asiento para revisar su detalle.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  )
}