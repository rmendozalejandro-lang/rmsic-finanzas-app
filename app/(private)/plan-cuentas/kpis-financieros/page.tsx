'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type KpisFinancieros = {
  empresa_id: string
  empresa_nombre: string

  ingresos_totales: number
  ingresos_operacionales: number
  ingresos_no_operacionales: number

  costos_directos: number
  gastos_administrativos: number
  gastos_financieros: number
  impuestos: number
  depreciacion: number
  amortizacion: number
  otros_gastos: number
  gastos_totales: number

  resultado_periodo: number

  total_activo: number
  total_pasivo: number
  total_patrimonio: number
  bancos: number
  cuentas_por_cobrar: number
  cuentas_por_pagar: number

  asientos_total: number
  asientos_borrador: number
  asientos_contabilizados: number
  asientos_descuadrados: number

  movimientos_total: number
  movimientos_con_asiento: number
  movimientos_sin_asiento: number

  margen_bruto: number
  ebit: number
  ebitda: number
  activo_corriente: number
  pasivo_corriente: number
  capital_trabajo: number

  margen_bruto_pct: number
  margen_ebit_pct: number
  margen_ebitda_pct: number
  margen_neto_pct: number
  roa: number
  roe_referencial: number
  liquidez_corriente: number
  endeudamiento_activo: number
  endeudamiento_patrimonio: number
  avance_contabilizacion: number
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

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function getTone(value: number, positiveIsGood = true) {
  if (value === 0) return 'slate'
  if (positiveIsGood) return value > 0 ? 'emerald' : 'rose'
  return value > 0 ? 'rose' : 'emerald'
}

export default function KpisFinancierosPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [kpis, setKpis] = useState<KpisFinancieros | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        .from('v_kpis_financieros')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (kpiError) throw new Error(kpiError.message)

      setKpis((data || null) as KpisFinancieros | null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los KPIs financieros.')
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

  const health = useMemo(() => {
    if (!kpis) {
      return {
        margen: 'Sin datos',
        liquidez: 'Sin datos',
        endeudamiento: 'Sin datos',
        avance: 'Sin datos',
      }
    }

    return {
      margen:
        Number(kpis.margen_neto_pct || 0) >= 0.15
          ? 'Bueno'
          : Number(kpis.margen_neto_pct || 0) >= 0.05
            ? 'Aceptable'
            : 'Revisar',
      liquidez:
        Number(kpis.liquidez_corriente || 0) >= 1.5
          ? 'Buena'
          : Number(kpis.liquidez_corriente || 0) >= 1
            ? 'Ajustada'
            : 'Revisar',
      endeudamiento:
        Number(kpis.endeudamiento_activo || 0) <= 0.4
          ? 'Bajo'
          : Number(kpis.endeudamiento_activo || 0) <= 0.7
            ? 'Medio'
            : 'Alto',
      avance:
        Number(kpis.avance_contabilizacion || 0) >= 0.9
          ? 'Alto'
          : Number(kpis.avance_contabilizacion || 0) >= 0.5
            ? 'Medio'
            : 'Bajo',
    }
  }, [kpis])

  const handleReload = () => {
    if (!empresaActivaId) return
    void loadKpis(empresaActivaId)
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando KPIs financieros...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder a KPIs financieros.
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
            <p className="text-sm font-medium text-slate-500">Contabilidad y Finanzas</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              KPIs financieros
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Indicadores financieros calculados desde Estado de Resultados, Balance General,
              asientos contables y movimientos. El ROE es referencial mientras el patrimonio
              incluya saldos iniciales calculados.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || kpis?.empresa_nombre || 'Sin empresa activa'}
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
              href="/plan-cuentas/dashboard-contable"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Dashboard contable
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

      {!kpis ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">No hay datos para calcular KPIs financieros.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Ingresos operacionales" value={formatCLP(kpis.ingresos_operacionales)} tone="emerald" />
            <KpiCard title="Costos directos" value={formatCLP(kpis.costos_directos)} tone="rose" />
            <KpiCard title="Margen bruto" value={formatCLP(kpis.margen_bruto)} tone={getTone(kpis.margen_bruto)} />
            <KpiCard title="Margen bruto %" value={formatPercent(kpis.margen_bruto_pct)} tone={getTone(kpis.margen_bruto_pct)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="EBIT" value={formatCLP(kpis.ebit)} tone={getTone(kpis.ebit)} />
            <KpiCard title="EBITDA" value={formatCLP(kpis.ebitda)} tone={getTone(kpis.ebitda)} />
            <KpiCard title="Margen EBIT" value={formatPercent(kpis.margen_ebit_pct)} tone={getTone(kpis.margen_ebit_pct)} />
            <KpiCard title="Margen EBITDA" value={formatPercent(kpis.margen_ebitda_pct)} tone={getTone(kpis.margen_ebitda_pct)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Resultado período" value={formatCLP(kpis.resultado_periodo)} tone={getTone(kpis.resultado_periodo)} />
            <KpiCard title="Margen neto" value={formatPercent(kpis.margen_neto_pct)} tone={getTone(kpis.margen_neto_pct)} />
            <KpiCard title="ROA" value={formatPercent(kpis.roa)} tone={getTone(kpis.roa)} />
            <KpiCard title="ROE referencial" value={formatPercent(kpis.roe_referencial)} tone={getTone(kpis.roe_referencial)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Activo corriente" value={formatCLP(kpis.activo_corriente)} tone="emerald" />
            <KpiCard title="Pasivo corriente" value={formatCLP(kpis.pasivo_corriente)} tone="rose" />
            <KpiCard title="Capital de trabajo" value={formatCLP(kpis.capital_trabajo)} tone={getTone(kpis.capital_trabajo)} />
            <KpiCard title="Liquidez corriente" value={formatNumber(kpis.liquidez_corriente)} tone={getTone(kpis.liquidez_corriente)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Endeudamiento activo" value={formatPercent(kpis.endeudamiento_activo)} tone={getTone(kpis.endeudamiento_activo, false)} />
            <KpiCard title="Endeudamiento patrimonio" value={formatNumber(kpis.endeudamiento_patrimonio)} tone={getTone(kpis.endeudamiento_patrimonio, false)} />
            <KpiCard title="Avance contabilización" value={formatPercent(kpis.avance_contabilizacion)} tone={getTone(kpis.avance_contabilizacion)} />
            <KpiCard title="Asientos descuadrados" value={String(kpis.asientos_descuadrados)} tone={kpis.asientos_descuadrados === 0 ? 'emerald' : 'rose'} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Composición del resultado</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <tbody className="divide-y divide-slate-100 bg-white">
                    <Row label="Ingresos totales" value={formatCLP(kpis.ingresos_totales)} />
                    <Row label="Ingresos operacionales" value={formatCLP(kpis.ingresos_operacionales)} />
                    <Row label="Ingresos no operacionales" value={formatCLP(kpis.ingresos_no_operacionales)} />
                    <Row label="Costos directos" value={formatCLP(kpis.costos_directos)} />
                    <Row label="Gastos administrativos" value={formatCLP(kpis.gastos_administrativos)} />
                    <Row label="Gastos financieros" value={formatCLP(kpis.gastos_financieros)} />
                    <Row label="Impuestos" value={formatCLP(kpis.impuestos)} />
                    <Row label="Depreciación" value={formatCLP(kpis.depreciacion)} />
                    <Row label="Amortización" value={formatCLP(kpis.amortizacion)} />
                    <Row label="Otros gastos" value={formatCLP(kpis.otros_gastos)} />
                    <Row label="Gastos totales" value={formatCLP(kpis.gastos_totales)} />
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Lectura rápida</h2>
              <div className="mt-4 grid gap-3">
                <Insight label="Margen neto" value={health.margen} />
                <Insight label="Liquidez corriente" value={health.liquidez} />
                <Insight label="Endeudamiento" value={health.endeudamiento} />
                <Insight label="Avance de contabilización" value={health.avance} />
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                EBIT y EBITDA serán más precisos cuando existan cuentas o categorías específicas
                para depreciación y amortización. El ROE se considera referencial mientras el
                patrimonio incluya saldos calculados de apertura.
              </div>
            </div>
          </section>
        </>
      )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="px-4 py-3 text-slate-600">{label}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
        {value}
      </td>
    </tr>
  )
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}
