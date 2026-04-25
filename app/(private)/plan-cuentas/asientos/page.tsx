'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type AsientoResumen = {
  id: string
  empresa_id: string
  empresa_nombre: string | null
  fecha: string
  numero: string | null
  glosa: string
  origen_tipo: string | null
  origen_id: string | null
  estado: string
  activo: boolean
  deleted_at: string | null
  lineas: number
  total_debe: number
  total_haber: number
  diferencia: number
  cuadrado: boolean
  total_debe_clp: string | null
  total_haber_clp: string | null
  diferencia_clp: string | null
  created_at: string
  updated_at: string
}

type AsientoDetalle = {
  id: string
  asiento_id: string
  empresa_id: string
  fecha: string
  numero: string | null
  glosa: string
  asiento_estado: string
  origen_tipo: string | null
  origen_id: string | null
  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: string
  cuenta_naturaleza: string | null
  descripcion: string | null
  debe: number
  haber: number
  debe_clp: string | null
  haber_clp: string | null
  tercero_tipo: string | null
  cliente_id: string | null
  cliente_nombre: string | null
  proveedor_id: string | null
  proveedor_nombre: string | null
  centro_costo_id: string | null
  centro_costo_nombre: string | null
  activo: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getFirstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

function formatCLP(value: number | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export default function AsientosContablesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [asientos, setAsientos] = useState<AsientoResumen[]>([])
  const [detalle, setDetalle] = useState<AsientoDetalle[]>([])
  const [selectedAsientoId, setSelectedAsientoId] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [desde, setDesde] = useState(getFirstDayOfMonthISO())
  const [hasta, setHasta] = useState(getTodayISO())
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [cuadraturaFiltro, setCuadraturaFiltro] = useState<'todos' | 'cuadrados' | 'descuadrados'>(
    'todos'
  )
  const [busqueda, setBusqueda] = useState('')

  const canManage = usuarioRol === 'admin'

  const accesoPermitido = [
    'admin',
    'gerencia',
    'finanzas',
    'administracion_financiera',
  ].includes(usuarioRol)

  const loadUserContext = async (empresaId: string) => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      setUsuarioRol('')
      return
    }

    const { data: rolData } = await supabase
      .from('usuario_empresas')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .maybeSingle()

    setUsuarioRol(rolData?.rol || '')
  }

  const loadAsientos = async (empresaId: string) => {
    if (!empresaId) {
      setAsientos([])
      setDetalle([])
      setSelectedAsientoId('')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('v_asientos_contables_resumen')
        .select(
          `
            id,
            empresa_id,
            empresa_nombre,
            fecha,
            numero,
            glosa,
            origen_tipo,
            origen_id,
            estado,
            activo,
            deleted_at,
            lineas,
            total_debe,
            total_haber,
            diferencia,
            cuadrado,
            total_debe_clp,
            total_haber_clp,
            diferencia_clp,
            created_at,
            updated_at
          `
        )
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })

      if (desde) query = query.gte('fecha', desde)
      if (hasta) query = query.lte('fecha', hasta)

      const { data, error: asientosError } = await query

      if (asientosError) throw new Error(asientosError.message)

      setAsientos((data ?? []) as AsientoResumen[])

      const selectedStillExists = (data ?? []).some((item) => item.id === selectedAsientoId)

      if (!selectedStillExists) {
        setSelectedAsientoId('')
        setDetalle([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los asientos.')
    } finally {
      setLoading(false)
    }
  }

  const loadDetalle = async (asientoId: string) => {
    if (!asientoId) {
      setDetalle([])
      setSelectedAsientoId('')
      return
    }

    try {
      setLoadingDetalle(true)
      setError('')
      setSuccess('')

      const { data, error: detalleError } = await supabase
        .from('v_asiento_detalle_completo')
        .select(
          `
            id,
            asiento_id,
            empresa_id,
            fecha,
            numero,
            glosa,
            asiento_estado,
            origen_tipo,
            origen_id,
            cuenta_contable_id,
            cuenta_codigo,
            cuenta_nombre,
            cuenta_tipo,
            cuenta_naturaleza,
            descripcion,
            debe,
            haber,
            debe_clp,
            haber_clp,
            tercero_tipo,
            cliente_id,
            cliente_nombre,
            proveedor_id,
            proveedor_nombre,
            centro_costo_id,
            centro_costo_nombre,
            activo,
            deleted_at,
            created_at,
            updated_at
          `
        )
        .eq('asiento_id', asientoId)
        .order('created_at', { ascending: true })

      if (detalleError) throw new Error(detalleError.message)

      setSelectedAsientoId(asientoId)
      setDetalle((data ?? []) as AsientoDetalle[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del asiento.')
    } finally {
      setLoadingDetalle(false)
    }
  }

  const syncEmpresaActiva = async () => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)

    if (id) {
      await loadUserContext(id)
      await loadAsientos(id)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    void syncEmpresaActiva()

    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  const estadosOptions = useMemo(() => {
    return Array.from(new Set(asientos.map((asiento) => asiento.estado)))
      .filter(Boolean)
      .sort()
  }, [asientos])

  const asientosFiltrados = useMemo(() => {
    const texto = normalize(busqueda)

    return asientos.filter((asiento) => {
      if (estadoFiltro !== 'todos' && asiento.estado !== estadoFiltro) {
        return false
      }

      if (cuadraturaFiltro === 'cuadrados' && !asiento.cuadrado) return false
      if (cuadraturaFiltro === 'descuadrados' && asiento.cuadrado) return false

      if (!texto) return true

      const searchable = [
        asiento.numero,
        asiento.glosa,
        asiento.origen_tipo,
        asiento.estado,
      ]
        .map(normalize)
        .join(' ')

      return searchable.includes(texto)
    })
  }, [asientos, busqueda, estadoFiltro, cuadraturaFiltro])

  const resumen = useMemo(() => {
    return asientosFiltrados.reduce(
      (acc, asiento) => {
        acc.cantidad += 1
        acc.debe += Number(asiento.total_debe || 0)
        acc.haber += Number(asiento.total_haber || 0)
        acc.diferencia += Number(asiento.diferencia || 0)

        if (asiento.cuadrado) acc.cuadrados += 1
        else acc.descuadrados += 1

        return acc
      },
      {
        cantidad: 0,
        debe: 0,
        haber: 0,
        diferencia: 0,
        cuadrados: 0,
        descuadrados: 0,
      }
    )
  }, [asientosFiltrados])

  const selectedAsiento = useMemo(() => {
    return asientos.find((asiento) => asiento.id === selectedAsientoId) || null
  }, [asientos, selectedAsientoId])

  const handleReload = () => {
    if (!empresaActivaId) return
    void loadAsientos(empresaActivaId)
  }

  const handleArchive = async (asiento: AsientoResumen) => {
    if (!canManage) {
      setError('Solo usuarios admin pueden archivar asientos.')
      return
    }

    const confirmed = window.confirm(
      `¿Deseas archivar el asiento ${asiento.numero || 'sin número'}? No se borrará de la base de datos.`
    )

    if (!confirmed) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id || null
      const now = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('asientos_contables')
        .update({
          activo: false,
          deleted_at: now,
          deleted_by: userId,
          updated_by: userId,
          updated_at: now,
        })
        .eq('id', asiento.id)
        .eq('empresa_id', empresaActivaId)

      if (updateError) throw new Error(updateError.message)

      setSuccess('Asiento archivado correctamente.')
      setSelectedAsientoId('')
      setDetalle([])
      await loadAsientos(empresaActivaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar el asiento.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando asientos contables...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder a Asientos Contables.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Contabilidad formal</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Asientos Contables
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Revisa asientos de doble partida y valida si cada asiento está cuadrado.
              Esta pantalla usa las tablas asientos_contables y asiento_detalles.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || 'Sin empresa activa'}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
  href="/plan-cuentas/asientos/nuevo"
  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
>
  Nuevo asiento
</Link>

            <Link
              href="/plan-cuentas"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Plan de cuentas
            </Link>

            <Link
              href="/plan-cuentas/libro-mayor"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Libro Mayor
            </Link>
          </div>
        </div>
      </section>

      {(error || success) && (
        <section
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || success}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Asientos
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumen.cantidad}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total debe
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumen.debe)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total haber
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumen.haber)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Cuadrados
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {resumen.cuadrados}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            resumen.descuadrados === 0
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              resumen.descuadrados === 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            Descuadrados
          </p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              resumen.descuadrados === 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {resumen.descuadrados}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[160px_160px_200px_200px_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              value={estadoFiltro}
              onChange={(event) => setEstadoFiltro(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              {estadosOptions.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cuadratura
            </label>
            <select
              value={cuadraturaFiltro}
              onChange={(event) =>
                setCuadraturaFiltro(
                  event.target.value as 'todos' | 'cuadrados' | 'descuadrados'
                )
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              <option value="cuadrados">Cuadrados</option>
              <option value="descuadrados">Descuadrados</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              placeholder="Número, glosa, origen o estado"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleReload}
              className="w-full rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90]"
            >
              Actualizar
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Listado de asientos</h2>
          <p className="text-sm text-slate-500">
            Selecciona un asiento para ver su detalle contable.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Glosa</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Líneas</th>
                  <th className="px-4 py-3">Debe</th>
                  <th className="px-4 py-3">Haber</th>
                  <th className="px-4 py-3">Diferencia</th>
                  <th className="px-4 py-3">Cuadrado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {asientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No hay asientos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  asientosFiltrados.map((asiento) => (
                    <tr
                      key={asiento.id}
                      className={
                        selectedAsientoId === asiento.id ? 'bg-blue-50/40' : undefined
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDate(asiento.fecha)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {asiento.numero || '-'}
                      </td>
                      <td className="min-w-[260px] px-4 py-3 text-slate-700">
                        {asiento.glosa}
                        {asiento.origen_tipo && (
                          <div className="mt-1 text-xs text-slate-500">
                            Origen: {asiento.origen_tipo}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {asiento.estado}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {asiento.lineas}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(asiento.total_debe)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(asiento.total_haber)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {formatCLP(asiento.diferencia)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            asiento.cuadrado
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {asiento.cuadrado ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void loadDetalle(asiento.id)}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Ver detalle
                          </button>

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => void handleArchive(asiento)}
                              disabled={saving}
                              className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Archivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Detalle del asiento</h2>
            <p className="text-sm text-slate-500">
              {selectedAsiento
                ? `${selectedAsiento.numero || 'Sin número'} · ${selectedAsiento.glosa}`
                : 'Selecciona un asiento para ver sus líneas.'}
            </p>
          </div>

          {selectedAsiento && (
            <div
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                selectedAsiento.cuadrado
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              Diferencia: {formatCLP(selectedAsiento.diferencia)}
            </div>
          )}
        </div>

        {loadingDetalle ? (
          <p className="text-sm text-slate-500">Cargando detalle...</p>
        ) : detalle.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No hay líneas para mostrar.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cuenta</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Tercero</th>
                    <th className="px-4 py-3">Centro costo</th>
                    <th className="px-4 py-3">Debe</th>
                    <th className="px-4 py-3">Haber</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {detalle.map((linea) => (
                    <tr key={linea.id} className="align-top">
                      <td className="min-w-[220px] px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {linea.cuenta_codigo} - {linea.cuenta_nombre}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {linea.cuenta_tipo}
                        </div>
                      </td>
                      <td className="min-w-[240px] px-4 py-3 text-slate-700">
                        {linea.descripcion || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {linea.cliente_nombre || linea.proveedor_nombre || '-'}
                        {linea.tercero_tipo && (
                          <div className="mt-1 text-xs text-slate-500">
                            {linea.tercero_tipo}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {linea.centro_costo_nombre || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(linea.debe)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(linea.haber)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
