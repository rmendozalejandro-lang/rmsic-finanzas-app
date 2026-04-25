'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type BalanceLinea = {
  empresa_id: string
  empresa_nombre: string
  seccion: 'activo' | 'pasivo' | 'patrimonio' | string
  orden_seccion: number
  orden_linea: number
  cuenta_contable_id: string | null
  cuenta_codigo: string
  cuenta_nombre: string
  monto: number
  monto_clp: string | null
  observacion: string | null
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const seccionLabels: Record<string, string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  patrimonio: 'Patrimonio',
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

export default function BalanceGeneralPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [lineas, setLineas] = useState<BalanceLinea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seccionFiltro, setSeccionFiltro] = useState<'todas' | 'activo' | 'pasivo' | 'patrimonio'>(
    'todas'
  )

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
      setLineas([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data, error: balanceError } = await supabase
        .from('v_balance_general_inicial')
        .select(
          `
            empresa_id,
            empresa_nombre,
            seccion,
            orden_seccion,
            orden_linea,
            cuenta_contable_id,
            cuenta_codigo,
            cuenta_nombre,
            monto,
            monto_clp,
            observacion
          `
        )
        .eq('empresa_id', empresaId)
        .order('orden_seccion', { ascending: true })
        .order('orden_linea', { ascending: true })

      if (balanceError) {
        throw new Error(balanceError.message)
      }

      setLineas((data ?? []) as BalanceLinea[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el Balance General.'
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

  const lineasFiltradas = useMemo(() => {
    const texto = normalize(busqueda)

    return lineas.filter((linea) => {
      if (seccionFiltro !== 'todas' && linea.seccion !== seccionFiltro) {
        return false
      }

      if (!texto) return true

      const searchable = [
        linea.seccion,
        linea.cuenta_codigo,
        linea.cuenta_nombre,
        linea.observacion,
      ]
        .map(normalize)
        .join(' ')

      return searchable.includes(texto)
    })
  }, [lineas, busqueda, seccionFiltro])

  const resumen = useMemo(() => {
    const totalActivo = lineas.reduce((acc, linea) => {
      if (linea.seccion === 'activo') return acc + Number(linea.monto || 0)
      return acc
    }, 0)

    const totalPasivo = lineas.reduce((acc, linea) => {
      if (linea.seccion === 'pasivo') return acc + Number(linea.monto || 0)
      return acc
    }, 0)

    const totalPatrimonio = lineas.reduce((acc, linea) => {
      if (linea.seccion === 'patrimonio') return acc + Number(linea.monto || 0)
      return acc
    }, 0)

    const totalPasivoPatrimonio = totalPasivo + totalPatrimonio
    const diferencia = totalActivo - totalPasivoPatrimonio

    return {
      totalActivo,
      totalPasivo,
      totalPatrimonio,
      totalPasivoPatrimonio,
      diferencia,
      cuadrado: Math.abs(diferencia) < 1,
    }
  }, [lineas])

  const lineasPorSeccion = useMemo(() => {
    return lineasFiltradas.reduce<Record<string, BalanceLinea[]>>((acc, linea) => {
      if (!acc[linea.seccion]) acc[linea.seccion] = []
      acc[linea.seccion].push(linea)
      return acc
    }, {})
  }, [lineasFiltradas])

  const handleReload = () => {
    if (!empresaActivaId) return
    void loadData(empresaActivaId)
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando Balance General...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al Balance General.
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
              Balance General inicial
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Balance operativo-contable basado en bancos, cuentas por cobrar y resultado
              calculado. Esta primera versión cuadra el patrimonio base de forma temporal
              mientras se integran cuentas por pagar, capital y asientos contables formales.
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
              href="/plan-cuentas/estado-resultados"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Estado de Resultados
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
            Total activo
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumen.totalActivo)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total pasivo
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumen.totalPasivo)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Patrimonio
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCLP(resumen.totalPatrimonio)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pasivo + patrimonio
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCLP(resumen.totalPasivoPatrimonio)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            resumen.cuadrado
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              resumen.cuadrado ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            Diferencia
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              resumen.cuadrado ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {formatCLP(resumen.diferencia)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[220px_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Sección
            </label>
            <select
              value={seccionFiltro}
              onChange={(event) =>
                setSeccionFiltro(
                  event.target.value as 'todas' | 'activo' | 'pasivo' | 'patrimonio'
                )
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todas">Todas</option>
              <option value="activo">Activo</option>
              <option value="pasivo">Pasivo</option>
              <option value="patrimonio">Patrimonio</option>
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
              placeholder="Buscar por cuenta, código u observación"
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

      {(['activo', 'pasivo', 'patrimonio'] as const).map((seccion) => {
        const items = lineasPorSeccion[seccion] ?? []
        const totalSeccion = items.reduce(
          (acc, item) => acc + Number(item.monto || 0),
          0
        )

        if (items.length === 0) return null

        return (
          <section
            key={seccion}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {seccionLabels[seccion]}
                </h2>
                <p className="text-sm text-slate-500">
                  Líneas del balance inicial operativo.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900">
                Total: {formatCLP(totalSeccion)}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Cuenta</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3">Observación</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((linea) => (
                      <tr key={`${linea.seccion}-${linea.cuenta_codigo}-${linea.orden_linea}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {linea.cuenta_codigo}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {linea.cuenta_nombre}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {formatCLP(linea.monto)}
                        </td>

                        <td className="min-w-[320px] px-4 py-3 text-slate-600">
                          {linea.observacion || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )
      })}

      {lineasFiltradas.length === 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            No hay líneas de balance para los filtros seleccionados.
          </p>
        </section>
      )}
    </main>
  )
}
