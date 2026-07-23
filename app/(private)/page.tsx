'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import StatusBadge from '../../components/StatusBadge'

type ModuloEmpresa = {
  modulo: string
  habilitado: boolean
}

type ResumenFinanciero = {
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
  activo?: boolean | null
  deleted_at?: string | null
}

type OtResumenDashboard = {
  id: string
  folio?: string | null
  titulo?: string | null
  cliente_nombre?: string | null
  cliente?: string | null
  estado_nombre?: string | null
  estado?: string | null
  fecha_ot?: string | null
  fecha_programada?: string | null
  fecha_cierre?: string | null
  created_at?: string | null
}

type ResumenOperacional = {
  total_ot: number
  abiertas: number
  en_proceso: number
  cerradas: number
  pendientes: number
  equipos: number
  clientes: number
}

type FiltroMovimiento = 'todos' | 'ingreso' | 'egreso'
type PeriodoPreset = 'today' | '7d' | 'this_month' | 'last_month' | '30d' | '90d' | 'custom'

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

const formatDateCL = (value?: string | null) => {
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
    return { from: formatDateInput(from), to: formatDateInput(today), label: 'Últimos 7 días' }
  }

  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: formatDateInput(from), to: formatDateInput(today), label: 'Este mes' }
  }

  if (preset === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: formatDateInput(from), to: formatDateInput(to), label: 'Mes anterior' }
  }

  if (preset === '30d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return { from: formatDateInput(from), to: formatDateInput(today), label: 'Últimos 30 días' }
  }

  if (preset === '90d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 89)
    return { from: formatDateInput(from), to: formatDateInput(today), label: 'Últimos 90 días' }
  }

  const safeFrom = customFrom || formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
  const safeTo = customTo || formatDateInput(today)

  if (safeFrom <= safeTo) {
    return { from: safeFrom, to: safeTo, label: 'Período personalizado' }
  }

  return { from: safeTo, to: safeFrom, label: 'Período personalizado' }
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

const isMovimientoAnulado = (estado?: string | null) =>
  normalizeText(estado) === 'anulado'

const isMovimientoActivo = (item: { estado?: string | null; activo?: boolean | null; deleted_at?: string | null }) =>
  !isMovimientoAnulado(item.estado) && item.activo !== false && !item.deleted_at

const isFactura = (tipoDocumento?: string | null) =>
  normalizeText(tipoDocumento) === 'factura'

const isPagado = (estado?: string | null) =>
  normalizeText(estado) === 'pagado'

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

const normalizeText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getOtEstado = (ot: OtResumenDashboard) =>
  normalizeText(ot.estado_nombre || ot.estado || '')

const moduloActivo = (modulos: ModuloEmpresa[], posibles: string[]) => {
  if (modulos.length === 0) return false

  const posiblesNormalizados = posibles.map((item) => normalizeText(item))

  return modulos.some((item) => {
    const modulo = normalizeText(item.modulo)
    return item.habilitado && posiblesNormalizados.some((posible) => modulo === posible || modulo.includes(posible))
  })
}

function KpiCard({ title, value, meta }: { title: string; value: string; meta?: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {meta ? <p className="mt-2 text-sm text-slate-500">{meta}</p> : null}
    </div>
  )
}

function AlertCard({ title, value, tone }: { title: string; value: string; tone: 'red' | 'amber' | 'blue' }) {
  const styles =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  const subtitleTone =
    tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-blue-700'

  return (
    <div className={`rounded-[24px] border p-6 shadow-sm ${styles}`}>
      <p className={`text-sm ${subtitleTone}`}>{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function ComparisonChart({ data }: { data: ChartPoint[] }) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [Math.abs(item.ingresos), Math.abs(item.egresos)]))

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
            const ingresoHeight = Math.max(10, (Math.abs(item.ingresos) / maxValue) * 220)
            const egresoHeight = Math.max(10, (Math.abs(item.egresos) / maxValue) * 220)

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

  const yForValue = (value: number) => padding + ((maxValue - value) * (height - padding * 2)) / range
  const points = data.map((item, index) => `${xForIndex(index)},${yForValue(item.flujo)}`).join(' ')
  const baselineY = yForValue(0)

  return (
    <div className="space-y-3 overflow-x-auto">
      <svg width={width} height={height} className="min-w-[760px] rounded-2xl bg-slate-50">
        <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke="#CBD5E1" strokeDasharray="4 4" />

        {[0, 1, 2, 3].map((step) => {
          const y = padding + ((height - padding * 2) / 3) * step
          return <line key={step} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E2E8F0" />
        })}

        <polyline fill="none" stroke="#163A5F" strokeWidth="3" points={points} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((item, index) => {
          const x = xForIndex(index)
          const y = yForValue(item.flujo)

          return (
            <g key={item.label}>
              <circle cx={x} cy={y} r="4.5" fill="#163A5F" />
              <text x={x} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748B">
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="text-xs text-slate-500">La línea muestra la evolución de caja registrada del período seleccionado.</p>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()

  const today = useMemo(() => new Date(), [])
  const defaultCustomFrom = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
  const defaultCustomTo = formatDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [modulos, setModulos] = useState<ModuloEmpresa[]>([])
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null)
  const [resumenOperacional, setResumenOperacional] = useState<ResumenOperacional | null>(null)
  const [ultimasOt, setUltimasOt] = useState<OtResumenDashboard[]>([])
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [movimientosPeriodo, setMovimientosPeriodo] = useState<UltimoMovimiento[]>([])
  const [ultimosMovimientos, setUltimosMovimientos] = useState<UltimoMovimiento[]>([])
  const [filtroMovimientos, setFiltroMovimientos] = useState<FiltroMovimiento>('todos')
  const [periodo, setPeriodo] = useState<PeriodoPreset>('this_month')
  const [customFrom, setCustomFrom] = useState(defaultCustomFrom)
  const [customTo, setCustomTo] = useState(defaultCustomTo)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const rangoActual = useMemo(() => getRangeFromPreset(periodo, customFrom, customTo), [periodo, customFrom, customTo])

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
        setModulos([])
        setResumen(null)
        setResumenOperacional(null)
        setUltimasOt([])
        setCobranza([])
        setMovimientosPeriodo([])
        setUltimosMovimientos([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        setModulos([])
        setResumen(null)
        setResumenOperacional(null)
        setUltimasOt([])
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

        const modulosResp = await fetch(
          `${baseUrl}/rest/v1/empresa_modulos?empresa_id=eq.${empresaActivaId}&select=modulo,habilitado`,
          { headers }
        )
        const modulosJson = await modulosResp.json()

        if (!modulosResp.ok) {
          setError('No se pudieron cargar los módulos habilitados de la empresa.')
          return
        }

        const modulosEmpresa = Array.isArray(modulosJson) ? (modulosJson as ModuloEmpresa[]) : []
        setModulos(modulosEmpresa)

        const tieneOperacionalFetch = moduloActivo(modulosEmpresa, ['operacional', 'ot'])
        const tieneFinancieroFetch = moduloActivo(modulosEmpresa, ['financiero', 'bancos', 'cobranza'])

        if (tieneOperacionalFetch) {
          const [otResp, equiposResp, clientesResp] = await Promise.all([
            fetch(
              `${baseUrl}/rest/v1/ot_vw_resumen?empresa_id=eq.${empresaActivaId}&select=*&order=created_at.desc&limit=15`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/ot_equipos?empresa_id=eq.${empresaActivaId}&activo=eq.true&select=id`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&activo=eq.true&select=id`,
              { headers }
            ),
          ])

          const otJson = await otResp.json()
          const equiposJson = await equiposResp.json()
          const clientesJson = await clientesResp.json()

          if (!otResp.ok) {
            setError('No se pudo cargar el resumen operacional de OT.')
            return
          }

          const ots = Array.isArray(otJson) ? (otJson as OtResumenDashboard[]) : []
          const equipos = Array.isArray(equiposJson) ? equiposJson.length : 0
          const clientes = Array.isArray(clientesJson) ? clientesJson.length : 0

          const cerradas = ots.filter((item) => {
            const estado = getOtEstado(item)
            return estado.includes('cerr') || estado.includes('finaliz') || Boolean(item.fecha_cierre)
          }).length

          const enProceso = ots.filter((item) => {
            const estado = getOtEstado(item)
            return estado.includes('proceso') || estado.includes('ejec') || estado.includes('curso')
          }).length

          const pendientes = ots.filter((item) => {
            const estado = getOtEstado(item)
            return estado.includes('pend') || estado.includes('asign') || estado.includes('abiert')
          }).length

          setResumenOperacional({
            total_ot: ots.length,
            abiertas: Math.max(0, ots.length - cerradas),
            en_proceso: enProceso,
            cerradas,
            pendientes,
            equipos,
            clientes,
          })
          setUltimasOt(ots.slice(0, 8))
        }

        if (tieneFinancieroFetch) {
          const [saldosResp, cobranzaResp, movimientosResp] = await Promise.all([
            fetch(`${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=saldo_calculado`, { headers }),
            fetch(
              `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_movimiento,tipo_documento,numero_documento,descripcion,monto_total,estado,empresa_id,activo,deleted_at&empresa_id=eq.${empresaActivaId}&fecha=gte.${from}&fecha=lte.${to}&order=fecha.asc`,
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

          const movimientos = Array.isArray(movimientosJson) ? (movimientosJson as UltimoMovimiento[]) : []
          const movimientosActivos = movimientos.filter(isMovimientoActivo)

          const saldoTotalBancos = Array.isArray(saldosJson)
            ? saldosJson.reduce((acc: number, item: { saldo_calculado?: number }) => acc + Number(item.saldo_calculado || 0), 0)
            : 0

          const totalPorCobrar = Array.isArray(cobranzaJson)
            ? cobranzaJson.reduce((acc: number, item: CobranzaPendiente) => acc + Number(item.saldo_pendiente || 0), 0)
            : 0

          const ingresosPeriodo = movimientosActivos.reduce((acc, item) => {
            if ((item.tipo_movimiento || '').toLowerCase() !== 'ingreso') return acc
            return acc + getSignedIngresoAmount(item)
          }, 0)

          const egresosPeriodo = movimientosActivos.reduce((acc, item) => {
            if ((item.tipo_movimiento || '').toLowerCase() !== 'egreso') return acc
            return acc + Number(item.monto_total || 0)
          }, 0)

          const movimientosActivosDesc = [...movimientosActivos].sort((a, b) => b.fecha.localeCompare(a.fecha))

          setResumen({
            saldo_total_bancos: saldoTotalBancos,
            total_por_cobrar: totalPorCobrar,
            ingresos_periodo: ingresosPeriodo,
            egresos_periodo: egresosPeriodo,
          })
          setCobranza(Array.isArray(cobranzaJson) ? cobranzaJson : [])
          setMovimientosPeriodo(movimientosActivos)
          setUltimosMovimientos(movimientosActivosDesc.slice(0, 12))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [router, empresaActivaId, rangoActual.from, rangoActual.to])

  const tieneOperacional = useMemo(() => moduloActivo(modulos, ['operacional', 'ot']), [modulos])
  const tieneFinanciero = useMemo(() => moduloActivo(modulos, ['financiero', 'bancos', 'cobranza']), [modulos])
  const tieneComercial = useMemo(() => moduloActivo(modulos, ['comercial', 'cotizaciones']), [modulos])
  const tieneContable = useMemo(() => moduloActivo(modulos, ['contable', 'plan_cuentas']), [modulos])
  const tieneRRHH = useMemo(() => moduloActivo(modulos, ['rrhh', 'remuneraciones']), [modulos])

  const facturasVencidas = useMemo(() => cobranza.filter((item) => isVencida(item.estado, item.fecha_vencimiento)), [cobranza])
  const porVencerSemana = useMemo(() => cobranza.filter((item) => isPorVencerEstaSemana(item.estado, item.fecha_vencimiento)), [cobranza])
  const montoVencidoTotal = useMemo(
    () => facturasVencidas.reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0),
    [facturasVencidas]
  )

  const movimientosFiltrados = useMemo(() => {
    if (filtroMovimientos === 'todos') return ultimosMovimientos
    return ultimosMovimientos.filter((item) => item.tipo_movimiento === filtroMovimientos)
  }, [ultimosMovimientos, filtroMovimientos])

  const metricasFinancieras = useMemo(() => {
    const ventasFacturadasPeriodo = movimientosPeriodo.reduce((acc, item) => {
      if ((item.tipo_movimiento || '').toLowerCase() !== 'ingreso') return acc
      if (!isFactura(item.tipo_documento)) return acc
      if (isMovimientoAnulado(item.estado)) return acc
      return acc + getSignedIngresoAmount(item)
    }, 0)

    const cobrosPorVentas = movimientosPeriodo.reduce((acc, item) => {
      if ((item.tipo_movimiento || '').toLowerCase() !== 'ingreso') return acc
      if (!isFactura(item.tipo_documento)) return acc
      if (!isPagado(item.estado)) return acc
      return acc + getSignedIngresoAmount(item)
    }, 0)

    const otrosCobros = movimientosPeriodo.reduce((acc, item) => {
      if ((item.tipo_movimiento || '').toLowerCase() !== 'ingreso') return acc
      if (isFactura(item.tipo_documento)) return acc
      if (!isPagado(item.estado)) return acc
      return acc + getSignedIngresoAmount(item)
    }, 0)

    const egresosPagados = movimientosPeriodo.reduce((acc, item) => {
      if ((item.tipo_movimiento || '').toLowerCase() !== 'egreso') return acc
      if (!isPagado(item.estado)) return acc
      return acc + Number(item.monto_total || 0)
    }, 0)

    return {
      ventasFacturadasPeriodo,
      cobrosPorVentas,
      otrosCobros,
      egresosPagados,
      flujoCajaReal: cobrosPorVentas + otrosCobros - egresosPagados,
    }
  }, [movimientosPeriodo])

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

      const current = bucket.get(label) ?? { label, ingresos: 0, egresos: 0, flujo: 0 }

      if ((item.tipo_movimiento || '').toLowerCase() === 'ingreso') current.ingresos += getSignedIngresoAmount(item)
      if ((item.tipo_movimiento || '').toLowerCase() === 'egreso') current.egresos += Number(item.monto_total || 0)
      if ((item.tipo_movimiento || '').toLowerCase() === 'ingreso' && isPagado(item.estado)) current.flujo += getSignedIngresoAmount(item)
      if ((item.tipo_movimiento || '').toLowerCase() === 'egreso' && isPagado(item.estado)) current.flujo -= Number(item.monto_total || 0)
      bucket.set(label, current)
    })

    return Array.from(bucket.values())
  }, [movimientosPeriodo, rangoActual.from, rangoActual.to])

  const modulosActivosTexto = useMemo(() => {
    const activos = [
      tieneOperacional ? 'Operacional' : null,
      tieneFinanciero ? 'Financiero' : null,
      tieneComercial ? 'Comercial' : null,
      tieneContable ? 'Contable' : null,
      tieneRRHH ? 'RRHH' : null,
    ].filter(Boolean)

    return activos.length > 0 ? activos.join(' · ') : 'Sin módulos activos'
  }, [tieneOperacional, tieneFinanciero, tieneComercial, tieneContable, tieneRRHH])

  const handleExportPdf = () => {
    const originalTitle = document.title
    document.title = `Tralixia - Dashboard - ${empresaActivaNombre || 'Empresa'} - ${rangoActual.from} a ${rangoActual.to}`
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[#18B7A8]/25 bg-[#18B7A8]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#103B66]">
              Tralixia
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Centro de control empresarial
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Plataforma modular de gestión empresarial para operación, finanzas y trazabilidad de la empresa activa.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-400">
              Desarrollado por RM Servicios de Ingeniería y Construcción
            </p>

            {empresaActivaNombre ? (
              <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:inline-flex">
                <span>
                  Mostrando información de:{' '}
                  <span className="font-semibold text-slate-900">{empresaActivaNombre}</span>
                </span>
                <span className="text-xs text-slate-500">
                  Módulos activos: <span className="font-semibold text-slate-700">{modulosActivosTexto}</span>
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
                disabled={loading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Exportar PDF
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
              Período seleccionado: <span className="font-medium text-slate-700">{rangoActual.label}</span>
            </p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tralixia</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Cargando datos</h2>
          <p className="mt-2 text-sm text-slate-500">Estamos obteniendo la información de la empresa activa.</p>
        </div>
      )}

      {error && <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">{error}</div>}

      {!loading && !error && !tieneOperacional && !tieneFinanciero && !tieneComercial && !tieneContable && !tieneRRHH && (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
          Esta empresa no tiene módulos activos para mostrar en el dashboard.
        </section>
      )}

      {!loading && !error && tieneFinanciero && resumen && (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Financiero</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Dashboard financiero</h2>
                <p className="mt-2 text-xs font-medium text-slate-400">
                  Desarrollado por RM Servicios de Ingeniería y Construcción
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Empresa: <span className="font-medium text-slate-700">{empresaActivaNombre || 'Sin empresa activa'}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Período: <span className="font-medium text-slate-700">{rangoActual.label}</span> ({rangoActual.from} a {rangoActual.to})
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
            <p className="text-sm font-semibold">Período en carga / información parcial</p>
            <p className="mt-2 text-sm leading-6">
              Los valores corresponden a documentos registrados en el sistema para el período seleccionado. Si el período no está cerrado,
              los montos pueden variar.
            </p>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Resultado comercial</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Documentos facturados del período</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiCard title="Ventas facturadas del período" value={formatSignedCLP(metricasFinancieras.ventasFacturadasPeriodo)} meta="Facturas activas no anuladas emitidas en el período." />
              <KpiCard title="Facturas pagadas del período" value={formatSignedCLP(metricasFinancieras.cobrosPorVentas)} meta="Facturas pagadas dentro del período." />
              <KpiCard title="Facturas pendientes del período" value={formatSignedCLP(Math.max(0, metricasFinancieras.ventasFacturadasPeriodo - metricasFinancieras.cobrosPorVentas))} meta="Diferencia entre ventas facturadas y facturas pagadas del período." />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Caja / movimientos reales</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Cobros y pagos registrados</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Cobros por ventas" value={formatSignedCLP(metricasFinancieras.cobrosPorVentas)} meta="Facturas pagadas dentro del período." />
              <KpiCard title="Otros cobros / recuperaciones" value={formatSignedCLP(metricasFinancieras.otrosCobros)} meta="Ingresos no comerciales como recuperaciones o abonos." />
              <KpiCard title="Egresos pagados" value={`$${Number(metricasFinancieras.egresosPagados).toLocaleString('es-CL')}`} meta="Egresos con estado pagado registrados en el período." />
              <KpiCard title="Flujo de caja real" value={formatSignedCLP(metricasFinancieras.flujoCajaReal)} meta="Cobros reales menos egresos pagados registrados." />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Cartera</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Cuentas por cobrar</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiCard title="Cuentas por cobrar vigentes" value={`$${Number(resumen.total_por_cobrar).toLocaleString('es-CL')}`} meta="Saldo pendiente de documentos activos, incluso de períodos anteriores." />
              <KpiCard title="Facturas vencidas" value={String(facturasVencidas.length)} meta={`Saldo vencido: $${montoVencidoTotal.toLocaleString('es-CL')}.`} />
              <KpiCard title="Por vencer esta semana" value={String(porVencerSemana.length)} meta="Documentos pendientes o parciales con vencimiento dentro de los próximos 7 días." />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AlertCard title="Período en carga" value="Parcial" tone="amber" />
            <AlertCard title="Facturas vencidas" value={String(facturasVencidas.length)} tone="red" />
            <AlertCard title="Por vencer esta semana" value={String(porVencerSemana.length)} tone="blue" />
            <AlertCard title="Cobros no comerciales" value={metricasFinancieras.otrosCobros > 0 ? formatSignedCLP(metricasFinancieras.otrosCobros) : 'Sin registros'} tone="blue" />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Movimientos registrados del período</h2>
                <p className="mt-2 text-sm text-slate-500">Comparativo de ingresos y egresos registrados para el período seleccionado.</p>
              </div>
              <ComparisonChart data={chartData} />
            </div>

            <div className="space-y-4 xl:col-span-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Flujo de caja real</h2>
                <p className="mt-2 text-sm text-slate-500">Cobros reales menos egresos pagados registrados.</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{formatSignedCLP(metricasFinancieras.flujoCajaReal)}</p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Estado actual</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    Cuentas por cobrar vigentes: <span className="font-medium text-slate-900">{cobranza.length}</span> documentos.
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
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Evolución de caja registrada</h2>
              <p className="mt-2 text-sm text-slate-500">Tendencia de cobros reales menos egresos pagados dentro del período seleccionado.</p>
            </div>
            <FlowChart data={chartData} />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Cuentas por cobrar vigentes</h2>
              <p className="mt-2 text-sm text-slate-500">Facturas activas pendientes de cobro de la empresa activa.</p>
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
                      const estadoVisual = getEstadoVisual(item.estado, item.fecha_vencimiento)
                      return (
                        <tr key={`${item.numero_factura}-${index}`} className="border-b border-slate-100 last:border-none">
                          <td className="py-4 pr-4 text-slate-700">{item.cliente}</td>
                          <td className="py-4 pr-4 text-slate-900">{item.numero_factura}</td>
                          <td className="py-4 pr-4 text-slate-600">{formatDateCL(item.fecha_emision)}</td>
                          <td className="py-4 pr-4 text-slate-600">{formatDateCL(item.fecha_vencimiento)}</td>
                          <td className="py-4 pr-4 text-slate-600">{item.descripcion}</td>
                          <td className="py-4 pr-4 text-slate-700">${Number(item.monto_total).toLocaleString('es-CL')}</td>
                          <td className="py-4 pr-4 font-medium text-slate-900">${Number(item.saldo_pendiente).toLocaleString('es-CL')}</td>
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
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Últimos movimientos</h2>
                <p className="mt-2 text-sm text-slate-500">Movimientos del período seleccionado para la empresa activa.</p>
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  onClick={() => setFiltroMovimientos('todos')}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'todos' ? 'bg-[#163A5F] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroMovimientos('ingreso')}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'ingreso' ? 'bg-[#163A5F] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setFiltroMovimientos('egreso')}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'egreso' ? 'bg-[#163A5F] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                      const montoVisual = item.tipo_movimiento === 'ingreso' ? getSignedIngresoAmount(item) : Number(item.monto_total || 0)
                      return (
                        <tr key={item.id} className="border-b border-slate-100 last:border-none">
                          <td className="py-4 pr-4 text-slate-600">{formatDateCL(item.fecha)}</td>
                          <td className="py-4 pr-4 font-medium text-slate-900">{formatTipoMovimiento(item.tipo_movimiento)}</td>
                          <td className="py-4 pr-4 text-slate-600">{item.numero_documento ?? '-'}</td>
                          <td className="py-4 pr-4 text-slate-600">{item.descripcion}</td>
                          <td className="py-4 pr-4 font-medium text-slate-900">{formatSignedCLP(montoVisual)}</td>
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

      {!loading && !error && tieneOperacional && resumenOperacional && (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Operacional</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Dashboard operacional</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Resumen de órdenes de trabajo, equipos y clientes/mandantes de la empresa activa.
                </p>
              </div>
              <Link
                href="/ot"
                className="inline-flex items-center justify-center rounded-2xl bg-[#163A5F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#245C90]"
              >
                Ver OT
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Total OT" value={String(resumenOperacional.total_ot)} meta="Órdenes de trabajo registradas." />
            <KpiCard title="OT abiertas" value={String(resumenOperacional.abiertas)} meta="OT no cerradas o pendientes de cierre." />
            <KpiCard title="En proceso" value={String(resumenOperacional.en_proceso)} meta="Trabajos en ejecución o curso." />
            <KpiCard title="OT cerradas" value={String(resumenOperacional.cerradas)} meta="Servicios finalizados o cerrados." />
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AlertCard title="Pendientes / asignadas" value={String(resumenOperacional.pendientes)} tone="blue" />
            <AlertCard title="Equipos activos" value={String(resumenOperacional.equipos)} tone="amber" />
            <AlertCard title="Clientes / mandantes" value={String(resumenOperacional.clientes)} tone="blue" />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Últimas órdenes de trabajo</h2>
                <p className="mt-2 text-sm text-slate-500">OT recientes de la empresa activa.</p>
              </div>
              <Link href="/ot/nueva" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                Nueva OT
              </Link>
            </div>

            {ultimasOt.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No hay órdenes de trabajo registradas para esta empresa.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-3 pr-4 font-medium">Folio</th>
                      <th className="py-3 pr-4 font-medium">Cliente</th>
                      <th className="py-3 pr-4 font-medium">Trabajo</th>
                      <th className="py-3 pr-4 font-medium">Fecha</th>
                      <th className="py-3 pr-4 font-medium">Estado</th>
                      <th className="py-3 pr-4 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimasOt.map((ot) => (
                      <tr key={ot.id} className="border-b border-slate-100 last:border-none">
                        <td className="py-4 pr-4 font-medium text-slate-900">{ot.folio || '-'}</td>
                        <td className="py-4 pr-4 text-slate-700">{ot.cliente_nombre || ot.cliente || '-'}</td>
                        <td className="py-4 pr-4 text-slate-600">{ot.titulo || 'Orden de trabajo'}</td>
                        <td className="py-4 pr-4 text-slate-600">{formatDateCL(ot.fecha_ot || ot.fecha_programada || ot.created_at)}</td>
                        <td className="py-4 pr-4">
                          <StatusBadge status={ot.estado_nombre || ot.estado || 'pendiente'} />
                        </td>
                        <td className="py-4 pr-4">
                          <a href={`/ot/${ot.id}`} className="font-medium text-[#163A5F] hover:text-[#245C90]">
                            Abrir
                          </a>
                        </td>
                      </tr>
                    ))}
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
