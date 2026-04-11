'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'
import EmpresaActivaBanner from '../../../components/EmpresaActivaBanner'

type SaldoBancario = {
  empresa_id: string
  id: string
  banco: string
  nombre_cuenta: string
  tipo_cuenta: string | null
  moneda: string | null
  saldo_inicial: number
  ingresos_pagados: number
  egresos_pagados: number
  saldo_calculado: number
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

type CategoriaRelacion = {
  nombre: string
} | null

type Movimiento = {
  id: string
  fecha: string
  tipo_movimiento: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
  monto_total: number
  estado: string
  empresa_id: string
  categoria_id?: string | null
  categorias?: CategoriaRelacion
}

type FiltroMovimiento = 'todos' | 'ingreso' | 'egreso'

type MonthlyChartPoint = {
  mes: string
  ingresos: number
  egresos: number
  flujo: number
}

type CategoriaChartPoint = {
  categoria: string
  monto: number
}

type CobranzaStatusChartPoint = {
  estado: string
  monto: number
  cantidad: number
  color: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const today = new Date().toISOString().slice(0, 10)
const firstDayOfLast12Months = new Date(
  new Date().getFullYear(),
  new Date().getMonth() - 11,
  1
)
  .toISOString()
  .slice(0, 10)

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatSignedCLP = (value: number) => {
  const signo = value < 0 ? '-' : ''
  return `${signo}$${Math.abs(Number(value || 0)).toLocaleString('es-CL')}`
}

const formatCompactCLP = (value: number) => {
  const abs = Math.abs(Number(value || 0))
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  }

  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  }

  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}K`
  }

  return `${sign}$${abs.toLocaleString('es-CL')}`
}

const formatDate = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CL')
}

const formatDateTime = (value: Date) =>
  value.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

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

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
    year: '2-digit',
  }).format(date)
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

const isPorVencerEstaSemana = (
  estado: string,
  fechaVencimiento: string | null
) => {
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

const getMonthKey = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

const buildMonthRange = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const limit = new Date(end.getFullYear(), end.getMonth(), 1)
  const months: string[] = []

  while (cursor <= limit) {
    const year = cursor.getFullYear()
    const month = `${cursor.getMonth() + 1}`.padStart(2, '0')
    months.push(`${year}-${month}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

const getCategoriaNombre = (item: Movimiento) => {
  return item.categorias?.nombre?.trim() || 'Sin categoría'
}

const getCobranzaBucket = (
  estado: string,
  fechaVencimiento: string | null
): 'Al día' | 'Por vencer' | 'Vencido' => {
  if (isVencida(estado, fechaVencimiento)) return 'Vencido'
  if (isPorVencerEstaSemana(estado, fechaVencimiento)) return 'Por vencer'
  return 'Al día'
}

export default function ReportesPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [desde, setDesde] = useState(firstDayOfLast12Months)
  const [hasta, setHasta] = useState(today)

  const [saldos, setSaldos] = useState<SaldoBancario[]>([])
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const [filtroMovimientos, setFiltroMovimientos] =
    useState<FiltroMovimiento>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fechaEmision = useMemo(() => formatDateTime(new Date()), [])

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

  useEffect(() => {
    const fetchReportes = async () => {
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

        const [saldosResp, cobranzaResp, movimientosResp] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=*`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_movimiento,tipo_documento,numero_documento,descripcion,monto_total,estado,empresa_id,categoria_id,categorias(nombre)&empresa_id=eq.${empresaActivaId}&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.desc&limit=1000`,
            { headers }
          ),
        ])

        const saldosJson = await saldosResp.json()
        const cobranzaJson = await cobranzaResp.json()
        const movimientosJson = await movimientosResp.json()

        if (!saldosResp.ok) {
          console.error(saldosJson)
          setError('No se pudo cargar el resumen bancario.')
          return
        }

        if (!cobranzaResp.ok) {
          console.error(cobranzaJson)
          setError('No se pudo cargar la cobranza pendiente.')
          return
        }

        if (!movimientosResp.ok) {
          console.error(movimientosJson)
          setError('No se pudieron cargar los movimientos del período.')
          return
        }

        setSaldos(saldosJson ?? [])
        setCobranza(cobranzaJson ?? [])
        setMovimientos(movimientosJson ?? [])
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

    fetchReportes()
  }, [router, empresaActivaId, desde, hasta])

  const saldoTotalBancos = useMemo(
    () =>
      saldos.reduce(
        (acc, item) => acc + Number(item.saldo_calculado || 0),
        0
      ),
    [saldos]
  )

  const totalPorCobrar = useMemo(
    () =>
      cobranza.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [cobranza]
  )

  const totalVencido = useMemo(
    () =>
      cobranza
        .filter((item) => isVencida(item.estado, item.fecha_vencimiento))
        .reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0),
    [cobranza]
  )

  const ingresosPeriodo = useMemo(
    () =>
      movimientos
        .filter((item) => item.tipo_movimiento === 'ingreso')
        .reduce((acc, item) => acc + getSignedIngresoAmount(item), 0),
    [movimientos]
  )

  const egresosPeriodo = useMemo(
    () =>
      movimientos
        .filter((item) => item.tipo_movimiento === 'egreso')
        .reduce((acc, item) => acc + Number(item.monto_total || 0), 0),
    [movimientos]
  )

  const flujoNeto = useMemo(
    () => ingresosPeriodo - egresosPeriodo,
    [ingresosPeriodo, egresosPeriodo]
  )

  const movimientosFiltrados = useMemo(() => {
    if (filtroMovimientos === 'todos') return movimientos

    return movimientos.filter(
      (item) => item.tipo_movimiento === filtroMovimientos
    )
  }, [movimientos, filtroMovimientos])

  const monthlyChartData = useMemo<MonthlyChartPoint[]>(() => {
    const months = buildMonthRange(desde, hasta)
    const baseMap = new Map<string, MonthlyChartPoint>()

    months.forEach((monthKey) => {
      baseMap.set(monthKey, {
        mes: formatMonthLabel(monthKey),
        ingresos: 0,
        egresos: 0,
        flujo: 0,
      })
    })

    movimientos.forEach((item) => {
      const monthKey = getMonthKey(item.fecha)
      const row = baseMap.get(monthKey)

      if (!row) return

      if (item.tipo_movimiento === 'ingreso') {
        row.ingresos += getSignedIngresoAmount(item)
      }

      if (item.tipo_movimiento === 'egreso') {
        row.egresos += Number(item.monto_total || 0)
      }

      row.flujo = row.ingresos - row.egresos
    })

    return months.map((monthKey) => baseMap.get(monthKey)!).filter(Boolean)
  }, [movimientos, desde, hasta])

  const egresosPorCategoriaData = useMemo<CategoriaChartPoint[]>(() => {
    const grouped = new Map<string, number>()

    movimientos
      .filter((item) => item.tipo_movimiento === 'egreso')
      .forEach((item) => {
        const categoria = getCategoriaNombre(item)
        const monto = Number(item.monto_total || 0)

        grouped.set(categoria, (grouped.get(categoria) || 0) + monto)
      })

    return Array.from(grouped.entries())
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 8)
      .reverse()
  }, [movimientos])

  const cobranzaStatusData = useMemo<CobranzaStatusChartPoint[]>(() => {
    const grouped = new Map<
      string,
      { monto: number; cantidad: number; color: string }
    >([
      ['Al día', { monto: 0, cantidad: 0, color: '#0f766e' }],
      ['Por vencer', { monto: 0, cantidad: 0, color: '#d97706' }],
      ['Vencido', { monto: 0, cantidad: 0, color: '#b91c1c' }],
    ])

    cobranza.forEach((item) => {
      const bucket = getCobranzaBucket(item.estado, item.fecha_vencimiento)
      const current = grouped.get(bucket)

      if (!current) return

      current.monto += Number(item.saldo_pendiente || 0)
      current.cantidad += 1
    })

    return Array.from(grouped.entries()).map(([estado, values]) => ({
      estado,
      monto: values.monto,
      cantidad: values.cantidad,
      color: values.color,
    }))
  }, [cobranza])

  const hasChartData = monthlyChartData.some(
    (item) => item.ingresos !== 0 || item.egresos !== 0 || item.flujo !== 0
  )

  const hasCategoryChartData = egresosPorCategoriaData.length > 0
  const hasCobranzaChartData = cobranzaStatusData.some(
    (item) => item.monto > 0 || item.cantidad > 0
  )

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          html,
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          thead {
            display: table-header-group;
          }

          tr,
          td,
          th,
          svg {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <main className="space-y-6 print:space-y-4">
        <div className="hidden print:block print-section">
          <section className="border-b border-slate-300 pb-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  RMSIC Finanzas App
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                  Reporte financiero consolidado
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Empresa:{' '}
                  <span className="font-semibold">
                    {empresaActivaNombre || empresaActivaId || '-'}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Período:{' '}
                  <span className="font-semibold">
                    {formatDate(desde)} al {formatDate(hasta)}
                  </span>
                </p>
              </div>

              <div className="text-right text-sm text-slate-600">
                <p>Emitido: {fechaEmision}</p>
                <p className="mt-1">Documento generado desde módulo Reportes</p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">
              Centro de reportes
            </h1>
            <p className="mt-2 text-slate-600">
              Reporte consolidado financiero y administrativo de la empresa activa.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Imprimir / PDF
          </button>
        </div>

        <div className="print:hidden">
          <EmpresaActivaBanner
            modulo="Reportes"
            descripcion="Este centro consolida bancos, movimientos y cobranza de la empresa activa. Los gráficos muestran el comportamiento del período seleccionado."
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
          <h2 className="text-2xl font-semibold text-slate-900">
            Filtros del reporte
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Para una visualización más clara, se recomienda trabajar con hasta 12 meses.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Desde
              </label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Movimientos visibles
              </label>
              <select
                value={filtroMovimientos}
                onChange={(e) =>
                  setFiltroMovimientos(e.target.value as FiltroMovimiento)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="ingreso">Solo ingresos</option>
                <option value="egreso">Solo egresos</option>
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            Cargando reportes...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5 print:grid-cols-3 print-section">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
                <p className="text-sm text-slate-500">Saldo total en bancos</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatCLP(saldoTotalBancos)}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Saldo consolidado actual
                </p>
              </article>

              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm print:shadow-none">
                <p className="text-sm text-emerald-700">Ingresos del período</p>
                <h2 className="mt-2 text-3xl font-semibold text-emerald-900">
                  {formatSignedCLP(ingresosPeriodo)}
                </h2>
                <p className="mt-2 text-sm text-emerald-700">
                  Desde {formatDate(desde)} hasta {formatDate(hasta)}
                </p>
              </article>

              <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm print:shadow-none">
                <p className="text-sm text-rose-700">Egresos del período</p>
                <h2 className="mt-2 text-3xl font-semibold text-rose-900">
                  {formatCLP(egresosPeriodo)}
                </h2>
                <p className="mt-2 text-sm text-rose-700">
                  Desde {formatDate(desde)} hasta {formatDate(hasta)}
                </p>
              </article>

              <article className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm print:shadow-none">
                <p className="text-sm text-sky-700">Flujo neto</p>
                <h2 className="mt-2 text-3xl font-semibold text-sky-900">
                  {formatSignedCLP(flujoNeto)}
                </h2>
                <p className="mt-2 text-sm text-sky-700">
                  Ingresos menos egresos
                </p>
              </article>

              <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm print:shadow-none">
                <p className="text-sm text-amber-700">Cobranza vencida</p>
                <h2 className="mt-2 text-3xl font-semibold text-amber-900">
                  {formatCLP(totalVencido)}
                </h2>
                <p className="mt-2 text-sm text-amber-700">
                  Total por cobrar: {formatCLP(totalPorCobrar)}
                </p>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 print:grid-cols-1">
              <article className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Ingresos vs egresos mensuales
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Comparación mensual del comportamiento financiero.
                  </p>
                </div>

                {!hasChartData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No hay datos suficientes para graficar en el período seleccionado.
                  </div>
                ) : (
                  <div className="h-[340px] print:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyChartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" />
                        <YAxis tickFormatter={formatCompactCLP} width={70} />
                        <Tooltip
                          formatter={(value) => formatCLP(Number(value ?? 0))}
                        />
                        <Legend />
                        <Bar
                          dataKey="ingresos"
                          name="Ingresos"
                          radius={[6, 6, 0, 0]}
                          fill="#0f766e"
                        />
                        <Bar
                          dataKey="egresos"
                          name="Egresos"
                          radius={[6, 6, 0, 0]}
                          fill="#be123c"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>

              <article className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Tendencia de flujo neto
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Evolución mensual del resultado entre ingresos y egresos.
                  </p>
                </div>

                {!hasChartData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No hay datos suficientes para graficar en el período seleccionado.
                  </div>
                ) : (
                  <div className="h-[340px] print:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyChartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" />
                        <YAxis tickFormatter={formatCompactCLP} width={70} />
                        <Tooltip
                          formatter={(value) =>
                            formatSignedCLP(Number(value ?? 0))
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="flujo"
                          name="Flujo neto"
                          stroke="#1d4ed8"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 print:grid-cols-1">
              <section className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Egresos por categoría
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ranking de categorías con mayor peso en el gasto del período.
                  </p>
                </div>

                {!hasCategoryChartData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No hay egresos categorizados para mostrar en el período seleccionado.
                  </div>
                ) : (
                  <div className="h-[380px] print:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={egresosPorCategoriaData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatCompactCLP} />
                        <YAxis
                          type="category"
                          dataKey="categoria"
                          width={140}
                        />
                        <Tooltip
                          formatter={(value) => formatCLP(Number(value ?? 0))}
                        />
                        <Bar
                          dataKey="monto"
                          name="Egresos"
                          radius={[0, 6, 6, 0]}
                          fill="#7c3aed"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <section className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Cobranza por estado
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Distribución del saldo pendiente entre al día, por vencer y vencido.
                  </p>
                </div>

                {!hasCobranzaChartData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No hay documentos de cobranza para mostrar en el período actual.
                  </div>
                ) : (
                  <div className="h-[380px] print:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={cobranzaStatusData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatCompactCLP} />
                        <YAxis type="category" dataKey="estado" width={110} />
                        <Tooltip
                          formatter={(value, _name, props) => [
                            formatCLP(Number(value ?? 0)),
                            `${props?.payload?.cantidad ?? 0} documento(s)`,
                          ]}
                        />
                        <Bar dataKey="monto" name="Saldo pendiente" radius={[0, 6, 6, 0]}>
                          {cobranzaStatusData.map((entry) => (
                            <Cell key={entry.estado} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </section>

            <section className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
              <h2 className="text-2xl font-semibold text-slate-900">
                Resumen bancario
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Estado actual de las cuentas bancarias registradas para la empresa activa.
              </p>

              <div className="mt-6">
                {saldos.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No hay saldos bancarios disponibles para esta empresa.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-3 pr-4">Banco</th>
                          <th className="py-3 pr-4">Cuenta</th>
                          <th className="py-3 pr-4">Saldo inicial</th>
                          <th className="py-3 pr-4">Ingresos pagados</th>
                          <th className="py-3 pr-4">Egresos pagados</th>
                          <th className="py-3 pr-4">Saldo calculado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saldos.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-3 pr-4">{item.banco}</td>
                            <td className="py-3 pr-4">{item.nombre_cuenta}</td>
                            <td className="py-3 pr-4 font-medium">
                              {formatCLP(item.saldo_inicial)}
                            </td>
                            <td className="py-3 pr-4 font-medium">
                              {formatCLP(item.ingresos_pagados)}
                            </td>
                            <td className="py-3 pr-4 font-medium">
                              {formatCLP(item.egresos_pagados)}
                            </td>
                            <td className="py-3 pr-4 font-semibold text-slate-900">
                              {formatCLP(item.saldo_calculado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
              <h2 className="text-2xl font-semibold text-slate-900">
                Cobranza pendiente
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Detalle de documentos actualmente por cobrar.
              </p>

              <div className="mt-6">
                {cobranza.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No hay documentos pendientes en cobranza para esta empresa.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-3 pr-4">Emisión</th>
                          <th className="py-3 pr-4">Vencimiento</th>
                          <th className="py-3 pr-4">Cliente</th>
                          <th className="py-3 pr-4">Factura</th>
                          <th className="py-3 pr-4">Descripción</th>
                          <th className="py-3 pr-4">Monto</th>
                          <th className="py-3 pr-4">Saldo</th>
                          <th className="py-3 pr-4">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobranza.map((item, index) => (
                          <tr
                            key={`${item.numero_factura}-${item.cliente}-${item.fecha_emision}-${index}`}
                            className="border-b border-slate-100"
                          >
                            <td className="py-3 pr-4">
                              {formatDate(item.fecha_emision)}
                            </td>
                            <td className="py-3 pr-4">
                              {formatDate(item.fecha_vencimiento)}
                            </td>
                            <td className="py-3 pr-4">{item.cliente}</td>
                            <td className="py-3 pr-4">{item.numero_factura}</td>
                            <td className="py-3 pr-4">{item.descripcion}</td>
                            <td className="py-3 pr-4 font-medium">
                              {formatCLP(item.monto_total)}
                            </td>
                            <td className="py-3 pr-4 font-semibold text-slate-900">
                              {formatCLP(item.saldo_pendiente)}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusBadge
                                status={getEstadoVisual(
                                  item.estado,
                                  item.fecha_vencimiento
                                )}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="print-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
              <h2 className="text-2xl font-semibold text-slate-900">
                Movimientos del período
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Detalle de ingresos y egresos entre {formatDate(desde)} y{' '}
                {formatDate(hasta)}.
              </p>

              <div className="mt-6">
                {movimientosFiltrados.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No hay movimientos para mostrar en el período seleccionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-3 pr-4">Fecha</th>
                          <th className="py-3 pr-4">Tipo</th>
                          <th className="py-3 pr-4">Documento</th>
                          <th className="py-3 pr-4">Descripción</th>
                          <th className="py-3 pr-4">Categoría</th>
                          <th className="py-3 pr-4">Monto</th>
                          <th className="py-3 pr-4">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientosFiltrados.map((item) => {
                          const montoVisual =
                            item.tipo_movimiento === 'ingreso'
                              ? getSignedIngresoAmount(item)
                              : Number(item.monto_total || 0)

                          return (
                            <tr key={item.id} className="border-b border-slate-100">
                              <td className="py-3 pr-4">
                                {formatDate(item.fecha)}
                              </td>
                              <td className="py-3 pr-4">
                                {formatTipoMovimiento(item.tipo_movimiento)}
                              </td>
                              <td className="py-3 pr-4">
                                {item.numero_documento ??
                                  item.tipo_documento ??
                                  '-'}
                              </td>
                              <td className="py-3 pr-4">{item.descripcion}</td>
                              <td className="py-3 pr-4">
                                {getCategoriaNombre(item)}
                              </td>
                              <td className="py-3 pr-4 font-medium">
                                {item.tipo_movimiento === 'ingreso'
                                  ? formatSignedCLP(montoVisual)
                                  : formatCLP(montoVisual)}
                              </td>
                              <td className="py-3 pr-4">
                                <StatusBadge status={item.estado} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  )
}