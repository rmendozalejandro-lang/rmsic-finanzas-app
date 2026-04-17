'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DateRangeFilter from '../components/DateRangeFilter'
import ReportPageHeader from '../components/ReportPageHeader'
import ExportExcelButton from '../components/ExportExcelButton'

type ResumenFinanciero = {
  ingresos_periodo: number
  egresos_periodo: number
  cuentas_por_cobrar: number
  saldo_bancos: number
}

type MovimientoResumen = {
  fecha: string
  monto_total?: number
  tipo_documento?: string | null
  tipo_movimiento?: string
}

type SerieMensual = {
  mes: string
  ingresos: number
  egresos: number
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatSignedCLP = (value: number) => {
  const signo = value < 0 ? '-' : ''
  return `${signo}$${Math.abs(Number(value || 0)).toLocaleString('es-CL')}`
}

const formatCLP = (value: number) => {
  return `$${Number(value || 0).toLocaleString('es-CL')}`
}

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'Sin base comparativa'
  const signo = value > 0 ? '+' : ''
  return `${signo}${value.toFixed(1)}%`
}

const getToday = () => new Date().toISOString().slice(0, 10)

const getFirstDayOfMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

const parseLocalDate = (value: string) => new Date(`${value}T00:00:00`)

const formatDateIso = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const diffDaysInclusive = (desde: string, hasta: string) => {
  const from = parseLocalDate(desde)
  const to = parseLocalDate(hasta)
  const diffMs = to.getTime() - from.getTime()
  return Math.floor(diffMs / 86400000) + 1
}

const getPreviousRange = (desde: string, hasta: string) => {
  const days = diffDaysInclusive(desde, hasta)
  const currentStart = parseLocalDate(desde)
  const prevEnd = addDays(currentStart, -1)
  const prevStart = addDays(prevEnd, -(days - 1))

  return {
    desde: formatDateIso(prevStart),
    hasta: formatDateIso(prevEnd),
  }
}

const getSixMonthsBack = (hasta: string) => {
  const end = parseLocalDate(hasta)
  return formatDateIso(new Date(end.getFullYear(), end.getMonth() - 5, 1))
}

const getSignedIngresoAmount = (item: {
  tipo_movimiento?: string
  tipo_documento?: string | null
  monto_total?: number
}) => {
  const monto = Number(item.monto_total || 0)
  const tipoMovimiento = (item.tipo_movimiento || '').toLowerCase()
  const tipoDocumento = (item.tipo_documento || '').toLowerCase()

  if (tipoMovimiento !== 'ingreso') return monto
  if (tipoDocumento === 'nota_credito') return -monto

  return monto
}

const calcVariation = (actual: number, previous: number) => {
  if (previous === 0) return null
  return ((actual - previous) / previous) * 100
}

const monthKeyFromDate = (value: string) => value.slice(0, 7)

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('es-CL', {
    month: 'short',
    year: 'numeric',
  })
}

function KpiCard({
  label,
  value,
  previous,
  variation,
}: {
  label: string
  value: number
  previous?: number
  variation?: number | null
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {formatSignedCLP(value)}
      </p>

      {previous !== undefined ? (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-slate-500">
            Período anterior:{' '}
            <span className="font-medium text-slate-700">
              {formatSignedCLP(previous)}
            </span>
          </p>
          <p
            className={
              variation === null
                ? 'text-slate-500'
                : variation >= 0
                ? 'text-emerald-700'
                : 'text-red-700'
            }
          >
            Variación:{' '}
            <span className="font-medium">{formatPercent(variation ?? null)}</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}

function MiniComparisonChart({ data }: { data: SerieMensual[] }) {
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.ingresos, item.egresos]),
    1
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Comparativo mensual
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Ingresos vs egresos de los últimos 6 meses dentro del rango consultado.
        </p>
      </div>

      <div className="flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((item) => {
          const ingresosHeight = Math.max((item.ingresos / maxValue) * 180, 6)
          const egresosHeight = Math.max((item.egresos / maxValue) * 180, 6)

          return (
            <div
              key={item.mes}
              className="flex min-w-[90px] flex-col items-center gap-2"
            >
              <div className="flex h-[200px] items-end gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 rounded-t bg-emerald-500"
                    style={{ height: `${ingresosHeight}px` }}
                    title={`Ingresos: ${formatCLP(item.ingresos)}`}
                  />
                  <span className="text-[10px] text-slate-500">Ing.</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 rounded-t bg-rose-500"
                    style={{ height: `${egresosHeight}px` }}
                    title={`Egresos: ${formatCLP(item.egresos)}`}
                  />
                  <span className="text-[10px] text-slate-500">Egr.</span>
                </div>
              </div>

              <div className="text-center text-xs text-slate-600">
                {formatMonthLabel(item.mes)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-emerald-500" />
          Ingresos
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-rose-500" />
          Egresos
        </div>
      </div>
    </div>
  )
}

export default function ResumenFinancieroPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null)
  const [periodoAnterior, setPeriodoAnterior] = useState<{
    ingresos: number
    egresos: number
    saldoNeto: number
  } | null>(null)
  const [serieMensual, setSerieMensual] = useState<SerieMensual[]>([])

  const [desde, setDesde] = useState(getFirstDayOfMonth())
  const [hasta, setHasta] = useState(getToday())

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
      const empresaNombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

      setEmpresaActivaId(empresaId)
      setEmpresaActivaNombre(empresaNombre)
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  const handlePresetChange = (preset: string) => {
    const now = new Date()

    if (preset === 'este_mes') {
      setDesde(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
      setHasta(getToday())
      return
    }

    if (preset === 'mes_pasado') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0)
      setDesde(firstDayPrev.toISOString().slice(0, 10))
      setHasta(lastDayPrev.toISOString().slice(0, 10))
      return
    }

    if (preset === 'anio_actual') {
      setDesde(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10))
      setHasta(getToday())
      return
    }

    if (preset === 'ultimos_30') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setDesde(d.toISOString().slice(0, 10))
      setHasta(getToday())
    }
  }

  useEffect(() => {
    const fetchResumenFinanciero = async () => {
      if (!empresaActivaId || !desde || !hasta) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const { data: sessionData } = await supabase.auth.getSession()

        if (!sessionData.session) {
          router.push('/login')
          return
        }

        const accessToken = sessionData.session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        const headers = {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
        }

        const rangoAnterior = getPreviousRange(desde, hasta)
        const desdeGrafico = getSixMonthsBack(hasta)

        const [
          cobranzaResp,
          saldosResp,
          ingresosResp,
          egresosResp,
          ingresosPrevResp,
          egresosPrevResp,
          ingresosGrafResp,
          egresosGrafResp,
        ] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=saldo_pendiente`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=saldo_calculado`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=fecha,monto_total,tipo_documento,tipo_movimiento&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${desde}&fecha=lte.${hasta}`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=fecha,monto_total&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&fecha=gte.${desde}&fecha=lte.${hasta}`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=fecha,monto_total,tipo_documento,tipo_movimiento&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${rangoAnterior.desde}&fecha=lte.${rangoAnterior.hasta}`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=fecha,monto_total&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&fecha=gte.${rangoAnterior.desde}&fecha=lte.${rangoAnterior.hasta}`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=fecha,monto_total,tipo_documento,tipo_movimiento&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${desdeGrafico}&fecha=lte.${hasta}`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=fecha,monto_total&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&fecha=gte.${desdeGrafico}&fecha=lte.${hasta}`,
            { headers }
          ),
        ])

        const [
          cobranzaJson,
          saldosJson,
          ingresosJson,
          egresosJson,
          ingresosPrevJson,
          egresosPrevJson,
          ingresosGrafJson,
          egresosGrafJson,
        ] = await Promise.all([
          cobranzaResp.json(),
          saldosResp.json(),
          ingresosResp.json(),
          egresosResp.json(),
          ingresosPrevResp.json(),
          egresosPrevResp.json(),
          ingresosGrafResp.json(),
          egresosGrafResp.json(),
        ])

        if (
          !cobranzaResp.ok ||
          !saldosResp.ok ||
          !ingresosResp.ok ||
          !egresosResp.ok ||
          !ingresosPrevResp.ok ||
          !egresosPrevResp.ok ||
          !ingresosGrafResp.ok ||
          !egresosGrafResp.ok
        ) {
          setError('No se pudo cargar el resumen financiero comparativo.')
          return
        }

        const cuentasPorCobrar = Array.isArray(cobranzaJson)
          ? cobranzaJson.reduce(
              (acc: number, item: { saldo_pendiente?: number }) =>
                acc + Number(item.saldo_pendiente || 0),
              0
            )
          : 0

        const saldoBancos = Array.isArray(saldosJson)
          ? saldosJson.reduce(
              (acc: number, item: { saldo_calculado?: number }) =>
                acc + Number(item.saldo_calculado || 0),
              0
            )
          : 0

        const ingresosPeriodo = Array.isArray(ingresosJson)
          ? ingresosJson.reduce(
              (acc: number, item: MovimientoResumen) => acc + getSignedIngresoAmount(item),
              0
            )
          : 0

        const egresosPeriodo = Array.isArray(egresosJson)
          ? egresosJson.reduce(
              (acc: number, item: MovimientoResumen) =>
                acc + Number(item.monto_total || 0),
              0
            )
          : 0

        const ingresosPeriodoAnterior = Array.isArray(ingresosPrevJson)
          ? ingresosPrevJson.reduce(
              (acc: number, item: MovimientoResumen) => acc + getSignedIngresoAmount(item),
              0
            )
          : 0

        const egresosPeriodoAnterior = Array.isArray(egresosPrevJson)
          ? egresosPrevJson.reduce(
              (acc: number, item: MovimientoResumen) =>
                acc + Number(item.monto_total || 0),
              0
            )
          : 0

        const ingresosMap = new Map<string, number>()
        const egresosMap = new Map<string, number>()

        if (Array.isArray(ingresosGrafJson)) {
          ingresosGrafJson.forEach((item: MovimientoResumen) => {
            const key = monthKeyFromDate(item.fecha)
            ingresosMap.set(key, (ingresosMap.get(key) || 0) + getSignedIngresoAmount(item))
          })
        }

        if (Array.isArray(egresosGrafJson)) {
          egresosGrafJson.forEach((item: MovimientoResumen) => {
            const key = monthKeyFromDate(item.fecha)
            egresosMap.set(key, (egresosMap.get(key) || 0) + Number(item.monto_total || 0))
          })
        }

        const seriesKeys = new Set<string>([
          ...Array.from(ingresosMap.keys()),
          ...Array.from(egresosMap.keys()),
        ])

        const serie = Array.from(seriesKeys)
          .sort()
          .map((mes) => ({
            mes,
            ingresos: ingresosMap.get(mes) || 0,
            egresos: egresosMap.get(mes) || 0,
          }))

        setResumen({
          ingresos_periodo: ingresosPeriodo,
          egresos_periodo: egresosPeriodo,
          cuentas_por_cobrar: cuentasPorCobrar,
          saldo_bancos: saldoBancos,
        })

        setPeriodoAnterior({
          ingresos: ingresosPeriodoAnterior,
          egresos: egresosPeriodoAnterior,
          saldoNeto: ingresosPeriodoAnterior - egresosPeriodoAnterior,
        })

        setSerieMensual(serie)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Error desconocido')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchResumenFinanciero()
  }, [router, empresaActivaId, desde, hasta])

  const saldoNeto = useMemo(() => {
    return Number(resumen?.ingresos_periodo || 0) - Number(resumen?.egresos_periodo || 0)
  }, [resumen])

  const variacionIngresos = useMemo(() => {
    return calcVariation(
      Number(resumen?.ingresos_periodo || 0),
      Number(periodoAnterior?.ingresos || 0)
    )
  }, [resumen, periodoAnterior])

  const variacionEgresos = useMemo(() => {
    return calcVariation(
      Number(resumen?.egresos_periodo || 0),
      Number(periodoAnterior?.egresos || 0)
    )
  }, [resumen, periodoAnterior])

  const variacionSaldo = useMemo(() => {
    return calcVariation(saldoNeto, Number(periodoAnterior?.saldoNeto || 0))
  }, [saldoNeto, periodoAnterior])

  const excelRows = useMemo(() => {
    return [
      {
        Concepto: 'Ingresos del período',
        Valor: Number(resumen?.ingresos_periodo || 0),
        Periodo_anterior: Number(periodoAnterior?.ingresos || 0),
        Variacion_porcentual:
          variacionIngresos === null ? 'Sin base comparativa' : variacionIngresos,
      },
      {
        Concepto: 'Egresos del período',
        Valor: Number(resumen?.egresos_periodo || 0),
        Periodo_anterior: Number(periodoAnterior?.egresos || 0),
        Variacion_porcentual:
          variacionEgresos === null ? 'Sin base comparativa' : variacionEgresos,
      },
      {
        Concepto: 'Saldo neto',
        Valor: Number(saldoNeto || 0),
        Periodo_anterior: Number(periodoAnterior?.saldoNeto || 0),
        Variacion_porcentual:
          variacionSaldo === null ? 'Sin base comparativa' : variacionSaldo,
      },
      {
        Concepto: 'Cuentas por cobrar',
        Valor: Number(resumen?.cuentas_por_cobrar || 0),
        Periodo_anterior: '',
        Variacion_porcentual: '',
      },
      {
        Concepto: 'Saldo total bancos',
        Valor: Number(resumen?.saldo_bancos || 0),
        Periodo_anterior: '',
        Variacion_porcentual: '',
      },
    ]
  }, [resumen, periodoAnterior, saldoNeto, variacionIngresos, variacionEgresos, variacionSaldo])

  return (
    <main className="space-y-6">
      <ReportPageHeader
        title="Resumen financiero"
        empresaActivaNombre={empresaActivaNombre}
        subtitle="Vista consolidada con comparativo del período y evolución mensual."
        desde={desde}
        hasta={hasta}
        rightActions={
          <ExportExcelButton
            fileName={`resumen_financiero_${empresaActivaNombre || 'empresa'}_${desde}_${hasta}.xlsx`}
            sheetName="Resumen"
            rows={excelRows}
            disabled={loading}
          />
        }
      />

      <DateRangeFilter
        desde={desde}
        hasta={hasta}
        onDesdeChange={setDesde}
        onHastaChange={setHasta}
        onPresetChange={handlePresetChange}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando resumen financiero...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && resumen && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Ingresos del período"
              value={resumen.ingresos_periodo}
              previous={periodoAnterior?.ingresos}
              variation={variacionIngresos}
            />

            <KpiCard
              label="Egresos del período"
              value={resumen.egresos_periodo}
              previous={periodoAnterior?.egresos}
              variation={variacionEgresos}
            />

            <KpiCard
              label="Saldo neto"
              value={saldoNeto}
              previous={periodoAnterior?.saldoNeto}
              variation={variacionSaldo}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Cuentas por cobrar</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCLP(resumen.cuentas_por_cobrar)}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Snapshot actual de cobranza pendiente
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Saldo total bancos</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCLP(resumen.saldo_bancos)}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Snapshot actual de cuentas bancarias
              </p>
            </div>
          </div>

          {serieMensual.length > 0 ? (
            <MiniComparisonChart data={serieMensual} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-500">
              No hay suficiente información para construir el gráfico mensual.
            </div>
          )}
        </>
      )}
    </main>
  )
}