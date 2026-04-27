'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import StatusBadge from '../../components/StatusBadge'

type ResumenOperativo = {
  saldo_total_bancos: number
  total_por_cobrar: number
  ingresos_periodo: number
  egresos_periodo: number
}

type CobranzaPendiente = {
  fecha_emision: string
  fecha_vencimiento: string | null
  cliente: string
  numero_factura: string
  descripcion: string
  monto_total: number
  saldo_pendiente: number
  estado: string
  empresa_id?: string
}

type UltimoMovimiento = {
  id: string
  fecha: string
  tipo_movimiento: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
  monto_total: number
  estado: string
  empresa_id: string
}

type FiltroMovimiento = 'todos' | 'ingreso' | 'egreso'
type PeriodoPreset =
  | 'today'
  | '7d'
  | 'this_month'
  | 'last_month'
  | '30d'
  | '90d'
  | 'custom'

type ChartPoint = {
  label: string
  ingresos: number
  egresos: number
  flujo: number
}

const STORAGE_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateCL = (value: string) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CL')
}

const daysBetween = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

const getRangeFromPreset = (
  preset: PeriodoPreset,
  customFrom: string,
  customTo: string
) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') {
    const value = formatDateInput(today)
    return { from: value, to: value, label: 'Hoy' }
  }

  if (preset === '7d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
      label: 'Últimos 7 días',
    }
  }

  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
      label: 'Este mes',
    }
  }

  if (preset === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return {
      from: formatDateInput(from),
      to: formatDateInput(to),
      label: 'Mes anterior',
    }
  }

  if (preset === '30d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
      label: 'Últimos 30 días',
    }
  }

  if (preset === '90d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 89)
    return {
      from: formatDateInput(from),
      to: formatDateInput(today),
      label: 'Últimos 90 días',
    }
  }

  const safeFrom =
    customFrom || formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
  const safeTo = customTo || formatDateInput(today)

  if (safeFrom <= safeTo) {
    return {
      from: safeFrom,
      to: safeTo,
      label: 'Período personalizado',
    }
  }

  return {
    from: safeTo,
    to: safeFrom,
    label: 'Período personalizado',
  }
}

const getEstadoVisual = (estado: string, fechaVencimiento: string | null) => {
  const base = (estado || '').toLowerCase()

  if (base === 'vencido') return 'vencido'
  if (!fechaVencimiento) return estado
  if (base === 'pagado') return estado

  const hoy = new Date()
  const vencimiento = new Date(`${fechaVencimiento}T23:59:59`)

  if ((base === 'pendiente' || base === 'parcial') && vencimiento < hoy) {
    return 'vencido'
  }

  return estado
}

const isVencida = (estado: string, fechaVencimiento: string | null) => {
  const base = (estado || '').toLowerCase()

  if (base === 'vencido') return true
  if (!fechaVencimiento) return false
  if (base === 'pagado') return false

  const hoy = new Date()
  const vencimiento = new Date(`${fechaVencimiento}T23:59:59`)

  return (base === 'pendiente' || base === 'parcial') && vencimiento < hoy
}

const isPorVencerEstaSemana = (estado: string, fechaVencimiento: string | null) => {
  if (!fechaVencimiento) return false

  const base = (estado || '').toLowerCase()
  if (base === 'pagado' || base === 'vencido') return false

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const finSemana = new Date(inicioHoy)
  finSemana.setDate(finSemana.getDate() + 7)

  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)

  return (
    (base === 'pendiente' || base === 'parcial') &&
    vencimiento >= inicioHoy &&
    vencimiento <= finSemana
  )
}

const formatTipoMovimiento = (value: string) => {
  switch ((value || '').toLowerCase()) {
    case 'ingreso':
      return 'Ingreso'
    case 'egreso':
      return 'Egreso'
    default:
      return value || '-'
  }
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

const formatSignedCLP = (value: number) => {
  const signo = value < 0 ? '-' : ''
  return `${signo}$${Math.abs(Number(value || 0)).toLocaleString('es-CL')}`
}

function KpiCard({
  title,
  value,
  meta,
}: {
  title: string
  value: string
  meta?: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {meta ? <p className="mt-2 text-sm text-slate-500">{meta}</p> : null}
    </div>
  )
}

function AlertCard({
  title,
  value,
  tone,
}: {
  title: string
  value: string
  tone: 'red' | 'amber' | 'blue'
}) {
  const styles =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  const subtitleTone =
    tone === 'red'
      ? 'text-red-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-blue-700'

  return (
    <div className={`rounded-[24px] border p-6 shadow-sm ${styles}`}>
      <p className={`text-sm ${subtitleTone}`}>{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function ComparisonChart({ data }: { data: ChartPoint[] }) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [Math.abs(item.ingresos), Math.abs(item.egresos)])
  )

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No hay información suficiente para construir el gráfico del período.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#163A5F]" />
          Ingresos
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-400" />
          Egresos
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[760px] items-end gap-4 pb-2">
          {data.map((item) => {
            const ingresoHeight = Math.max(
              10,
              (Math.abs(item.ingresos) / maxValue) * 220
            )
            const egresoHeight = Math.max(
              10,
              (Math.abs(item.egresos) / maxValue) * 220
            )

            return (
              <div key={item.label} className="flex min-w-[64px] flex-col items-center gap-3">
                <div className="flex h-[240px] items-end gap-2">
                  <div
                    className="w-5 rounded-t-xl bg-[#163A5F]"
                    style={{ height: `${ingresoHeight}px` }}
                    title={`Ingresos: ${formatSignedCLP(item.ingresos)}`}
                  />
                  <div
                    className="w-5 rounded-t-xl bg-slate-400"
                    style={{ height: `${egresoHeight}px` }}
                    title={`Egresos: ${formatSignedCLP(item.egresos)}`}
                  />
                </div>
                <div className="text-center text-xs text-slate-500">{item.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FlowChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No hay datos suficientes para la evolución del flujo.
      </div>
    )
  }

  const width = Math.max(760, data.length * 84)
  const height = 280
  const padding = 28

  const values = data.map((item) => item.flujo)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const range = maxValue - minValue || 1

  const xForIndex = (index: number) => {
    if (data.length === 1) return width / 2
    return padding + (index * (width - padding * 2)) / (data.length - 1)
  }

  const yForValue = (value: number) =>
    padding + ((maxValue - value) * (height - padding * 2)) / range

  const points = data
    .map((item, index) => `${xForIndex(index)},${yForValue(item.flujo)}`)
    .join(' ')

  const baselineY = yForValue(0)

  return (
    <div className="space-y-3 overflow-x-auto">
      <svg
        width={width}
        height={height}
        className="min-w-[760px] rounded-2xl bg-slate-50"
      >
        <line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke="#CBD5E1"
          strokeDasharray="4 4"
        />

        {[0, 1, 2, 3].map((step) => {
          const y = padding + ((height - padding * 2) / 3) * step
          return (
            <line
              key={step}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#E2E8F0"
            />
          )
        })}

        <polyline
          fill="none"
          stroke="#163A5F"
          strokeWidth="3"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((item, index) => {
          const x = xForIndex(index)
          const y = yForValue(item.flujo)

          return (
            <g key={item.label}>
              <circle cx={x} cy={y} r="4.5" fill="#163A5F" />
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#64748B"
              >
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="text-xs text-slate-500">
        La línea muestra el flujo neto del período seleccionado.
      </p>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()

  const today = useMemo(() => new Date(), [])
  const defaultCustomFrom = formatDateInput(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const defaultCustomTo = formatDateInput(
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  )

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [resumen, setResumen] = useState<ResumenOperativo | null>(null)
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [movimientosPeriodo, setMovimientosPeriodo] = useState<UltimoMovimiento[]>([])
  const [ultimosMovimientos, setUltimosMovimientos] = useState<UltimoMovimiento[]>([])
  const [filtroMovimientos, setFiltroMovimientos] = useState<FiltroMovimiento>('todos')
  const [periodo, setPeriodo] = useState<PeriodoPreset>('this_month')
  const [customFrom, setCustomFrom] = useState(defaultCustomFrom)
  const [customTo, setCustomTo] = useState(defaultCustomTo)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const rangoActual = useMemo(
    () => getRangeFromPreset(periodo, customFrom, customTo),
    [periodo, customFrom, customTo]
  )

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
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

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!empresaActivaId) {
  setResumen(null)
  setCobranza([])
  setMovimientosPeriodo([])
  setUltimosMovimientos([])
  setLoading(false)
  return
}

      try {
        setLoading(true)
setError('')
setResumen(null)
setCobranza([])
setMovimientosPeriodo([])
setUltimosMovimientos([])

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

        const from = rangoActual.from
        const to = rangoActual.to

        const [saldosResp, cobranzaResp, movimientosResp] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=saldo_calculado`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_movimiento,tipo_documento,numero_documento,descripcion,monto_total,estado,empresa_id&empresa_id=eq.${empresaActivaId}&fecha=gte.${from}&fecha=lte.${to}&order=fecha.asc`,
            { headers }
          ),
        ])

        const saldosJson = await saldosResp.json()
        const cobranzaJson = await cobranzaResp.json()
        const movimientosJson = await movimientosResp.json()

        if (!saldosResp.ok) {
          setError('No se pudo cargar el resumen bancario.')
          return
        }

        if (!cobranzaResp.ok) {
          setError('No se pudo cargar la cobranza pendiente.')
          return
        }

        if (!movimientosResp.ok) {
          setError('No se pudieron cargar los movimientos del período.')
          return
        }

        const movimientos = Array.isArray(movimientosJson)
          ? (movimientosJson as UltimoMovimiento[])
          : []

        const saldoTotalBancos = Array.isArray(saldosJson)
          ? saldosJson.reduce(
              (acc: number, item: { saldo_calculado?: number }) =>
                acc + Number(item.saldo_calculado || 0),
              0
            )
          : 0

        const totalPorCobrar = Array.isArray(cobranzaJson)
          ? cobranzaJson.reduce(
              (acc: number, item: CobranzaPendiente) =>
                acc + Number(item.saldo_pendiente || 0),
              0
            )
          : 0

        const ingresosPeriodo = movimientos.reduce((acc, item) => {
          if ((item.tipo_movimiento || '').toLowerCase() !== 'ingreso') return acc
          return acc + getSignedIngresoAmount(item)
        }, 0)

        const egresosPeriodo = movimientos.reduce((acc, item) => {
          if ((item.tipo_movimiento || '').toLowerCase() !== 'egreso') return acc
          return acc + Number(item.monto_total || 0)
        }, 0)

        const movimientosDesc = [...movimientos].sort((a, b) =>
          b.fecha.localeCompare(a.fecha)
        )

        setResumen({
          saldo_total_bancos: saldoTotalBancos,
          total_por_cobrar: totalPorCobrar,
          ingresos_periodo: ingresosPeriodo,
          egresos_periodo: egresosPeriodo,
        })

        setCobranza(cobranzaJson ?? [])
        setMovimientosPeriodo(movimientos)
        setUltimosMovimientos(movimientosDesc.slice(0, 12))
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

    fetchDashboard()
  }, [router, empresaActivaId, rangoActual.from, rangoActual.to])

  const facturasVencidas = useMemo(
    () => cobranza.filter((item) => isVencida(item.estado, item.fecha_vencimiento)),
    [cobranza]
  )

  const porVencerSemana = useMemo(
    () => cobranza.filter((item) => isPorVencerEstaSemana(item.estado, item.fecha_vencimiento)),
    [cobranza]
  )

  const montoVencidoTotal = useMemo(
    () =>
      facturasVencidas.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [facturasVencidas]
  )

  const movimientosFiltrados = useMemo(() => {
    if (filtroMovimientos === 'todos') return ultimosMovimientos
    return ultimosMovimientos.filter(
      (item) => item.tipo_movimiento === filtroMovimientos
    )
  }, [ultimosMovimientos, filtroMovimientos])

  const flujoNeto = useMemo(() => {
    if (!resumen) return 0
    return Number(resumen.ingresos_periodo || 0) - Number(resumen.egresos_periodo || 0)
  }, [resumen])

  const chartData = useMemo(() => {
    if (movimientosPeriodo.length === 0) return []

    const totalDays = daysBetween(rangoActual.from, rangoActual.to)
    const groupByMonth = totalDays > 45
    const bucket = new Map<string, ChartPoint>()

    movimientosPeriodo.forEach((item) => {
      const date = new Date(`${item.fecha}T00:00:00`)
      const label = groupByMonth
        ? date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' })
        : date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })

      const current = bucket.get(label) ?? {
        label,
        ingresos: 0,
        egresos: 0,
        flujo: 0,
      }

      if ((item.tipo_movimiento || '').toLowerCase() === 'ingreso') {
        current.ingresos += getSignedIngresoAmount(item)
      }

      if ((item.tipo_movimiento || '').toLowerCase() === 'egreso') {
        current.egresos += Number(item.monto_total || 0)
      }

      current.flujo = current.ingresos - current.egresos
      bucket.set(label, current)
    })

    return Array.from(bucket.values())
  }, [movimientosPeriodo, rangoActual.from, rangoActual.to])

  const handleExportPdf = () => {
    if (!resumen) return

    const originalTitle = document.title
    document.title = `Auren - Dashboard - ${empresaActivaNombre || 'Empresa'} - ${rangoActual.from} a ${rangoActual.to}`

    window.print()

    window.setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8 print:hidden">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Auren</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Dashboard financiero
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Resumen general de la operación y estado financiero de la empresa activa.
            </p>

            {empresaActivaNombre ? (
              <div className="mt-4 inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Mostrando información de:
                <span className="ml-2 font-semibold text-slate-900">
                  {empresaActivaNombre}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-3">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as PeriodoPreset)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#245C90]"
              >
                <option value="today">Hoy</option>
                <option value="7d">Últimos 7 días</option>
                <option value="this_month">Este mes</option>
                <option value="last_month">Mes anterior</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="custom">Personalizado</option>
              </select>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading || !resumen}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Exportar PDF
              </button>

              <button
                type="button"
                className="rounded-2xl bg-[#163A5F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#245C90]"
              >
                Ver detalle
              </button>
            </div>

            {periodo === 'custom' ? (
              <div className="flex flex-wrap gap-3">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#245C90]"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#245C90]"
                />
              </div>
            ) : null}

            <p className="text-sm text-slate-500">
              Período seleccionado:{' '}
              <span className="font-medium text-slate-700">{rangoActual.label}</span>
            </p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Auren</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Cargando datos
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Estamos obteniendo la información de la empresa activa.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && resumen && (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Auren</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                  Dashboard financiero
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Empresa: <span className="font-medium text-slate-700">{empresaActivaNombre || 'Sin empresa activa'}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Período: <span className="font-medium text-slate-700">{rangoActual.label}</span> ({rangoActual.from} a {rangoActual.to})
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Saldo total bancos"
              value={`$${Number(resumen.saldo_total_bancos).toLocaleString('es-CL')}`}
              meta="Estado actual consolidado de cuentas bancarias."
            />
            <KpiCard
              title="Cobranza pendiente"
              value={`$${Number(resumen.total_por_cobrar).toLocaleString('es-CL')}`}
              meta="Saldo actual pendiente de cobro."
            />
            <KpiCard
              title="Ingresos del período"
              value={formatSignedCLP(resumen.ingresos_periodo)}
              meta={`Calculado para ${rangoActual.label.toLowerCase()}.`}
            />
            <KpiCard
              title="Egresos del período"
              value={`$${Number(resumen.egresos_periodo).toLocaleString('es-CL')}`}
              meta={`Calculado para ${rangoActual.label.toLowerCase()}.`}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AlertCard
              title="Facturas vencidas"
              value={String(facturasVencidas.length)}
              tone="red"
            />
            <AlertCard
              title="Monto vencido total"
              value={`$${montoVencidoTotal.toLocaleString('es-CL')}`}
              tone="amber"
            />
            <AlertCard
              title="Por vencer esta semana"
              value={String(porVencerSemana.length)}
              tone="blue"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Ingresos vs egresos
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Comparativo del período seleccionado.
                </p>
              </div>

              <ComparisonChart data={chartData} />
            </div>

            <div className="space-y-4 xl:col-span-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Flujo neto del período
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Ingresos menos egresos para el rango seleccionado.
                </p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                  {formatSignedCLP(flujoNeto)}
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Estado actual
                </h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    Cobranza pendiente vigente:{' '}
                    <span className="font-medium text-slate-900">{cobranza.length}</span>{' '}
                    documentos.
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                    Facturas vencidas: <span className="font-medium">{facturasVencidas.length}</span>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
                    Por vencer esta semana: <span className="font-medium">{porVencerSemana.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Evolución del flujo neto
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Tendencia del flujo neto dentro del período seleccionado.
              </p>
            </div>

            <FlowChart data={chartData} />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Cobranza pendiente
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Facturas activas pendientes de cobro de la empresa activa.
              </p>
            </div>

            {cobranza.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No hay facturas pendientes por cobrar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-3 pr-4 font-medium">Cliente</th>
                      <th className="py-3 pr-4 font-medium">Factura</th>
                      <th className="py-3 pr-4 font-medium">Emisión</th>
                      <th className="py-3 pr-4 font-medium">Vencimiento</th>
                      <th className="py-3 pr-4 font-medium">Descripción</th>
                      <th className="py-3 pr-4 font-medium">Monto total</th>
                      <th className="py-3 pr-4 font-medium">Saldo pendiente</th>
                      <th className="py-3 pr-4 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobranza.map((item, index) => {
                      const estadoVisual = getEstadoVisual(
                        item.estado,
                        item.fecha_vencimiento
                      )

                      return (
                        <tr
                          key={`${item.numero_factura}-${index}`}
                          className="border-b border-slate-100 last:border-none"
                        >
                          <td className="py-4 pr-4 text-slate-700">{item.cliente}</td>
                          <td className="py-4 pr-4 text-slate-900">{item.numero_factura}</td>
                          <td className="py-4 pr-4 text-slate-600">
                            {formatDateCL(item.fecha_emision)}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">
                            {item.fecha_vencimiento ? formatDateCL(item.fecha_vencimiento) : '-'}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">{item.descripcion}</td>
                          <td className="py-4 pr-4 text-slate-700">
                            ${Number(item.monto_total).toLocaleString('es-CL')}
                          </td>
                          <td className="py-4 pr-4 font-medium text-slate-900">
                            ${Number(item.saldo_pendiente).toLocaleString('es-CL')}
                          </td>
                          <td className="py-4 pr-4">
                            <StatusBadge status={estadoVisual} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Últimos movimientos
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Movimientos del período seleccionado para la empresa activa.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  onClick={() => setFiltroMovimientos('todos')}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'todos'
                      ? 'bg-[#163A5F] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>

                <button
                  onClick={() => setFiltroMovimientos('ingreso')}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'ingreso'
                      ? 'bg-[#163A5F] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Ingresos
                </button>

                <button
                  onClick={() => setFiltroMovimientos('egreso')}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'egreso'
                      ? 'bg-[#163A5F] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Egresos
                </button>
              </div>
            </div>

            {movimientosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No hay movimientos para el filtro y período seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-3 pr-4 font-medium">Fecha</th>
                      <th className="py-3 pr-4 font-medium">Tipo</th>
                      <th className="py-3 pr-4 font-medium">Documento</th>
                      <th className="py-3 pr-4 font-medium">Descripción</th>
                      <th className="py-3 pr-4 font-medium">Monto total</th>
                      <th className="py-3 pr-4 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosFiltrados.map((item) => {
                      const montoVisual =
                        item.tipo_movimiento === 'ingreso'
                          ? getSignedIngresoAmount(item)
                          : Number(item.monto_total || 0)

                      return (
                        <tr key={item.id} className="border-b border-slate-100 last:border-none">
                          <td className="py-4 pr-4 text-slate-600">
                            {formatDateCL(item.fecha)}
                          </td>
                          <td className="py-4 pr-4 font-medium text-slate-900">
                            {formatTipoMovimiento(item.tipo_movimiento)}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">
                            {item.numero_documento ?? '-'}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">{item.descripcion}</td>
                          <td className="py-4 pr-4 font-medium text-slate-900">
                            {formatSignedCLP(montoVisual)}
                          </td>
                          <td className="py-4 pr-4">
                            <StatusBadge status={item.estado} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}