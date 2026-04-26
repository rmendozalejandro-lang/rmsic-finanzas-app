'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type DashboardKpis = {
  empresa_id: string
  empresa_nombre: string
  total_activo: number
  total_pasivo: number
  total_patrimonio: number
  ingresos: number
  gastos: number
  resultado_periodo: number
  margen_resultado: number
  asientos_total: number
  asientos_borrador: number
  asientos_contabilizados: number
  asientos_descuadrados: number
  movimientos_total: number
  movimientos_con_asiento: number
  movimientos_sin_asiento: number
  avance_contabilizacion: number
}

type ResultadoMasivo = {
  movimiento_id: string
  asiento_id: string | null
  resultado: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function formatCLP(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatPercent(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CL', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))
}

export default function DashboardContablePage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [soloPagados, setSoloPagados] = useState(false)
  const [resultadoMasivo, setResultadoMasivo] = useState<ResultadoMasivo[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const loadKpis = async (empresaId: string) => {
    if (!empresaId) {
      setKpis(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data, error: kpiError } = await supabase
        .from('v_dashboard_contable_kpis')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (kpiError) throw new Error(kpiError.message)

      setKpis((data || null) as DashboardKpis | null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard contable.')
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
      await loadKpis(id)
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

  const balanceDiferencia = useMemo(() => {
    if (!kpis) return 0
    return Number(kpis.total_activo || 0) - (Number(kpis.total_pasivo || 0) + Number(kpis.total_patrimonio || 0))
  }, [kpis])

  const handleGenerarMasivo = async () => {
    if (!empresaActivaId) {
      setError('No hay empresa activa.')
      return
    }

    if (!canManage) {
      setError('Solo usuarios admin pueden generar asientos pendientes.')
      return
    }

    const confirmed = window.confirm(
      soloPagados
        ? 'Se generarán asientos en borrador solo para movimientos pagados sin asiento. ¿Deseas continuar?'
        : 'Se generarán asientos en borrador para todos los movimientos sin asiento. ¿Deseas continuar?'
    )

    if (!confirmed) return

    try {
      setGenerating(true)
      setError('')
      setSuccess('')
      setResultadoMasivo([])

      const { data, error: rpcError } = await supabase.rpc(
        'generar_asientos_borrador_movimientos_pendientes',
        {
          p_empresa_id: empresaActivaId,
          p_solo_pagados: soloPagados,
        }
      )

      if (rpcError) throw new Error(rpcError.message)

      const rows = (data || []) as ResultadoMasivo[]
      const creados = rows.filter((item) => item.resultado === 'creado').length
      const errores = rows.length - creados

      setResultadoMasivo(rows)
      setSuccess(`Proceso finalizado. Asientos creados: ${creados}. Observaciones/errores: ${errores}.`)
      await loadKpis(empresaActivaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar asientos pendientes.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando dashboard contable...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al Dashboard Contable.
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
            <p className="text-sm font-medium text-slate-500">Contabilidad</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Dashboard contable
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Indicadores principales de balance, resultado, asientos y avance de contabilización.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || kpis?.empresa_nombre || 'Sin empresa activa'}
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
              href="/plan-cuentas/asientos"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Asientos
            </Link>

            <Link
              href="/plan-cuentas/exportar-reportes"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Exportar reportes
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Activo" value={formatCLP(kpis?.total_activo)} tone="emerald" />
        <KpiCard title="Pasivo" value={formatCLP(kpis?.total_pasivo)} tone="rose" />
        <KpiCard title="Patrimonio" value={formatCLP(kpis?.total_patrimonio)} tone="slate" />
        <KpiCard
          title="Diferencia balance"
          value={formatCLP(balanceDiferencia)}
          tone={Math.abs(balanceDiferencia) < 1 ? 'emerald' : 'amber'}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Ingresos" value={formatCLP(kpis?.ingresos)} tone="emerald" />
        <KpiCard title="Gastos" value={formatCLP(kpis?.gastos)} tone="rose" />
        <KpiCard
          title="Resultado"
          value={formatCLP(kpis?.resultado_periodo)}
          tone={Number(kpis?.resultado_periodo || 0) >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          title="Margen"
          value={formatPercent(kpis?.margen_resultado)}
          tone={Number(kpis?.margen_resultado || 0) >= 0 ? 'emerald' : 'rose'}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Asientos total" value={String(kpis?.asientos_total || 0)} tone="slate" />
        <KpiCard title="Borradores" value={String(kpis?.asientos_borrador || 0)} tone="amber" />
        <KpiCard title="Contabilizados" value={String(kpis?.asientos_contabilizados || 0)} tone="emerald" />
        <KpiCard title="Descuadrados" value={String(kpis?.asientos_descuadrados || 0)} tone={Number(kpis?.asientos_descuadrados || 0) === 0 ? 'emerald' : 'rose'} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Movimientos" value={String(kpis?.movimientos_total || 0)} tone="slate" />
        <KpiCard title="Con asiento" value={String(kpis?.movimientos_con_asiento || 0)} tone="emerald" />
        <KpiCard title="Sin asiento" value={String(kpis?.movimientos_sin_asiento || 0)} tone="amber" />
        <KpiCard title="Avance contabilización" value={formatPercent(kpis?.avance_contabilizacion)} tone="emerald" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Generación masiva segura
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Crea asientos sugeridos en estado borrador para movimientos sin asiento. No contabiliza automáticamente.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={soloPagados}
                onChange={(event) => setSoloPagados(event.target.checked)}
              />
              Solo pagados
            </label>

            <button
              type="button"
              disabled={!canManage || generating || Number(kpis?.movimientos_sin_asiento || 0) === 0}
              onClick={handleGenerarMasivo}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? 'Generando...' : 'Generar asientos pendientes'}
            </button>
          </div>
        </div>

        {resultadoMasivo.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="max-h-[320px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Movimiento</th>
                    <th className="px-4 py-3">Asiento</th>
                    <th className="px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {resultadoMasivo.map((item) => (
                    <tr key={item.movimiento_id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.movimiento_id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.asiento_id || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.resultado}</td>
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

function KpiCard({
  title,
  value,
  tone,
}: {
  title: string
  value: string
  tone: 'emerald' | 'rose' | 'amber' | 'slate'
}) {
  const toneClass = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    slate: 'text-slate-900',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}
