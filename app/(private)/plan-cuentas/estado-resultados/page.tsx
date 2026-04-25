'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type EstadoResultadoMovimiento = {
  id: string
  empresa_id: string
  empresa_nombre: string | null

  fecha: string
  anio: number
  mes: number

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

  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: 'ingreso' | 'gasto' | string
  cuenta_naturaleza: string | null

  ingreso: number
  gasto: number
  resultado: number

  ingreso_clp: string | null
  gasto_clp: string | null
  resultado_clp: string | null

  created_at: string
  updated_at: string
}

type CuentaOption = {
  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: string
}

type CategoriaOption = {
  categoria_id: string
  categoria_nombre: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getFirstDayOfYearISO() {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
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

function formatPercent(value: number | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(amount)
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function getMonthName(month: number) {
  const date = new Date(2026, month - 1, 1)

  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
  }).format(date)
}

export default function EstadoResultadosPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [movimientos, setMovimientos] = useState<EstadoResultadoMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [desde, setDesde] = useState(getFirstDayOfYearISO())
  const [hasta, setHasta] = useState(getTodayISO())
  const [tipoCuenta, setTipoCuenta] = useState<'todos' | 'ingreso' | 'gasto'>('todos')
  const [cuentaId, setCuentaId] = useState('todas')
  const [categoriaId, setCategoriaId] = useState('todas')
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
      setMovimientos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('v_estado_resultados_contable')
        .select(
          `
            id,
            empresa_id,
            empresa_nombre,
            fecha,
            anio,
            mes,
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
            cuenta_contable_id,
            cuenta_codigo,
            cuenta_nombre,
            cuenta_tipo,
            cuenta_naturaleza,
            ingreso,
            gasto,
            resultado,
            ingreso_clp,
            gasto_clp,
            resultado_clp,
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

      setMovimientos((data ?? []) as EstadoResultadoMovimiento[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el Estado de Resultados.'
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
      if (tipoCuenta !== 'todos' && movimiento.cuenta_tipo !== tipoCuenta) return

      map.set(movimiento.cuenta_contable_id, {
        cuenta_contable_id: movimiento.cuenta_contable_id,
        cuenta_codigo: movimiento.cuenta_codigo,
        cuenta_nombre: movimiento.cuenta_nombre,
        cuenta_tipo: movimiento.cuenta_tipo,
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      a.cuenta_codigo.localeCompare(b.cuenta_codigo)
    )
  }, [movimientos, tipoCuenta])

  const categoriasOptions = useMemo(() => {
    const map = new Map<string, CategoriaOption>()

    movimientos.forEach((movimiento) => {
      if (!movimiento.categoria_id || !movimiento.categoria_nombre) return

      map.set(movimiento.categoria_id, {
        categoria_id: movimiento.categoria_id,
        categoria_nombre: movimiento.categoria_nombre,
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      a.categoria_nombre.localeCompare(b.categoria_nombre)
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
      if (tipoCuenta !== 'todos' && movimiento.cuenta_tipo !== tipoCuenta) {
        return false
      }

      if (cuentaId !== 'todas' && movimiento.cuenta_contable_id !== cuentaId) {
        return false
      }

      if (categoriaId !== 'todas' && movimiento.categoria_id !== categoriaId) {
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
        movimiento.centro_costo_nombre,
        movimiento.estado,
      ]
        .map(normalize)
        .join(' ')

      return searchable.includes(texto)
    })
  }, [movimientos, tipoCuenta, cuentaId, categoriaId, estado, busqueda])

  const resumen = useMemo(() => {
    return movimientosFiltrados.reduce(
      (acc, movimiento) => {
        acc.movimientos += 1
        acc.ingresos += Number(movimiento.ingreso || 0)
        acc.gastos += Number(movimiento.gasto || 0)
        acc.resultado += Number(movimiento.resultado || 0)

        return acc
      },
      {
        movimientos: 0,
        ingresos: 0,
        gastos: 0,
        resultado: 0,
      }
    )
  }, [movimientosFiltrados])

  const margen = resumen.ingresos > 0 ? resumen.resultado / resumen.ingresos : 0

  const resumenPorCuenta = useMemo(() => {
    const map = new Map<
      string,
      {
        cuenta_codigo: string
        cuenta_nombre: string
        cuenta_tipo: string
        cantidad: number
        ingresos: number
        gastos: number
        resultado: number
      }
    >()

    movimientosFiltrados.forEach((movimiento) => {
      const key = movimiento.cuenta_contable_id

      const current = map.get(key) ?? {
        cuenta_codigo: movimiento.cuenta_codigo,
        cuenta_nombre: movimiento.cuenta_nombre,
        cuenta_tipo: movimiento.cuenta_tipo,
        cantidad: 0,
        ingresos: 0,
        gastos: 0,
        resultado: 0,
      }

      current.cantidad += 1
      current.ingresos += Number(movimiento.ingreso || 0)
      current.gastos += Number(movimiento.gasto || 0)
      current.resultado += Number(movimiento.resultado || 0)

      map.set(key, current)
    })

    return Array.from(map.values()).sort((a, b) =>
      a.cuenta_codigo.localeCompare(b.cuenta_codigo)
    )
  }, [movimientosFiltrados])

  const resumenMensual = useMemo(() => {
    const map = new Map<
      string,
      {
        anio: number
        mes: number
        ingresos: number
        gastos: number
        resultado: number
      }
    >()

    movimientosFiltrados.forEach((movimiento) => {
      const key = `${movimiento.anio}-${movimiento.mes}`

      const current = map.get(key) ?? {
        anio: movimiento.anio,
        mes: movimiento.mes,
        ingresos: 0,
        gastos: 0,
        resultado: 0,
      }

      current.ingresos += Number(movimiento.ingreso || 0)
      current.gastos += Number(movimiento.gasto || 0)
      current.resultado += Number(movimiento.resultado || 0)

      map.set(key, current)
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio
      return b.mes - a.mes
    })
  }, [movimientosFiltrados])

  const handleReload = () => {
    if (!empresaActivaId) return
    void loadData(empresaActivaId)
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando Estado de Resultados...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al Estado de Resultados.
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
              Estado de Resultados
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Revisa ingresos, gastos y resultado del período usando cuentas contables.
              Esta primera versión considera movimientos activos según su fecha contable.
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
              href="/plan-cuentas/libro-mayor"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Libro Mayor
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            Ingresos
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumen.ingresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Gastos
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumen.gastos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Resultado
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              resumen.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCLP(resumen.resultado)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Margen
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              margen >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatPercent(margen)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[160px_160px_160px_260px_220px_180px_1fr_auto]">
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
              value={tipoCuenta}
              onChange={(event) => {
                setTipoCuenta(event.target.value as 'todos' | 'ingreso' | 'gasto')
                setCuentaId('todas')
              }}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="gasto">Gastos</option>
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
              {cuentasOptions.map((cuenta) => (
                <option key={cuenta.cuenta_contable_id} value={cuenta.cuenta_contable_id}>
                  {cuenta.cuenta_codigo} - {cuenta.cuenta_nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Categoría
            </label>
            <select
              value={categoriaId}
              onChange={(event) => setCategoriaId(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todas">Todas</option>
              {categoriasOptions.map((categoria) => (
                <option key={categoria.categoria_id} value={categoria.categoria_id}>
                  {categoria.categoria_nombre}
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
              {estadosOptions.map((item) => (
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
              placeholder="Documento, descripción, categoría o cuenta"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => empresaActivaId && void loadData(empresaActivaId)}
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
            Resultado por cuenta
          </h2>
          <p className="text-sm text-slate-500">
            Totales agrupados según los filtros aplicados.
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
                  <th className="px-4 py-3">Gastos</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {resumenPorCuenta.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay información para los filtros seleccionados.
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
                        {formatCLP(item.gastos)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          item.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCLP(item.resultado)}
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
            Resultado mensual
          </h2>
          <p className="text-sm text-slate-500">
            Resumen mensual calculado según los filtros aplicados.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Gastos</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {resumenMensual.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No hay información mensual para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  resumenMensual.map((item) => (
                    <tr key={`${item.anio}-${item.mes}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {getMonthName(item.mes)} {item.anio}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(item.ingresos)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(item.gastos)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          item.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCLP(item.resultado)}
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
            Detalle del período
          </h2>
          <p className="text-sm text-slate-500">
            Movimientos que componen el resultado.
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
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Gastos</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
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

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {formatCLP(movimiento.ingreso)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {formatCLP(movimiento.gasto)}
                      </td>

                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          Number(movimiento.resultado || 0) >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {formatCLP(movimiento.resultado)}
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
