'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DateRangeFilter from '../components/DateRangeFilter'
import ExportExcelButton from '../components/ExportExcelButton'
import ReportPageHeader from '../components/ReportPageHeader'
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

type TramoKey =
  | 'al_dia'
  | 'de_1_a_30'
  | 'de_31_a_60'
  | 'de_61_a_90'
  | 'mas_de_90'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatFecha = (value: string | null) => {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CL')
}

const getToday = () => new Date().toISOString().slice(0, 10)

const getFirstDayOfYear = () => {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const getEstadoBase = (estado: string) => normalize(estado || '')

const getEstadoVisual = (estado: string, fechaVencimiento: string | null) => {
  const base = getEstadoBase(estado)

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

const getDiasVencidos = (fechaVencimiento: string | null) => {
  if (!fechaVencimiento) return 0

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)

  const diffMs = inicioHoy.getTime() - vencimiento.getTime()
  const dias = Math.floor(diffMs / 86400000)

  return dias > 0 ? dias : 0
}

const getTramo = (item: CobranzaPendiente): TramoKey => {
  const diasVencidos = getDiasVencidos(item.fecha_vencimiento)

  if (diasVencidos <= 0) return 'al_dia'
  if (diasVencidos <= 30) return 'de_1_a_30'
  if (diasVencidos <= 60) return 'de_31_a_60'
  if (diasVencidos <= 90) return 'de_61_a_90'
  return 'mas_de_90'
}

const getTramoLabel = (tramo: TramoKey) => {
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

export default function AntiguedadSaldosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<CobranzaPendiente[]>([])

  const [desde, setDesde] = useState(getFirstDayOfYear())
  const [hasta, setHasta] = useState(getToday())

  const [busqueda, setBusqueda] = useState('')
  const [tramoFiltro, setTramoFiltro] = useState<'todos' | TramoKey>('todos')

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
      setDesde(
        new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10)
      )
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
    const fetchData = async () => {
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
          setError('No se pudo cargar la antigüedad de saldos.')
          return
        }

        setItems(Array.isArray(data) ? data : [])
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

    fetchData()
  }, [router, empresaActivaId, desde, hasta])

  const itemsFiltrados = useMemo(() => {
    const texto = normalize(busqueda.trim())

    return items.filter((item) => {
      const tramo = getTramo(item)

      const cumpleBusqueda =
        !texto ||
        normalize(item.cliente || '').includes(texto) ||
        normalize(item.numero_factura || '').includes(texto) ||
        normalize(item.descripcion || '').includes(texto)

      const cumpleTramo = tramoFiltro === 'todos' || tramo === tramoFiltro

      return cumpleBusqueda && cumpleTramo
    })
  }, [items, busqueda, tramoFiltro])

  const resumen = useMemo(() => {
    const base = {
      al_dia: { cantidad: 0, monto: 0 },
      de_1_a_30: { cantidad: 0, monto: 0 },
      de_31_a_60: { cantidad: 0, monto: 0 },
      de_61_a_90: { cantidad: 0, monto: 0 },
      mas_de_90: { cantidad: 0, monto: 0 },
    }

    for (const item of items) {
      const tramo = getTramo(item)
      base[tramo].cantidad += 1
      base[tramo].monto += Number(item.saldo_pendiente || 0)
    }

    return base
  }, [items])

  const totalGeneral = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0)
  }, [items])

  const totalFiltrado = useMemo(() => {
    return itemsFiltrados.reduce(
      (acc, item) => acc + Number(item.saldo_pendiente || 0),
      0
    )
  }, [itemsFiltrados])

  const excelRows = useMemo(() => {
    return itemsFiltrados.map((item) => ({
      Cliente: item.cliente || '-',
      Factura: item.numero_factura || '-',
      Emision: formatFecha(item.fecha_emision),
      Vencimiento: formatFecha(item.fecha_vencimiento),
      Descripcion: item.descripcion || '-',
      Monto_total: Number(item.monto_total || 0),
      Saldo_pendiente: Number(item.saldo_pendiente || 0),
      Estado: getEstadoVisual(item.estado, item.fecha_vencimiento),
      Dias_vencidos: getDiasVencidos(item.fecha_vencimiento),
      Tramo: getTramoLabel(getTramo(item)),
    }))
  }, [itemsFiltrados])

  return (
    <main className="space-y-6">
     <ReportPageHeader
  title="Antigüedad de saldos"
  empresaActivaNombre={empresaActivaNombre}
/>

<p className="mt-2 text-sm text-slate-600">
  Clasificación de cuentas por cobrar por tramos de vencimiento.
</p>

      <DateRangeFilter
        desde={desde}
        hasta={hasta}
        onDesdeChange={setDesde}
        onHastaChange={setHasta}
        onPresetChange={handlePresetChange}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <p className="text-sm text-slate-500">Total general</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCLP(totalGeneral)}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm text-emerald-700">Al día</p>
          <p className="mt-2 text-xl font-semibold text-emerald-900">
            {formatCLP(resumen.al_dia.monto)}
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            {resumen.al_dia.cantidad} documento(s)
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm text-amber-700">1 a 30 días</p>
          <p className="mt-2 text-xl font-semibold text-amber-900">
            {formatCLP(resumen.de_1_a_30.monto)}
          </p>
          <p className="mt-1 text-sm text-amber-700">
            {resumen.de_1_a_30.cantidad} documento(s)
          </p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
          <p className="text-sm text-orange-700">31 a 60 días</p>
          <p className="mt-2 text-xl font-semibold text-orange-900">
            {formatCLP(resumen.de_31_a_60.monto)}
          </p>
          <p className="mt-1 text-sm text-orange-700">
            {resumen.de_31_a_60.cantidad} documento(s)
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-700">61 a 90 días</p>
          <p className="mt-2 text-xl font-semibold text-rose-900">
            {formatCLP(resumen.de_61_a_90.monto)}
          </p>
          <p className="mt-1 text-sm text-rose-700">
            {resumen.de_61_a_90.cantidad} documento(s)
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-red-700">Más de 90 días</p>
          <p className="mt-2 text-xl font-semibold text-red-900">
            {formatCLP(resumen.mas_de_90.monto)}
          </p>
          <p className="mt-1 text-sm text-red-700">
            {resumen.mas_de_90.cantidad} documento(s)
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente, factura o descripción"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tramo
            </label>
            <select
              value={tramoFiltro}
              onChange={(e) =>
                setTramoFiltro(e.target.value as 'todos' | TramoKey)
              }
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="al_dia">Al día</option>
              <option value="de_1_a_30">1 a 30 días</option>
              <option value="de_31_a_60">31 a 60 días</option>
              <option value="de_61_a_90">61 a 90 días</option>
              <option value="mas_de_90">Más de 90 días</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Resultado filtrado
            </label>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {itemsFiltrados.length} registro(s) · {formatCLP(totalFiltrado)}
            </div>
          </div>

          <div className="flex items-end">
            <ExportExcelButton
              fileName={`antiguedad_saldos_${empresaActivaNombre || 'empresa'}_${desde}_${hasta}.xlsx`}
              sheetName="Antiguedad de saldos"
              rows={excelRows}
              disabled={loading}
            />
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando antigüedad de saldos...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Factura</th>
                  <th className="px-4 py-3 font-medium">Emisión</th>
                  <th className="px-4 py-3 font-medium">Vencimiento</th>
                  <th className="px-4 py-3 font-medium">Días vencidos</th>
                  <th className="px-4 py-3 font-medium">Tramo</th>
                  <th className="px-4 py-3 font-medium text-right">Saldo pendiente</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  itemsFiltrados.map((item, index) => {
                    const diasVencidos = getDiasVencidos(item.fecha_vencimiento)
                    const tramo = getTramo(item)

                    return (
                      <tr
                        key={`${item.numero_factura}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 text-slate-700">
                          {item.cliente}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.numero_factura}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatFecha(item.fecha_emision)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatFecha(item.fecha_vencimiento)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {diasVencidos}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {getTramoLabel(tramo)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCLP(item.saldo_pendiente)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={getEstadoVisual(
                              item.estado,
                              item.fecha_vencimiento
                            )}
                          />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}