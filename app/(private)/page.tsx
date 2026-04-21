'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import StatusBadge from '../../components/StatusBadge'

type ResumenOperativo = {
  saldo_total_bancos: number
  total_por_cobrar: number
  ingresos_mes: number
  egresos_mes: number
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

type TramoAntiguedadKey =
  | 'al_dia'
  | 'de_1_a_30'
  | 'de_31_a_60'
  | 'de_61_a_90'
  | 'mas_de_90'

type ResumenAntiguedad = Record<
  TramoAntiguedadKey,
  {
    cantidad: number
    monto: number
  }
>

const STORAGE_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

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

const getDiasVencidos = (fechaVencimiento: string | null) => {
  if (!fechaVencimiento) return 0

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)

  const diffMs = inicioHoy.getTime() - vencimiento.getTime()
  const dias = Math.floor(diffMs / 86400000)

  return dias > 0 ? dias : 0
}

const getTramoAntiguedad = (item: CobranzaPendiente): TramoAntiguedadKey => {
  const diasVencidos = getDiasVencidos(item.fecha_vencimiento)

  if (diasVencidos <= 0) return 'al_dia'
  if (diasVencidos <= 30) return 'de_1_a_30'
  if (diasVencidos <= 60) return 'de_31_a_60'
  if (diasVencidos <= 90) return 'de_61_a_90'
  return 'mas_de_90'
}

const getTramoAntiguedadLabel = (tramo: TramoAntiguedadKey) => {
  switch (tramo) {
    case 'al_dia':
      return 'Al día'
    case 'de_1_a_30':
      return '1 a 30 días'
    case 'de_31_a_60':
      return '31 a 60 días'
    case 'de_61_a_90':
      return '61 a 90 días'
    case 'mas_de_90':
      return 'Más de 90 días'
    default:
      return tramo
  }
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

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

export default function HomePage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [resumen, setResumen] = useState<ResumenOperativo | null>(null)
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [ultimosMovimientos, setUltimosMovimientos] = useState<UltimoMovimiento[]>([])
  const [filtroMovimientos, setFiltroMovimientos] = useState<FiltroMovimiento>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      if (!empresaActivaId) return

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

        const inicioMes = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
          .toISOString()
          .slice(0, 10)

        const [saldosResp, cobranzaResp, movimientosResp, ingresosMesResp, egresosMesResp] =
          await Promise.all([
            fetch(
              `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=saldo_calculado`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_movimiento,tipo_documento,numero_documento,descripcion,monto_total,estado,empresa_id&empresa_id=eq.${empresaActivaId}&order=fecha.desc&limit=10`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/movimientos?select=monto_total,tipo_documento,tipo_movimiento&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${inicioMes}`,
              { headers }
            ),
            fetch(
              `${baseUrl}/rest/v1/movimientos?select=monto_total&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&fecha=gte.${inicioMes}`,
              { headers }
            ),
          ])

        const saldosJson = await saldosResp.json()
        const cobranzaJson = await cobranzaResp.json()
        const movimientosJson = await movimientosResp.json()
        const ingresosMesJson = await ingresosMesResp.json()
        const egresosMesJson = await egresosMesResp.json()

        if (!saldosResp.ok) {
          setError('No se pudo cargar el resumen bancario.')
          return
        }

        if (!cobranzaResp.ok) {
          setError('No se pudo cargar la cobranza pendiente.')
          return
        }

        if (!movimientosResp.ok) {
          setError('No se pudieron cargar los últimos movimientos.')
          return
        }

        if (!ingresosMesResp.ok || !egresosMesResp.ok) {
          setError('No se pudo cargar el resumen mensual.')
          return
        }

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

        const ingresosMes = Array.isArray(ingresosMesJson)
          ? ingresosMesJson.reduce(
              (
                acc: number,
                item: {
                  monto_total?: number
                  tipo_documento?: string | null
                  tipo_movimiento?: string
                }
              ) => acc + getSignedIngresoAmount(item),
              0
            )
          : 0

        const egresosMes = Array.isArray(egresosMesJson)
          ? egresosMesJson.reduce(
              (acc: number, item: { monto_total?: number }) =>
                acc + Number(item.monto_total || 0),
              0
            )
          : 0

        setResumen({
          saldo_total_bancos: saldoTotalBancos,
          total_por_cobrar: totalPorCobrar,
          ingresos_mes: ingresosMes,
          egresos_mes: egresosMes,
        })

        setCobranza(cobranzaJson ?? [])
        setUltimosMovimientos(movimientosJson ?? [])
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
  }, [router, empresaActivaId])

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

  const resumenAntiguedad = useMemo<ResumenAntiguedad>(() => {
    const base: ResumenAntiguedad = {
      al_dia: { cantidad: 0, monto: 0 },
      de_1_a_30: { cantidad: 0, monto: 0 },
      de_31_a_60: { cantidad: 0, monto: 0 },
      de_61_a_90: { cantidad: 0, monto: 0 },
      mas_de_90: { cantidad: 0, monto: 0 },
    }

    for (const item of cobranza) {
      const tramo = getTramoAntiguedad(item)
      base[tramo].cantidad += 1
      base[tramo].monto += Number(item.saldo_pendiente || 0)
    }

    return base
  }, [cobranza])

  const movimientosFiltrados = useMemo(() => {
    if (filtroMovimientos === 'todos') return ultimosMovimientos
    return ultimosMovimientos.filter(
      (item) => item.tipo_movimiento === filtroMovimientos
    )
  }, [ultimosMovimientos, filtroMovimientos])

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Resumen general de la operación financiera de la empresa activa.
        </p>

        {empresaActivaNombre ? (
          <div className="mt-3 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
            Mostrando información de:
            <span className="ml-2 font-semibold">{empresaActivaNombre}</span>
          </div>
        ) : null}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando datos...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && resumen && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Saldo total bancos</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCLP(resumen.saldo_total_bancos)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total por cobrar</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCLP(resumen.total_por_cobrar)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Ingresos del mes</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatSignedCLP(resumen.ingresos_mes)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Egresos del mes</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCLP(resumen.egresos_mes)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <p className="text-sm text-red-700">Facturas vencidas</p>
              <p className="mt-2 text-2xl font-semibold text-red-800">
                {facturasVencidas.length}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <p className="text-sm text-amber-700">Monto vencido total</p>
              <p className="mt-2 text-2xl font-semibold text-amber-800">
                {formatCLP(montoVencidoTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <p className="text-sm text-blue-700">Por vencer esta semana</p>
              <p className="mt-2 text-2xl font-semibold text-blue-800">
                {porVencerSemana.length}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Antigüedad de saldos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Resumen rápido de cuentas por cobrar por tramo de vencimiento.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-sm text-emerald-700">Al día</p>
                <p className="mt-2 text-xl font-semibold text-emerald-900">
                  {formatCLP(resumenAntiguedad.al_dia.monto)}
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  {resumenAntiguedad.al_dia.cantidad} documento(s)
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">1 a 30 días</p>
                <p className="mt-2 text-xl font-semibold text-amber-900">
                  {formatCLP(resumenAntiguedad.de_1_a_30.monto)}
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  {resumenAntiguedad.de_1_a_30.cantidad} documento(s)
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <p className="text-sm text-orange-700">31 a 60 días</p>
                <p className="mt-2 text-xl font-semibold text-orange-900">
                  {formatCLP(resumenAntiguedad.de_31_a_60.monto)}
                </p>
                <p className="mt-1 text-sm text-orange-700">
                  {resumenAntiguedad.de_31_a_60.cantidad} documento(s)
                </p>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                <p className="text-sm text-rose-700">61 a 90 días</p>
                <p className="mt-2 text-xl font-semibold text-rose-900">
                  {formatCLP(resumenAntiguedad.de_61_a_90.monto)}
                </p>
                <p className="mt-1 text-sm text-rose-700">
                  {resumenAntiguedad.de_61_a_90.cantidad} documento(s)
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <p className="text-sm text-red-700">Más de 90 días</p>
                <p className="mt-2 text-xl font-semibold text-red-900">
                  {formatCLP(resumenAntiguedad.mas_de_90.monto)}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {resumenAntiguedad.mas_de_90.cantidad} documento(s)
                </p>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
              Cobranza pendiente
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Facturas activas pendientes de cobro de la empresa activa.
            </p>

            {cobranza.length === 0 ? (
              <div className="text-sm text-slate-500">
                No hay facturas pendientes por cobrar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Cliente</th>
                      <th className="py-3 pr-4">Factura</th>
                      <th className="py-3 pr-4">Emisión</th>
                      <th className="py-3 pr-4">Vencimiento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Monto total</th>
                      <th className="py-3 pr-4">Saldo pendiente</th>
                      <th className="py-3 pr-4">Tramo</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobranza.map((item, index) => {
                      const estadoVisual = getEstadoVisual(
                        item.estado,
                        item.fecha_vencimiento
                      )
                      const tramo = getTramoAntiguedad(item)

                      return (
                        <tr
                          key={`${item.numero_factura}-${index}`}
                          className="border-b border-slate-100"
                        >
                          <td className="py-3 pr-4">{item.cliente}</td>
                          <td className="py-3 pr-4">{item.numero_factura}</td>
                          <td className="py-3 pr-4">{item.fecha_emision}</td>
                          <td className="py-3 pr-4">
                            {item.fecha_vencimiento ?? '-'}
                          </td>
                          <td className="py-3 pr-4">{item.descripcion}</td>
                          <td className="py-3 pr-4">
                            {formatCLP(item.monto_total)}
                          </td>
                          <td className="py-3 pr-4 font-medium">
                            {formatCLP(item.saldo_pendiente)}
                          </td>
                          <td className="py-3 pr-4">
                            {getTramoAntiguedadLabel(tramo)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={estadoVisual} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Últimos movimientos
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Últimos ingresos y egresos registrados de la empresa activa.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setFiltroMovimientos('todos')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'todos'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>

                <button
                  onClick={() => setFiltroMovimientos('ingreso')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'ingreso'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Ingresos
                </button>

                <button
                  onClick={() => setFiltroMovimientos('egreso')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    filtroMovimientos === 'egreso'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Egresos
                </button>
              </div>
            </div>

            {movimientosFiltrados.length === 0 ? (
              <div className="text-sm text-slate-500">
                No hay movimientos para el filtro seleccionado.
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
                      <th className="py-3 pr-4">Monto total</th>
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
                          <td className="py-3 pr-4">{item.fecha}</td>
                          <td className="py-3 pr-4">
                            {formatTipoMovimiento(item.tipo_movimiento)}
                          </td>
                          <td className="py-3 pr-4">{item.numero_documento ?? '-'}</td>
                          <td className="py-3 pr-4">{item.descripcion}</td>
                          <td className="py-3 pr-4 font-medium">
                            {formatSignedCLP(montoVisual)}
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
        </>
      )}
    </main>
  )
}