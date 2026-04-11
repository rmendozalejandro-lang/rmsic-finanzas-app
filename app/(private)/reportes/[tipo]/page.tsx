'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase/client'
import StatusBadge from '../../../../components/StatusBadge'
import EmpresaActivaBanner from '../../../../components/EmpresaActivaBanner'

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
}

type ReporteTipo =
  | 'flujo-caja'
  | 'ingresos'
  | 'egresos'
  | 'cobranza'
  | 'bancos'

const STORAGE_KEY = 'empresa_activa_id'

const REPORTES_VALIDOS: ReporteTipo[] = [
  'flujo-caja',
  'ingresos',
  'egresos',
  'cobranza',
  'bancos',
]

const REPORTES_TITULOS: Record<ReporteTipo, string> = {
  'flujo-caja': 'Reporte de flujo de caja',
  ingresos: 'Reporte de ingresos detallados',
  egresos: 'Reporte de egresos detallados',
  cobranza: 'Reporte de cobranza',
  bancos: 'Reporte bancario',
}

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatSignedCLP = (value: number) => {
  const signo = value < 0 ? '-' : ''
  return `${signo}$${Math.abs(Number(value || 0)).toLocaleString('es-CL')}`
}

const formatDate = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CL')
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

export default function ReporteDetallePage() {
  const router = useRouter()
  const params = useParams<{ tipo: string }>()
  const searchParams = useSearchParams()

  const tipo = params.tipo as ReporteTipo
  const titulo =
    REPORTES_VALIDOS.includes(tipo) ? REPORTES_TITULOS[tipo] : 'Reporte'

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [saldos, setSaldos] = useState<SaldoBancario[]>([])
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const today = new Date().toISOString().slice(0, 10)
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10)

  const desde = searchParams.get('desde') || firstDayOfMonth
  const hasta = searchParams.get('hasta') || today

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
    const fetchReporte = async () => {
      if (!REPORTES_VALIDOS.includes(tipo)) {
        setLoading(false)
        setError('Tipo de reporte no válido.')
        return
      }

      if (!empresaActivaId) {
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

        const requests: Promise<Response>[] = []

        if (tipo === 'bancos' || tipo === 'flujo-caja') {
          requests.push(
            fetch(
              `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=*`,
              { headers }
            )
          )
        }

        if (tipo === 'cobranza') {
          requests.push(
            fetch(
              `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
              { headers }
            )
          )
        }

        if (tipo === 'ingresos' || tipo === 'egresos' || tipo === 'flujo-caja') {
          const tipoFiltro =
            tipo === 'ingresos'
              ? '&tipo_movimiento=eq.ingreso'
              : tipo === 'egresos'
                ? '&tipo_movimiento=eq.egreso'
                : ''

          requests.push(
            fetch(
              `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_movimiento,tipo_documento,numero_documento,descripcion,monto_total,estado,empresa_id&empresa_id=eq.${empresaActivaId}&fecha=gte.${desde}&fecha=lte.${hasta}${tipoFiltro}&order=fecha.desc&limit=500`,
              { headers }
            )
          )
        }

        const responses = await Promise.all(requests)
        const payloads = await Promise.all(responses.map((resp) => resp.json()))

        let payloadIndex = 0

        if (tipo === 'bancos' || tipo === 'flujo-caja') {
          const saldosResp = responses[payloadIndex]
          const saldosJson = payloads[payloadIndex]
          payloadIndex += 1

          if (!saldosResp.ok) {
            console.error(saldosJson)
            setError('No se pudo cargar el resumen bancario.')
            return
          }

          setSaldos(saldosJson ?? [])
        } else {
          setSaldos([])
        }

        if (tipo === 'cobranza') {
          const cobranzaResp = responses[payloadIndex]
          const cobranzaJson = payloads[payloadIndex]
          payloadIndex += 1

          if (!cobranzaResp.ok) {
            console.error(cobranzaJson)
            setError('No se pudo cargar la cobranza pendiente.')
            return
          }

          setCobranza(cobranzaJson ?? [])
        } else {
          setCobranza([])
        }

        if (tipo === 'ingresos' || tipo === 'egresos' || tipo === 'flujo-caja') {
          const movimientosResp = responses[payloadIndex]
          const movimientosJson = payloads[payloadIndex]

          if (!movimientosResp.ok) {
            console.error(movimientosJson)
            setError('No se pudieron cargar los movimientos del período.')
            return
          }

          setMovimientos(movimientosJson ?? [])
        } else {
          setMovimientos([])
        }
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

    fetchReporte()
  }, [router, empresaActivaId, tipo, desde, hasta])

  const saldoTotalBancos = useMemo(
    () =>
      saldos.reduce(
        (acc, item) => acc + Number(item.saldo_calculado || 0),
        0
      ),
    [saldos]
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

  const descripcionBanner = useMemo(() => {
    switch (tipo) {
      case 'flujo-caja':
        return `Consolidado financiero entre ${formatDate(desde)} y ${formatDate(hasta)}.`
      case 'ingresos':
        return `Detalle de ingresos registrados entre ${formatDate(desde)} y ${formatDate(hasta)}.`
      case 'egresos':
        return `Detalle de egresos registrados entre ${formatDate(desde)} y ${formatDate(hasta)}.`
      case 'cobranza':
        return 'Detalle de documentos pendientes, parciales y vencidos de la empresa activa.'
      case 'bancos':
        return 'Estado actual de las cuentas y saldos bancarios de la empresa activa.'
      default:
        return 'Reporte de la empresa activa.'
    }
  }, [tipo, desde, hasta])

  const renderResumen = () => {
    if (tipo === 'bancos') {
      return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Saldo total en bancos</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCLP(saldoTotalBancos)}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cuentas visibles</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {saldos.length}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Saldo promedio</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCLP(saldos.length ? saldoTotalBancos / saldos.length : 0)}
            </h2>
          </article>
        </section>
      )
    }

    if (tipo === 'cobranza') {
      return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total por cobrar</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCLP(totalPorCobrar)}
            </h2>
          </article>

          <article className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm text-red-700">Saldo vencido</p>
            <h2 className="mt-2 text-3xl font-semibold text-red-900">
              {formatCLP(totalVencido)}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Documentos visibles</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {cobranza.length}
            </h2>
          </article>
        </section>
      )
    }

    if (tipo === 'ingresos') {
      return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm text-emerald-700">Ingresos del período</p>
            <h2 className="mt-2 text-3xl font-semibold text-emerald-900">
              {formatSignedCLP(ingresosPeriodo)}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Documentos visibles</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {movimientos.length}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Promedio por movimiento</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCLP(movimientos.length ? ingresosPeriodo / movimientos.length : 0)}
            </h2>
          </article>
        </section>
      )
    }

    if (tipo === 'egresos') {
      return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-sm text-rose-700">Egresos del período</p>
            <h2 className="mt-2 text-3xl font-semibold text-rose-900">
              {formatCLP(egresosPeriodo)}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Documentos visibles</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {movimientos.length}
            </h2>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Promedio por movimiento</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCLP(movimientos.length ? egresosPeriodo / movimientos.length : 0)}
            </h2>
          </article>
        </section>
      )
    }

    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm text-sky-700">Flujo neto</p>
          <h2 className="mt-2 text-3xl font-semibold text-sky-900">
            {formatSignedCLP(flujoNeto)}
          </h2>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm text-emerald-700">Ingresos</p>
          <h2 className="mt-2 text-3xl font-semibold text-emerald-900">
            {formatSignedCLP(ingresosPeriodo)}
          </h2>
        </article>

        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-700">Egresos</p>
          <h2 className="mt-2 text-3xl font-semibold text-rose-900">
            {formatCLP(egresosPeriodo)}
          </h2>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Saldo bancos</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            {formatCLP(saldoTotalBancos)}
          </h2>
        </article>
      </section>
    )
  }

  const renderTabla = () => {
    if (tipo === 'bancos') {
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-2xl font-semibold text-slate-900">Detalle bancario</h2>
          <p className="mt-1 text-sm text-slate-500">
            Estado actual de las cuentas registradas.
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
                      <th className="py-3 pr-4">Tipo</th>
                      <th className="py-3 pr-4">Moneda</th>
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
                        <td className="py-3 pr-4">{item.tipo_cuenta ?? '-'}</td>
                        <td className="py-3 pr-4">{item.moneda ?? '-'}</td>
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
      )
    }

    if (tipo === 'cobranza') {
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-2xl font-semibold text-slate-900">Detalle de cobranza</h2>
          <p className="mt-1 text-sm text-slate-500">
            Documentos pendientes, parciales y vencidos.
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
                        <td className="py-3 pr-4">{formatDate(item.fecha_emision)}</td>
                        <td className="py-3 pr-4">{formatDate(item.fecha_vencimiento)}</td>
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
                            status={getEstadoVisual(item.estado, item.fecha_vencimiento)}
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
      )
    }

    if (tipo === 'ingresos') {
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-2xl font-semibold text-slate-900">Detalle de ingresos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Movimientos de ingreso entre {formatDate(desde)} y {formatDate(hasta)}.
          </p>

          <div className="mt-6">
            {movimientos.length === 0 ? (
              <div className="text-sm text-slate-500">
                No hay ingresos para mostrar en el período seleccionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Documento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Monto</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{formatDate(item.fecha)}</td>
                        <td className="py-3 pr-4">
                          {item.numero_documento ?? item.tipo_documento ?? '-'}
                        </td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4 font-medium">
                          {formatSignedCLP(getSignedIngresoAmount(item))}
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
        </section>
      )
    }

    if (tipo === 'egresos') {
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-2xl font-semibold text-slate-900">Detalle de egresos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Movimientos de egreso entre {formatDate(desde)} y {formatDate(hasta)}.
          </p>

          <div className="mt-6">
            {movimientos.length === 0 ? (
              <div className="text-sm text-slate-500">
                No hay egresos para mostrar en el período seleccionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Documento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Monto</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{formatDate(item.fecha)}</td>
                        <td className="py-3 pr-4">
                          {item.numero_documento ?? item.tipo_documento ?? '-'}
                        </td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4 font-medium">
                          {formatCLP(item.monto_total)}
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
        </section>
      )
    }

    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h2 className="text-2xl font-semibold text-slate-900">Detalle de flujo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ingresos y egresos entre {formatDate(desde)} y {formatDate(hasta)}.
        </p>

        <div className="mt-6">
          {movimientos.length === 0 ? (
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
                    <th className="py-3 pr-4">Monto</th>
                    <th className="py-3 pr-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((item) => {
                    const montoVisual =
                      item.tipo_movimiento === 'ingreso'
                        ? getSignedIngresoAmount(item)
                        : Number(item.monto_total || 0)

                    return (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{formatDate(item.fecha)}</td>
                        <td className="py-3 pr-4">
                          {formatTipoMovimiento(item.tipo_movimiento)}
                        </td>
                        <td className="py-3 pr-4">
                          {item.numero_documento ?? item.tipo_documento ?? '-'}
                        </td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
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
    )
  }

  return (
    <main className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900">{titulo}</h1>
          <p className="mt-2 text-slate-600">
            {tipo === 'cobranza' || tipo === 'bancos'
              ? 'Reporte individual de la empresa activa.'
              : `Período: ${formatDate(desde)} al ${formatDate(hasta)}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reportes"
            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-300"
          >
            Volver
          </Link>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      <EmpresaActivaBanner
        modulo={titulo}
        descripcion={descripcionBanner}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando reporte...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {renderResumen()}
          {renderTabla()}
        </>
      )}
    </main>
  )
}