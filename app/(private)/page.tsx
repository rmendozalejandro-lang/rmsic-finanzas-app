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

const STORAGE_KEY = 'empresa_activa_id'

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

export default function HomePage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [resumen, setResumen] = useState<ResumenOperativo | null>(null)
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [ultimosMovimientos, setUltimosMovimientos] = useState<UltimoMovimiento[]>([])
  const [filtroMovimientos, setFiltroMovimientos] = useState<FiltroMovimiento>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      setEmpresaActivaId(empresaId)
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
              `${baseUrl}/rest/v1/movimientos?select=monto_total&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${inicioMes}`,
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
              (acc: number, item: { monto_total?: number }) =>
                acc + Number(item.monto_total || 0),
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
        <p className="text-slate-600 mt-2">
          Resumen general de la operación financiera de la empresa activa.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          Cargando datos...
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 p-6 shadow-sm border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && resumen && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-500">Saldo total bancos</p>
              <p className="text-2xl font-semibold mt-2">
                ${Number(resumen.saldo_total_bancos).toLocaleString('es-CL')}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-500">Total por cobrar</p>
              <p className="text-2xl font-semibold mt-2">
                ${Number(resumen.total_por_cobrar).toLocaleString('es-CL')}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-500">Ingresos del mes</p>
              <p className="text-2xl font-semibold mt-2">
                ${Number(resumen.ingresos_mes).toLocaleString('es-CL')}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-500">Egresos del mes</p>
              <p className="text-2xl font-semibold mt-2">
                ${Number(resumen.egresos_mes).toLocaleString('es-CL')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-red-50 p-6 shadow-sm border border-red-200">
              <p className="text-sm text-red-700">Facturas vencidas</p>
              <p className="text-2xl font-semibold mt-2 text-red-800">
                {facturasVencidas.length}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-6 shadow-sm border border-amber-200">
              <p className="text-sm text-amber-700">Monto vencido total</p>
              <p className="text-2xl font-semibold mt-2 text-amber-800">
                ${montoVencidoTotal.toLocaleString('es-CL')}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-6 shadow-sm border border-blue-200">
              <p className="text-sm text-blue-700">Por vencer esta semana</p>
              <p className="text-2xl font-semibold mt-2 text-blue-800">
                {porVencerSemana.length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900">
              Cobranza pendiente
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Facturas activas pendientes de cobro de la empresa activa.
            </p>

            {cobranza.length === 0 ? (
              <div className="text-slate-500 text-sm">
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
                      <th className="py-3 pr-4">Estado</th>
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
                            ${Number(item.monto_total).toLocaleString('es-CL')}
                          </td>
                          <td className="py-3 pr-4 font-medium">
                            ${Number(item.saldo_pendiente).toLocaleString('es-CL')}
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

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Últimos movimientos
                </h2>
                <p className="text-slate-500 text-sm mt-1">
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
              <div className="text-slate-500 text-sm">
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
                    {movimientosFiltrados.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{item.fecha}</td>
                        <td className="py-3 pr-4">
                          {formatTipoMovimiento(item.tipo_movimiento)}
                        </td>
                        <td className="py-3 pr-4">{item.numero_documento ?? '-'}</td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4 font-medium">
                          ${Number(item.monto_total).toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={item.estado} />
                        </td>
                      </tr>
                    ))}
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