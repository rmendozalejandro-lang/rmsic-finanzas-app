'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type MovimientoContable = {
  id: string
  empresa_id: string
  empresa_nombre: string | null

  fecha: string
  fecha_vencimiento: string | null
  tipo_movimiento: string
  estado: string

  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string

  monto_neto: number
  monto_iva: number
  monto_exento: number
  impuesto_especifico: number
  monto_total: number

  categoria_id: string | null
  categoria_nombre: string | null
  categoria_tipo: string | null
  clasificacion_financiera: string | null

  centro_costo_id: string | null
  centro_costo_nombre: string | null

  cuenta_bancaria_id: string | null
  banco: string | null
  nombre_cuenta: string | null

  cuenta_contable_id: string | null
  cuenta_codigo: string | null
  cuenta_nombre: string | null
  cuenta_tipo: string | null
  cuenta_naturaleza: string | null

  ingreso: number
  egreso: number
  saldo_neto: number

  ingreso_clp: string | null
  egreso_clp: string | null
  saldo_neto_clp: string | null

  created_at: string
  updated_at: string
}

type CuentaOption = {
  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function formatCLP(value: number | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
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

function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getFirstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export default function MovimientosContablesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [movimientos, setMovimientos] = useState<MovimientoContable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [desde, setDesde] = useState(getFirstDayOfMonthISO())
  const [hasta, setHasta] = useState(getTodayISO())
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | string>('todos')
  const [cuentaFiltro, setCuentaFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

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

  const loadData = async (empresaId: string) => {
    if (!empresaId) {
      setMovimientos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('v_movimientos_por_cuenta_contable')
        .select(
          `
            id,
            empresa_id,
            empresa_nombre,
            fecha,
            fecha_vencimiento,
            tipo_movimiento,
            estado,
            tipo_documento,
            numero_documento,
            descripcion,
            monto_neto,
            monto_iva,
            monto_exento,
            impuesto_especifico,
            monto_total,
            categoria_id,
            categoria_nombre,
            categoria_tipo,
            clasificacion_financiera,
            centro_costo_id,
            centro_costo_nombre,
            cuenta_bancaria_id,
            banco,
            nombre_cuenta,
            cuenta_contable_id,
            cuenta_codigo,
            cuenta_nombre,
            cuenta_tipo,
            cuenta_naturaleza,
            ingreso,
            egreso,
            saldo_neto,
            ingreso_clp,
            egreso_clp,
            saldo_neto_clp,
            created_at,
            updated_at
          `
        )
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })

      if (desde) query = query.gte('fecha', desde)
      if (hasta) query = query.lte('fecha', hasta)

      const { data, error: movimientosError } = await query

      if (movimientosError) {
        throw new Error(movimientosError.message)
      }

      setMovimientos((data ?? []) as MovimientoContable[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el reporte de movimientos contables.'
      )
    } finally {
      setLoading(false)
    }
  }

  const syncEmpresaActiva = async () => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)

    if (id) {
      await loadUserContext(id)
      await loadData(id)
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

  const cuentasOptions = useMemo(() => {
    const map = new Map<string, CuentaOption>()

    movimientos.forEach((movimiento) => {
      if (!movimiento.cuenta_contable_id) return

      map.set(movimiento.cuenta_contable_id, {
        cuenta_contable_id: movimiento.cuenta_contable_id,
        cuenta_codigo: movimiento.cuenta_codigo || '',
        cuenta_nombre: movimiento.cuenta_nombre || '',
        cuenta_tipo: movimiento.cuenta_tipo || '',
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      a.cuenta_codigo.localeCompare(b.cuenta_codigo)
    )
  }, [movimientos])

  const estadosOptions = useMemo(() => {
    return Array.from(new Set(movimientos.map((movimiento) => movimiento.estado)))
      .filter(Boolean)
      .sort()
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    const texto = normalize(busqueda)

    return movimientos.filter((movimiento) => {
      if (tipoFiltro !== 'todos' && movimiento.tipo_movimiento !== tipoFiltro) {
        return false
      }

      if (estadoFiltro !== 'todos' && movimiento.estado !== estadoFiltro) {
        return false
      }

      if (cuentaFiltro !== 'todos' && movimiento.cuenta_contable_id !== cuentaFiltro) {
        return false
      }

      if (!texto) return true

      const searchable = [
        movimiento.descripcion,
        movimiento.tipo_documento,
        movimiento.numero_documento,
        movimiento.categoria_nombre,
        movimiento.cuenta_codigo,
        movimiento.cuenta_nombre,
        movimiento.banco,
        movimiento.nombre_cuenta,
        movimiento.estado,
      ]
        .map(normalize)
        .join(' ')

      return searchable.includes(texto)
    })
  }, [movimientos, busqueda, tipoFiltro, estadoFiltro, cuentaFiltro])

  const resumen = useMemo(() => {
    return movimientosFiltrados.reduce(
      (acc, movimiento) => {
        acc.cantidad += 1
        acc.ingresos += Number(movimiento.ingreso || 0)
        acc.egresos += Number(movimiento.egreso || 0)
        acc.saldo += Number(movimiento.saldo_neto || 0)

        return acc
      },
      {
        cantidad: 0,
        ingresos: 0,
        egresos: 0,
        saldo: 0,
      }
    )
  }, [movimientosFiltrados])

  const resumenPorCuenta = useMemo(() => {
    const map = new Map<
      string,
      {
        cuenta_codigo: string
        cuenta_nombre: string
        cuenta_tipo: string
        cantidad: number
        ingresos: number
        egresos: number
        saldo: number
      }
    >()

    movimientosFiltrados.forEach((movimiento) => {
      const key = movimiento.cuenta_contable_id || 'sin-cuenta'

      const current = map.get(key) ?? {
        cuenta_codigo: movimiento.cuenta_codigo || 'S/C',
        cuenta_nombre: movimiento.cuenta_nombre || 'Sin cuenta contable',
        cuenta_tipo: movimiento.cuenta_tipo || '-',
        cantidad: 0,
        ingresos: 0,
        egresos: 0,
        saldo: 0,
      }

      current.cantidad += 1
      current.ingresos += Number(movimiento.ingreso || 0)
      current.egresos += Number(movimiento.egreso || 0)
      current.saldo += Number(movimiento.saldo_neto || 0)

      map.set(key, current)
    })

    return Array.from(map.values()).sort((a, b) =>
      a.cuenta_codigo.localeCompare(b.cuenta_codigo)
    )
  }, [movimientosFiltrados])

  const handleReload = () => {
    if (!empresaActivaId) return
    void loadData(empresaActivaId)
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando movimientos contables...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder a los movimientos contables.
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
            <p className="text-sm font-medium text-slate-500">Plan de Cuentas</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Movimientos por cuenta contable
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Revisa ingresos y egresos asociados a cada cuenta contable. Este reporte usa
              movimientos activos y no considera registros archivados.
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
              href="/plan-cuentas"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Plan de cuentas
            </Link>

            <Link
              href="/plan-cuentas/categorias"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Categorías contables
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Movimientos
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumen.cantidad}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Ingresos
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumen.ingresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Egresos
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumen.egresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Saldo neto
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              resumen.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCLP(resumen.saldo)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[160px_160px_180px_220px_1fr_auto]">
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
              Tipo
            </label>
            <select
              value={tipoFiltro}
              onChange={(event) =>
                setTipoFiltro(event.target.value as 'todos' | 'ingreso' | 'egreso')
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
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
              Cuenta contable
            </label>
            <select
              value={cuentaFiltro}
              onChange={(event) => setCuentaFiltro(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todas</option>
              {cuentasOptions.map((cuenta) => (
                <option key={cuenta.cuenta_contable_id} value={cuenta.cuenta_contable_id}>
                  {cuenta.cuenta_codigo} - {cuenta.cuenta_nombre}
                </option>
              ))}
            </select>
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

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Buscar
          </label>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            placeholder="Buscar por descripción, documento, categoría, banco o cuenta"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Resumen por cuenta
          </h2>
          <p className="text-sm text-slate-500">
            Totales calculados según los filtros aplicados.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Mov.</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Egresos</th>
                  <th className="px-4 py-3">Saldo neto</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {resumenPorCuenta.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay resumen para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  resumenPorCuenta.map((item) => (
                    <tr key={`${item.cuenta_codigo}-${item.cuenta_nombre}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {item.cuenta_codigo} - {item.cuenta_nombre}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {item.cuenta_tipo}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {item.cantidad}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(item.ingresos)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(item.egresos)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          item.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCLP(item.saldo)}
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Detalle de movimientos
          </h2>
          <p className="text-sm text-slate-500">
            Información contable base para validar reportes posteriores.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cuenta contable</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3">Ingreso</th>
                  <th className="px-4 py-3">Egreso</th>
                  <th className="px-4 py-3">Saldo</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No hay movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((movimiento) => (
                    <tr key={movimiento.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDate(movimiento.fecha)}
                      </td>

                      <td className="min-w-[220px] px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {movimiento.cuenta_codigo || 'S/C'} -{' '}
                          {movimiento.cuenta_nombre || 'Sin cuenta'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.cuenta_tipo || '-'}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            movimiento.tipo_movimiento === 'ingreso'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {movimiento.tipo_movimiento}
                        </span>
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.estado}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <div>{movimiento.tipo_documento || '-'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.numero_documento || '-'}
                        </div>
                      </td>

                      <td className="min-w-[260px] px-4 py-3 text-slate-700">
                        {movimiento.descripcion}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {movimiento.categoria_nombre || '-'}
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.clasificacion_financiera || '-'}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {movimiento.banco || '-'}
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.nombre_cuenta || '-'}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(movimiento.ingreso)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(movimiento.egreso)}
                      </td>

                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          Number(movimiento.saldo_neto || 0) >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {formatCLP(movimiento.saldo_neto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
