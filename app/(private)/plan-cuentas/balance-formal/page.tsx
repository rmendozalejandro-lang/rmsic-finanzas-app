'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type BalanceFormalLinea = {
  empresa_id: string
  empresa_nombre: string
  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: string
  seccion: 'activo' | 'pasivo' | 'patrimonio' | 'resultado'
  debe_inicial: number
  haber_inicial: number
  debe_movimientos: number
  haber_movimientos: number
  total_debe: number
  total_haber: number
  saldo_natural: number
  saldo_natural_clp: string | null
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export default function BalanceFormalPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [lineas, setLineas] = useState<BalanceFormalLinea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seccionFiltro, setSeccionFiltro] = useState<'todas' | 'activo' | 'pasivo' | 'patrimonio'>('todas')

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
        .from('v_balance_general_contable_formal')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('cuenta_codigo', { ascending: true })

      if (balanceError) throw new Error(balanceError.message)

      setLineas((data || []) as BalanceFormalLinea[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el balance formal.')
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
    const q = normalize(busqueda)

    return lineas.filter((linea) => {
      if (seccionFiltro !== 'todas' && linea.seccion !== seccionFiltro) return false
      if (!q) return true

      return [
        linea.cuenta_codigo,
        linea.cuenta_nombre,
        linea.cuenta_tipo,
        linea.seccion,
      ]
        .map(normalize)
        .join(' ')
        .includes(q)
    })
  }, [lineas, busqueda, seccionFiltro])

  const resumen = useMemo(() => {
    return lineasFiltradas.reduce(
      (acc, linea) => {
        if (linea.seccion === 'activo') acc.activo += Number(linea.saldo_natural || 0)
        if (linea.seccion === 'pasivo') acc.pasivo += Number(linea.saldo_natural || 0)
        if (linea.seccion === 'patrimonio') acc.patrimonio += Number(linea.saldo_natural || 0)

        acc.debeInicial += Number(linea.debe_inicial || 0)
        acc.haberInicial += Number(linea.haber_inicial || 0)
        acc.debeMovimientos += Number(linea.debe_movimientos || 0)
        acc.haberMovimientos += Number(linea.haber_movimientos || 0)

        return acc
      },
      {
        activo: 0,
        pasivo: 0,
        patrimonio: 0,
        debeInicial: 0,
        haberInicial: 0,
        debeMovimientos: 0,
        haberMovimientos: 0,
      }
    )
  }, [lineasFiltradas])

  const diferencia = resumen.activo - (resumen.pasivo + resumen.patrimonio)

  const handleReload = () => {
    if (!empresaActivaId) return
    void loadData(empresaActivaId)
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando balance formal...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al Balance General Formal.
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
              Balance General Contable Formal
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Vista basada en saldos iniciales contables y asientos contabilizados. 
              No reemplaza el Balance General operativo hasta que los saldos iniciales reales estén cargados.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || 'Sin empresa activa'}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReload}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Actualizar
            </button>

            <Link
              href="/plan-cuentas/saldos-iniciales"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Saldos Iniciales
            </Link>

            <Link
              href="/plan-cuentas/asientos"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Asientos
            </Link>

            <Link
              href="/plan-cuentas"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Plan de cuentas
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
        <Kpi title="Activo formal" value={money(resumen.activo)} tone="emerald" />
        <Kpi title="Pasivo formal" value={money(resumen.pasivo)} tone="rose" />
        <Kpi title="Patrimonio formal" value={money(resumen.patrimonio)} tone="slate" />
        <Kpi
          title="Diferencia"
          value={money(diferencia)}
          tone={Math.abs(diferencia) < 1 ? 'emerald' : 'amber'}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Debe inicial" value={money(resumen.debeInicial)} tone="rose" />
        <Kpi title="Haber inicial" value={money(resumen.haberInicial)} tone="emerald" />
        <Kpi title="Debe movimientos" value={money(resumen.debeMovimientos)} tone="rose" />
        <Kpi title="Haber movimientos" value={money(resumen.haberMovimientos)} tone="emerald" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Sección
            </label>
            <select
              value={seccionFiltro}
              onChange={(event) =>
                setSeccionFiltro(event.target.value as 'todas' | 'activo' | 'pasivo' | 'patrimonio')
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
              placeholder="Código, cuenta o sección"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Detalle por cuenta</h2>
          <p className="text-sm text-slate-500">
            Saldos naturales por cuenta de activo, pasivo y patrimonio.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3">Sección</th>
                  <th className="px-4 py-3">Debe inicial</th>
                  <th className="px-4 py-3">Haber inicial</th>
                  <th className="px-4 py-3">Debe mov.</th>
                  <th className="px-4 py-3">Haber mov.</th>
                  <th className="px-4 py-3">Total debe</th>
                  <th className="px-4 py-3">Total haber</th>
                  <th className="px-4 py-3">Saldo natural</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {lineasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No hay saldos formales para mostrar. Carga saldos iniciales reales o contabiliza asientos.
                    </td>
                  </tr>
                ) : (
                  lineasFiltradas.map((linea) => (
                    <tr key={linea.cuenta_contable_id} className="align-top">
                      <td className="min-w-[240px] px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {linea.cuenta_codigo} - {linea.cuenta_nombre}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {linea.cuenta_tipo}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {linea.seccion}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {money(linea.debe_inicial)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {money(linea.haber_inicial)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {money(linea.debe_movimientos)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {money(linea.haber_movimientos)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {money(linea.total_debe)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {money(linea.total_haber)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {money(linea.saldo_natural)}
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

function Kpi({
  title,
  value,
  tone = 'slate',
}: {
  title: string
  value: string
  tone?: 'emerald' | 'rose' | 'amber' | 'slate'
}) {
  const className = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    slate: 'text-slate-900',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-xl font-semibold ${className}`}>{value}</p>
    </div>
  )
}
