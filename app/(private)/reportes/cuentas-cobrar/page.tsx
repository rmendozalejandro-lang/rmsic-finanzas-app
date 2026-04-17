'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DateRangeFilter from '../components/DateRangeFilter'
import ReportPageHeader from '../components/ReportPageHeader'
import ExportExcelButton from '../components/ExportExcelButton'
import StatusBadge from '@/components/StatusBadge'

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

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatCLP = (value: number) => `$${Number(value || 0).toLocaleString('es-CL')}`

const formatFecha = (value: string | null) => {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CL')
}

const getToday = () => new Date().toISOString().slice(0, 10)

const getFirstDayOfMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
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

export default function CuentasCobrarPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])

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
    const fetchCuentasCobrar = async () => {
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

        const response = await fetch(
          `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&fecha_emision=gte.${desde}&fecha_emision=lte.${hasta}&select=*&order=fecha_vencimiento.asc.nullslast`,
          { headers }
        )

        const data = await response.json()

        if (!response.ok) {
          setError('No se pudieron cargar las cuentas por cobrar.')
          return
        }

        setCobranza(Array.isArray(data) ? data : [])
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

    fetchCuentasCobrar()
  }, [router, empresaActivaId, desde, hasta])

  const totalPorCobrar = useMemo(() => {
    return cobranza.reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0)
  }, [cobranza])

  const facturasVencidas = useMemo(() => {
    return cobranza.filter((item) => isVencida(item.estado, item.fecha_vencimiento))
  }, [cobranza])

  const montoVencidoTotal = useMemo(() => {
    return facturasVencidas.reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0)
  }, [facturasVencidas])

  const porVencerSemana = useMemo(() => {
    return cobranza.filter((item) =>
      isPorVencerEstaSemana(item.estado, item.fecha_vencimiento)
    )
  }, [cobranza])

  const excelRows = useMemo(() => {
    return cobranza.map((item) => ({
      Cliente: item.cliente,
      Factura: item.numero_factura,
      Emision: formatFecha(item.fecha_emision),
      Vencimiento: formatFecha(item.fecha_vencimiento),
      Descripcion: item.descripcion || '-',
      Monto_total: Number(item.monto_total || 0),
      Saldo_pendiente: Number(item.saldo_pendiente || 0),
      Estado: item.estado || '-',
    }))
  }, [cobranza])

  return (
    <main className="space-y-6">
      <ReportPageHeader
        title="Cuentas por cobrar"
        empresaActivaNombre={empresaActivaNombre}
        subtitle="Seguimiento de facturas pendientes, vencimientos y saldos."
        desde={desde}
        hasta={hasta}
        rightActions={
          <ExportExcelButton
            fileName={`cuentas_por_cobrar_${empresaActivaNombre || 'empresa'}_${desde}_${hasta}.xlsx`}
            sheetName="Cobranza"
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
          Cargando cuentas por cobrar...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total por cobrar</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCLP(totalPorCobrar)}
              </p>
            </div>

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
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <p className="text-sm text-blue-700">Por vencer esta semana</p>
            <p className="mt-2 text-2xl font-semibold text-blue-800">
              {porVencerSemana.length}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium">Emisión</th>
                    <th className="px-4 py-3 font-medium">Vencimiento</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium text-right">Monto total</th>
                    <th className="px-4 py-3 font-medium text-right">Saldo pendiente</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cobranza.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No hay facturas pendientes en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    cobranza.map((item, index) => {
                      const estadoVisual = getEstadoVisual(
                        item.estado,
                        item.fecha_vencimiento
                      )

                      return (
                        <tr
                          key={`${item.numero_factura}-${index}`}
                          className="border-t border-slate-100"
                        >
                          <td className="px-4 py-3 text-slate-700">{item.cliente}</td>
                          <td className="px-4 py-3 text-slate-700">{item.numero_factura}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatFecha(item.fecha_emision)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatFecha(item.fecha_vencimiento)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {item.descripcion || '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatCLP(item.monto_total)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatCLP(item.saldo_pendiente)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={estadoVisual} />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}