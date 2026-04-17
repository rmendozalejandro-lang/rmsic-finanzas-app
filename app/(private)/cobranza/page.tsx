'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DateRangeFilter from '../reportes/components/DateRangeFilter'
import ExportExcelButton from '../reportes/components/ExportExcelButton'
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

type GestionCobranza = {
  estado_gestion: string
  fecha_contacto: string
  proximo_contacto: string
  observacion: string
  updated_at: string
}

type GestionesMap = Record<string, GestionCobranza>

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatFecha = (value: string | null) => {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CL')
}

const getToday = () => new Date().toISOString().slice(0, 10)

const getFirstDayOfMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const getEstadoBase = (estado: string) => normalize(estado || '')

const getGestionStorageKey = (empresaId: string) =>
  `cobranza_gestiones_${empresaId}`

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

const isVencida = (estado: string, fechaVencimiento: string | null) => {
  const base = getEstadoBase(estado)

  if (base === 'vencido') return true
  if (!fechaVencimiento) return false
  if (base === 'pagado') return false

  const hoy = new Date()
  const vencimiento = new Date(`${fechaVencimiento}T23:59:59`)

  return (base === 'pendiente' || base === 'parcial') && vencimiento < hoy
}

const isPorVencerEn7Dias = (
  estado: string,
  fechaVencimiento: string | null
) => {
  if (!fechaVencimiento) return false

  const base = getEstadoBase(estado)
  if (base === 'pagado' || base === 'vencido') return false

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const limite = new Date(inicioHoy)
  limite.setDate(limite.getDate() + 7)

  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)

  return (
    (base === 'pendiente' || base === 'parcial') &&
    vencimiento >= inicioHoy &&
    vencimiento <= limite
  )
}

const getDiasRespectoVencimiento = (fechaVencimiento: string | null) => {
  if (!fechaVencimiento) return null

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)

  const diffMs = vencimiento.getTime() - inicioHoy.getTime()
  return Math.round(diffMs / 86400000)
}

const getGestionLabel = (estadoGestion: string) => {
  switch (estadoGestion) {
    case 'contactado':
      return 'Contactado'
    case 'compromiso_pago':
      return 'Compromiso de pago'
    case 'en_revision':
      return 'En revisión'
    case 'sin_respuesta':
      return 'Sin respuesta'
    default:
      return 'Sin gestión'
  }
}

const buildClipboardText = (
  item: CobranzaPendiente,
  gestion?: GestionCobranza
) => {
  const estadoVisual = getEstadoVisual(item.estado, item.fecha_vencimiento)

  return [
    `Cliente: ${item.cliente || '-'}`,
    `Factura: ${item.numero_factura || '-'}`,
    `Fecha emisión: ${formatFecha(item.fecha_emision)}`,
    `Fecha vencimiento: ${formatFecha(item.fecha_vencimiento)}`,
    `Descripción: ${item.descripcion || '-'}`,
    `Monto total: ${formatCLP(item.monto_total)}`,
    `Saldo pendiente: ${formatCLP(item.saldo_pendiente)}`,
    `Estado: ${estadoVisual}`,
    `Gestión: ${gestion ? getGestionLabel(gestion.estado_gestion) : 'Sin gestión'}`,
    `Fecha contacto: ${gestion?.fecha_contacto ? formatFecha(gestion.fecha_contacto) : '-'}`,
    `Próximo contacto: ${gestion?.proximo_contacto ? formatFecha(gestion.proximo_contacto) : '-'}`,
    `Observación: ${gestion?.observacion || '-'}`,
  ].join('\n')
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 py-3 md:grid-cols-[180px_1fr]">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value}</div>
    </div>
  )
}

export default function CobranzaPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])

  const [desde, setDesde] = useState(getFirstDayOfMonth())
  const [hasta, setHasta] = useState(getToday())

  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [vistaRapida, setVistaRapida] = useState<
    'todas' | 'vencidas' | 'por_vencer' | 'criticas'
  >('todas')

  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<CobranzaPendiente | null>(null)

  const [gestiones, setGestiones] = useState<GestionesMap>({})

  const [estadoGestionInput, setEstadoGestionInput] = useState('sin_gestion')
  const [fechaContactoInput, setFechaContactoInput] = useState('')
  const [proximoContactoInput, setProximoContactoInput] = useState('')
  const [observacionInput, setObservacionInput] = useState('')

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
    if (!empresaActivaId) {
      setGestiones({})
      return
    }

    try {
      const raw = window.localStorage.getItem(getGestionStorageKey(empresaActivaId))
      const parsed = raw ? (JSON.parse(raw) as GestionesMap) : {}
      setGestiones(parsed)
    } catch (error) {
      console.error('Error leyendo gestiones de cobranza:', error)
      setGestiones({})
    }
  }, [empresaActivaId])

  useEffect(() => {
    if (!detalleSeleccionado) return

    const gestion = gestiones[detalleSeleccionado.numero_factura]

    setEstadoGestionInput(gestion?.estado_gestion || 'sin_gestion')
    setFechaContactoInput(gestion?.fecha_contacto || '')
    setProximoContactoInput(gestion?.proximo_contacto || '')
    setObservacionInput(gestion?.observacion || '')
  }, [detalleSeleccionado, gestiones])

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
    const fetchCobranza = async () => {
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
          setError('No se pudo cargar la cobranza.')
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

    fetchCobranza()
  }, [router, empresaActivaId, desde, hasta])

  const totalPorCobrar = useMemo(() => {
    return cobranza.reduce(
      (acc, item) => acc + Number(item.saldo_pendiente || 0),
      0
    )
  }, [cobranza])

  const vencidas = useMemo(() => {
    return cobranza.filter((item) =>
      isVencida(item.estado, item.fecha_vencimiento)
    )
  }, [cobranza])

  const porVencer = useMemo(() => {
    return cobranza.filter((item) =>
      isPorVencerEn7Dias(item.estado, item.fecha_vencimiento)
    )
  }, [cobranza])

  const montoVencido = useMemo(() => {
    return vencidas.reduce(
      (acc, item) => acc + Number(item.saldo_pendiente || 0),
      0
    )
  }, [vencidas])

  const montoPorVencer = useMemo(() => {
    return porVencer.reduce(
      (acc, item) => acc + Number(item.saldo_pendiente || 0),
      0
    )
  }, [porVencer])

  const cobranzaFiltrada = useMemo(() => {
    const texto = normalize(busqueda.trim())

    return cobranza.filter((item) => {
      const estadoVisual = normalize(
        getEstadoVisual(item.estado, item.fecha_vencimiento)
      )
      const estadoBase = getEstadoBase(item.estado)

      const cumpleBusqueda =
        !texto ||
        normalize(item.cliente || '').includes(texto) ||
        normalize(item.numero_factura || '').includes(texto) ||
        normalize(item.descripcion || '').includes(texto)

      const cumpleEstado =
        estadoFiltro === 'todos' ||
        estadoVisual === estadoFiltro ||
        estadoBase === estadoFiltro

      let cumpleVista = true

      if (vistaRapida === 'vencidas') {
        cumpleVista = isVencida(item.estado, item.fecha_vencimiento)
      }

      if (vistaRapida === 'por_vencer') {
        cumpleVista = isPorVencerEn7Dias(item.estado, item.fecha_vencimiento)
      }

      if (vistaRapida === 'criticas') {
        cumpleVista =
          isVencida(item.estado, item.fecha_vencimiento) ||
          isPorVencerEn7Dias(item.estado, item.fecha_vencimiento)
      }

      return cumpleBusqueda && cumpleEstado && cumpleVista
    })
  }, [cobranza, busqueda, estadoFiltro, vistaRapida])

  const totalFiltrado = useMemo(() => {
    return cobranzaFiltrada.reduce(
      (acc, item) => acc + Number(item.saldo_pendiente || 0),
      0
    )
  }, [cobranzaFiltrada])

  const excelRows = useMemo(() => {
    return cobranzaFiltrada.map((item) => {
      const gestion = gestiones[item.numero_factura]

      return {
        Cliente: item.cliente || '-',
        Factura: item.numero_factura || '-',
        Emision: formatFecha(item.fecha_emision),
        Vencimiento: formatFecha(item.fecha_vencimiento),
        Descripcion: item.descripcion || '-',
        Monto_total: Number(item.monto_total || 0),
        Saldo_pendiente: Number(item.saldo_pendiente || 0),
        Estado: getEstadoVisual(item.estado, item.fecha_vencimiento),
        Gestion: gestion ? getGestionLabel(gestion.estado_gestion) : 'Sin gestión',
        Fecha_contacto: gestion?.fecha_contacto
          ? formatFecha(gestion.fecha_contacto)
          : '-',
        Proximo_contacto: gestion?.proximo_contacto
          ? formatFecha(gestion.proximo_contacto)
          : '-',
        Observacion: gestion?.observacion || '-',
      }
    })
  }, [cobranzaFiltrada, gestiones])

  const handleCopy = async (item: CobranzaPendiente) => {
    try {
      const gestion = gestiones[item.numero_factura]
      await navigator.clipboard.writeText(buildClipboardText(item, gestion))
      alert('Detalle copiado al portapapeles.')
    } catch (error) {
      console.error('Error copiando detalle:', error)
      alert('No se pudo copiar el detalle.')
    }
  }

  const handleSaveGestion = () => {
    if (!detalleSeleccionado || !empresaActivaId) return

    const nextGestiones: GestionesMap = {
      ...gestiones,
      [detalleSeleccionado.numero_factura]: {
        estado_gestion: estadoGestionInput,
        fecha_contacto: fechaContactoInput,
        proximo_contacto: proximoContactoInput,
        observacion: observacionInput,
        updated_at: new Date().toISOString(),
      },
    }

    setGestiones(nextGestiones)
    window.localStorage.setItem(
      getGestionStorageKey(empresaActivaId),
      JSON.stringify(nextGestiones)
    )

    alert('Seguimiento guardado.')
  }

  const detalleGestion = detalleSeleccionado
    ? gestiones[detalleSeleccionado.numero_factura]
    : null

  const detalleDias = detalleSeleccionado
    ? getDiasRespectoVencimiento(detalleSeleccionado.fecha_vencimiento)
    : null

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Gestión de cobranza</p>
            <h1 className="text-2xl font-semibold text-slate-900">Cobranza</h1>
            <p className="text-sm text-slate-600">
              Empresa activa: {empresaActivaNombre || 'Sin empresa activa'}
            </p>
          </div>

          <div className="no-print">
            <ExportExcelButton
              fileName={`cobranza_${empresaActivaNombre || 'empresa'}_${desde}_${hasta}.xlsx`}
              sheetName="Cobranza"
              rows={excelRows}
              disabled={loading}
            />
          </div>
        </div>
      </section>

      <DateRangeFilter
        desde={desde}
        hasta={hasta}
        onDesdeChange={setDesde}
        onHastaChange={setHasta}
        onPresetChange={handlePresetChange}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando cobranza...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total por cobrar</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCLP(totalPorCobrar)}
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <p className="text-sm text-red-700">Facturas vencidas</p>
              <p className="mt-2 text-2xl font-semibold text-red-800">
                {vencidas.length}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <p className="text-sm text-amber-700">Monto vencido</p>
              <p className="mt-2 text-2xl font-semibold text-amber-800">
                {formatCLP(montoVencido)}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <p className="text-sm text-blue-700">Por vencer en 7 días</p>
              <p className="mt-2 text-2xl font-semibold text-blue-800">
                {formatCLP(montoPorVencer)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  Estado
                </label>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="parcial">Parcial</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Resultado filtrado
                </label>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {cobranzaFiltrada.length} registro(s) · {formatCLP(totalFiltrado)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVistaRapida('todas')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  vistaRapida === 'todas'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Todas
              </button>

              <button
                type="button"
                onClick={() => setVistaRapida('vencidas')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  vistaRapida === 'vencidas'
                    ? 'bg-red-700 text-white'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                Solo vencidas
              </button>

              <button
                type="button"
                onClick={() => setVistaRapida('por_vencer')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  vistaRapida === 'por_vencer'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                Por vencer
              </button>

              <button
                type="button"
                onClick={() => setVistaRapida('criticas')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  vistaRapida === 'criticas'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                Críticas
              </button>

              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setEstadoFiltro('todos')
                  setVistaRapida('todas')
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          {vencidas.length > 0 && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-red-800">
                Alertas de cobranza
              </h2>
              <p className="mt-1 text-sm text-red-700">
                Tienes {vencidas.length} factura(s) vencida(s) para seguimiento inmediato.
              </p>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium">Emisión</th>
                    <th className="px-4 py-3 font-medium">Vencimiento</th>
                    <th className="px-4 py-3 font-medium">Gestión</th>
                    <th className="px-4 py-3 font-medium">Próx. contacto</th>
                    <th className="px-4 py-3 font-medium text-right">Saldo pendiente</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cobranzaFiltrada.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No hay facturas para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    cobranzaFiltrada.map((item, index) => {
                      const estadoVisual = getEstadoVisual(
                        item.estado,
                        item.fecha_vencimiento
                      )
                      const gestion = gestiones[item.numero_factura]

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
                            {gestion
                              ? getGestionLabel(gestion.estado_gestion)
                              : 'Sin gestión'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {gestion?.proximo_contacto
                              ? formatFecha(gestion.proximo_contacto)
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatCLP(item.saldo_pendiente)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={estadoVisual} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setDetalleSeleccionado(item)}
                                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                              >
                                Detalle
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopy(item)}
                                className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
                              >
                                Copiar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {detalleSeleccionado && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Detalle de cobranza</p>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Factura {detalleSeleccionado.numero_factura || '-'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {detalleSeleccionado.cliente || '-'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetalleSeleccionado(null)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge
                      status={getEstadoVisual(
                        detalleSeleccionado.estado,
                        detalleSeleccionado.fecha_vencimiento
                      )}
                    />
                    <span className="text-sm text-slate-700">
                      Saldo pendiente:{' '}
                      <strong>{formatCLP(detalleSeleccionado.saldo_pendiente)}</strong>
                    </span>
                    {detalleDias !== null && (
                      <span className="text-sm text-slate-700">
                        {detalleDias < 0
                          ? `${Math.abs(detalleDias)} día(s) vencida`
                          : detalleDias === 0
                          ? 'Vence hoy'
                          : `${detalleDias} día(s) para vencer`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <DetailRow
                    label="Cliente"
                    value={detalleSeleccionado.cliente || '-'}
                  />
                  <DetailRow
                    label="Factura"
                    value={detalleSeleccionado.numero_factura || '-'}
                  />
                  <DetailRow
                    label="Fecha de emisión"
                    value={formatFecha(detalleSeleccionado.fecha_emision)}
                  />
                  <DetailRow
                    label="Fecha de vencimiento"
                    value={formatFecha(detalleSeleccionado.fecha_vencimiento)}
                  />
                  <DetailRow
                    label="Descripción"
                    value={detalleSeleccionado.descripcion || '-'}
                  />
                  <DetailRow
                    label="Monto total"
                    value={formatCLP(detalleSeleccionado.monto_total)}
                  />
                  <DetailRow
                    label="Saldo pendiente"
                    value={formatCLP(detalleSeleccionado.saldo_pendiente)}
                  />
                  <DetailRow
                    label="Estado documento"
                    value={String(
                      getEstadoVisual(
                        detalleSeleccionado.estado,
                        detalleSeleccionado.fecha_vencimiento
                      )
                    )}
                  />
                </div>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Seguimiento manual
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Este seguimiento queda guardado localmente por empresa.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Estado de gestión
                      </label>
                      <select
                        value={estadoGestionInput}
                        onChange={(e) => setEstadoGestionInput(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      >
                        <option value="sin_gestion">Sin gestión</option>
                        <option value="contactado">Contactado</option>
                        <option value="compromiso_pago">Compromiso de pago</option>
                        <option value="en_revision">En revisión</option>
                        <option value="sin_respuesta">Sin respuesta</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Fecha de contacto
                      </label>
                      <input
                        type="date"
                        value={fechaContactoInput}
                        onChange={(e) => setFechaContactoInput(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Próximo contacto
                      </label>
                      <input
                        type="date"
                        value={proximoContactoInput}
                        onChange={(e) => setProximoContactoInput(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Observación
                    </label>
                    <textarea
                      value={observacionInput}
                      onChange={(e) => setObservacionInput(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Registrar comentario, compromiso, llamada realizada, respuesta del cliente, etc."
                    />
                  </div>

                  {detalleGestion?.updated_at ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Última actualización:{' '}
                      {new Date(detalleGestion.updated_at).toLocaleString('es-CL')}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSaveGestion}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Guardar seguimiento
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopy(detalleSeleccionado)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      Copiar detalle
                    </button>

                    <button
                      type="button"
                      onClick={() => setDetalleSeleccionado(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Cerrar panel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}