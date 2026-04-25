'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type LibroMayorMovimiento = {
  id: string
  empresa_id: string
  empresa_nombre: string | null

  fecha: string
  created_at: string
  updated_at: string

  tipo_movimiento: string
  estado: string

  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string

  categoria_id: string | null
  categoria_nombre: string | null
  clasificacion_financiera: string | null

  centro_costo_id: string | null
  centro_costo_nombre: string | null

  cuenta_bancaria_id: string | null
  banco: string | null
  nombre_cuenta: string | null

  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: string
  cuenta_naturaleza: string | null

  debe: number
  haber: number
  movimiento_saldo: number
  saldo_acumulado: number

  debe_clp: string | null
  haber_clp: string | null
  saldo_acumulado_clp: string | null
}

type CuentaContable = {
  id: string
  codigo: string
  nombre: string
  tipo: string
  activa: boolean
  deleted_at: string | null
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

export default function LibroMayorPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [movimientos, setMovimientos] = useState<LibroMayorMovimiento[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [desde, setDesde] = useState(getFirstDayOfMonthISO())
  const [hasta, setHasta] = useState(getTodayISO())
  const [cuentaId, setCuentaId] = useState('todas')
  const [tipoCuenta, setTipoCuenta] = useState('todos')
  const [estado, setEstado] = useState('todos')
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
      setCuentas([])
      setMovimientos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      let movimientosQuery = supabase
        .from('v_libro_mayor_cuenta_contable')
        .select(
          `
            id,
            empresa_id,
            empresa_nombre,
            fecha,
            created_at,
            updated_at,
            tipo_movimiento,
            estado,
            tipo_documento,
            numero_documento,
            descripcion,
            categoria_id,
            categoria_nombre,
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
            debe,
            haber,
            movimiento_saldo,
            saldo_acumulado,
            debe_clp,
            haber_clp,
            saldo_acumulado_clp
          `
        )
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true })

      if (desde) movimientosQuery = movimientosQuery.gte('fecha', desde)
      if (hasta) movimientosQuery = movimientosQuery.lte('fecha', hasta)

      const [cuentasResp, movimientosResp] = await Promise.all([
        supabase
          .from('cuentas_contables')
          .select('id, codigo, nombre, tipo, activa, deleted_at')
          .eq('empresa_id', empresaId)
          .eq('activa', true)
          .is('deleted_at', null)
          .order('codigo', { ascending: true }),

        movimientosQuery,
      ])

      if (cuentasResp.error) {
        throw new Error(cuentasResp.error.message)
      }

      if (movimientosResp.error) {
        throw new Error(movimientosResp.error.message)
      }

      setCuentas((cuentasResp.data ?? []) as CuentaContable[])
      setMovimientos((movimientosResp.data ?? []) as LibroMayorMovimiento[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el Libro Mayor.'
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

  const tiposCuenta = useMemo(() => {
    return Array.from(new Set(cuentas.map((cuenta) => cuenta.tipo)))
      .filter(Boolean)
      .sort()
  }, [cuentas])

  const estados = useMemo(() => {
    return Array.from(new Set(movimientos.map((movimiento) => movimiento.estado)))
      .filter(Boolean)
      .sort()
  }, [movimientos])

  const cuentasFiltradasParaSelector = useMemo(() => {
    if (tipoCuenta === 'todos') return cuentas
    return cuentas.filter((cuenta) => cuenta.tipo === tipoCuenta)
  }, [cuentas, tipoCuenta])

  const movimientosFiltrados = useMemo(() => {
    const texto = normalize(busqueda)

    return movimientos.filter((movimiento) => {
      if (tipoCuenta !== 'todos' && movimiento.cuenta_tipo !== tipoCuenta) {
        return false
      }

      if (cuentaId !== 'todas' && movimiento.cuenta_contable_id !== cuentaId) {
        return false
      }

      if (estado !== 'todos' && movimiento.estado !== estado) {
        return false
      }

      if (!texto) return true

      const searchable = [
        movimiento.cuenta_codigo,
        movimiento.cuenta_nombre,
        movimiento.tipo_documento,
        movimiento.numero_documento,
        movimiento.descripcion,
        movimiento.categoria_nombre,
        movimiento.clasificacion_financiera,
        movimiento.banco,
        movimiento.nombre_cuenta,
        movimiento.estado,
      ]
        .map(normalize)
        .join(' ')

      return searchable.includes(texto)
    })
  }, [movimientos, tipoCuenta, cuentaId, estado, busqueda])

  const resumen = useMemo(() => {
    return movimientosFiltrados.reduce(
      (acc, movimiento) => {
        acc.movimientos += 1
        acc.debe += Number(movimiento.debe || 0)
        acc.haber += Number(movimiento.haber || 0)
        acc.saldo += Number(movimiento.movimiento_saldo || 0)

        return acc
      },
      {
        movimientos: 0,
        debe: 0,
        haber: 0,
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
        debe: number
        haber: number
        saldo: number
      }
    >()

    movimientosFiltrados.forEach((movimiento) => {
      const key = movimiento.cuenta_contable_id

      const current = map.get(key) ?? {
        cuenta_codigo: movimiento.cuenta_codigo,
        cuenta_nombre: movimiento.cuenta_nombre,
        cuenta_tipo: movimiento.cuenta_tipo,
        cantidad: 0,
        debe: 0,
        haber: 0,
        saldo: 0,
      }

      current.cantidad += 1
      current.debe += Number(movimiento.debe || 0)
      current.haber += Number(movimiento.haber || 0)
      current.saldo += Number(movimiento.movimiento_saldo || 0)

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
          <p className="text-sm text-slate-500">Cargando Libro Mayor...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al Libro Mayor.
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
              Libro Mayor por cuenta contable
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Revisa los movimientos cronológicos de cada cuenta contable con debe, haber y
              saldo acumulado. Este reporte es operativo-contable y se basa en los movimientos
              registrados en la app.
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
              href="/plan-cuentas/movimientos"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Movimientos contables
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
            {resumen.movimientos}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Debe
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumen.debe)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Haber
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumen.haber)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Saldo
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              resumen.saldo >= 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {formatCLP(resumen.saldo)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[160px_160px_180px_260px_180px_1fr_auto]">
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
              Tipo cuenta
            </label>
            <select
              value={tipoCuenta}
              onChange={(event) => {
                setTipoCuenta(event.target.value)
                setCuentaId('todas')
              }}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              {tiposCuenta.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cuenta
            </label>
            <select
              value={cuentaId}
              onChange={(event) => setCuentaId(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todas">Todas</option>
              {cuentasFiltradasParaSelector.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} - {cuenta.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              {estados.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
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
              placeholder="Descripción, documento, categoría o banco"
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
          <h2 className="text-lg font-semibold text-slate-900">
            Resumen por cuenta
          </h2>
          <p className="text-sm text-slate-500">
            Totales del mayor según los filtros aplicados.
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
                  <th className="px-4 py-3">Debe</th>
                  <th className="px-4 py-3">Haber</th>
                  <th className="px-4 py-3">Saldo</th>
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
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(item.debe)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(item.haber)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          item.saldo >= 0 ? 'text-rose-700' : 'text-emerald-700'
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
            Detalle del Libro Mayor
          </h2>
          <p className="text-sm text-slate-500">
            Movimiento cronológico por cuenta contable.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3">Debe</th>
                  <th className="px-4 py-3">Haber</th>
                  <th className="px-4 py-3">Saldo acum.</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
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
                          {movimiento.cuenta_codigo} - {movimiento.cuenta_nombre}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.cuenta_tipo}
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
                        <div className="mt-1 text-xs text-slate-500">
                          {movimiento.tipo_movimiento} · {movimiento.estado}
                        </div>
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

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(movimiento.debe)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(movimiento.haber)}
                      </td>

                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          Number(movimiento.saldo_acumulado || 0) >= 0
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {formatCLP(movimiento.saldo_acumulado)}
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
