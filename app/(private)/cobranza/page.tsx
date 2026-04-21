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

type GestionCobranzaRow = {
  numero_factura: string
  estado_gestion: string
  fecha_contacto: string | null
  proximo_contacto: string | null
  observacion: string | null
  updated_at: string
}

type ClienteEmailRow = {
  id: string
  nombre?: string | null
  razon_social?: string | null
  nombre_fantasia?: string | null
  empresa?: string | null
  cliente?: string | null
  email?: string | null
  [key: string]: unknown
}

type CuentaBancariaOption = {
  id: string
  banco: string
  nombre_cuenta: string
}

type CuentaPorCobrarRow = {
  id: string
  empresa_id: string
  movimiento_id: string | null
  cliente_id: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  monto_total: number | null
  monto_pagado: number | null
  saldo_pendiente: number | null
  estado: string | null
  updated_at?: string | null
}

type MovimientoRow = {
  id: string
  cliente_id: string | null
  descripcion: string | null
  monto_total: number | null
  monto_neto: number | null
  monto_iva: number | null
  monto_exento: number | null
  observaciones: string | null
}

type MovimientoPagoListado = {
  id: string
  numero_documento: string | null
  descripcion: string | null
  fecha: string
  cuenta_bancaria_id: string | null
  medio_pago: string | null
  clientes?: Array<{
    nombre: string
  }> | null
}

type PagoRegistrado = {
  movimiento_id: string
  numero_factura: string
  cliente: string
  descripcion: string
  fecha_pago: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  monto_total: number
  medio_pago: string | null
  cuenta_bancaria_id: string | null
  updated_at: string
}

type BitacoraCobranzaRow = {
  id: string
  empresa_id: string
  numero_factura: string
  cliente: string | null
  accion: string
  detalle: string | null
  usuario_id: string | null
  created_at: string
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

const formatFechaHora = (value: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-CL')
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

const formatMedioPago = (medioPago: string | null) => {
  switch (medioPago) {
    case 'transferencia':
      return 'Transferencia'
    case 'deposito':
      return 'Depósito'
    case 'cheque':
      return 'Cheque'
    case 'efectivo':
      return 'Efectivo'
    case 'tarjeta':
      return 'Tarjeta'
    case 'otro':
      return 'Otro'
    default:
      return medioPago || '-'
  }
}

const formatAccionBitacora = (accion: string) => {
  switch (accion) {
    case 'email_preparado':
      return 'Email preparado'
    case 'seguimiento_guardado':
      return 'Seguimiento guardado'
    case 'pago_registrado':
      return 'Pago registrado'
    case 'pago_revertido':
      return 'Pago revertido'
    default:
      return accion
  }
}

const isSinGestion = (gestion?: GestionCobranza) =>
  !gestion || gestion.estado_gestion === 'sin_gestion'

const isConGestion = (gestion?: GestionCobranza) =>
  !!gestion && gestion.estado_gestion !== 'sin_gestion'

const isCompromisoPago = (gestion?: GestionCobranza) =>
  gestion?.estado_gestion === 'compromiso_pago'

const isProximoContactoVencidoOHoy = (gestion?: GestionCobranza) => {
  if (!gestion?.proximo_contacto) return false

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const proximo = new Date(`${gestion.proximo_contacto}T00:00:00`)

  return proximo <= inicioHoy
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

const getClienteDisplayName = (cliente: ClienteEmailRow) => {
  const candidatos = [
    cliente.razon_social,
    cliente.nombre,
    cliente.nombre_fantasia,
    cliente.empresa,
    cliente.cliente,
  ]

  for (const valor of candidatos) {
    if (typeof valor === 'string' && valor.trim()) return valor.trim()
  }

  return ''
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
  const [gestionFiltro, setGestionFiltro] = useState('todos')

  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<CobranzaPendiente | null>(null)

  const [gestiones, setGestiones] = useState<GestionesMap>({})
  const [clienteEmailMap, setClienteEmailMap] = useState<Record<string, string>>(
    {}
  )

  const [estadoGestionInput, setEstadoGestionInput] = useState('sin_gestion')
  const [fechaContactoInput, setFechaContactoInput] = useState('')
  const [proximoContactoInput, setProximoContactoInput] = useState('')
  const [observacionInput, setObservacionInput] = useState('')

  const [cuentasBancarias, setCuentasBancarias] = useState<
    CuentaBancariaOption[]
  >([])
  const [fechaPagoInput, setFechaPagoInput] = useState(getToday())
  const [cuentaBancariaPagoId, setCuentaBancariaPagoId] = useState('')
  const [medioPagoInput, setMedioPagoInput] = useState('transferencia')
  const [observacionPagoInput, setObservacionPagoInput] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  const [pagosRegistrados, setPagosRegistrados] = useState<PagoRegistrado[]>([])
  const [loadingPagosRegistrados, setLoadingPagosRegistrados] = useState(false)
  const [revertingPagoId, setRevertingPagoId] = useState('')

  const [bitacora, setBitacora] = useState<BitacoraCobranzaRow[]>([])
  const [loadingBitacora, setLoadingBitacora] = useState(false)

  const getCuentaLabel = (cuentaId: string | null) => {
    if (!cuentaId) return '-'

    const cuenta = cuentasBancarias.find((item) => item.id === cuentaId)
    if (!cuenta) return '-'

    return `${cuenta.banco} - ${cuenta.nombre_cuenta}`
  }

  const registrarBitacora = async ({
    numeroFactura,
    cliente,
    accion,
    detalle,
  }: {
    numeroFactura: string
    cliente?: string | null
    accion: string
    detalle?: string | null
  }) => {
    if (!empresaActivaId || !numeroFactura) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const usuarioId = sessionData.session?.user.id || null

      const { error } = await supabase.from('cobranza_bitacora').insert({
        empresa_id: empresaActivaId,
        numero_factura: numeroFactura,
        cliente: cliente || null,
        accion,
        detalle: detalle || null,
        usuario_id: usuarioId,
      })

      if (!error) {
        await loadBitacora()
      }
    } catch {
      // no bloquear flujo principal
    }
  }

  const loadCobranza = async () => {
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

  const loadPagosRegistrados = async () => {
    if (!empresaActivaId) {
      setPagosRegistrados([])
      return
    }

    try {
      setLoadingPagosRegistrados(true)

      const { data: cxcPagadas, error: cxcError } = await supabase
        .from('cuentas_por_cobrar')
        .select(
          'id,empresa_id,movimiento_id,cliente_id,fecha_emision,fecha_vencimiento,monto_total,monto_pagado,saldo_pendiente,estado,updated_at'
        )
        .eq('empresa_id', empresaActivaId)
        .eq('estado', 'pagado')
        .not('movimiento_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (cxcError || !cxcPagadas || cxcPagadas.length === 0) {
        setPagosRegistrados([])
        return
      }

      const movementIds = Array.from(
        new Set(
          (cxcPagadas as CuentaPorCobrarRow[])
            .map((item) => item.movimiento_id)
            .filter((value): value is string => Boolean(value))
        )
      )

      if (movementIds.length === 0) {
        setPagosRegistrados([])
        return
      }

      const { data: movimientosPagados, error: movimientosError } = await supabase
        .from('movimientos')
        .select(
          'id,numero_documento,descripcion,fecha,cuenta_bancaria_id,medio_pago,clientes(nombre)'
        )
        .in('id', movementIds)
        .eq('empresa_id', empresaActivaId)
        .eq('tipo_movimiento', 'ingreso')
        .ilike('tipo_documento', 'factura')
        .eq('estado', 'pagado')

      if (movimientosError || !movimientosPagados) {
        setPagosRegistrados([])
        return
      }

      const movimientoMap = new Map<string, MovimientoPagoListado>()
      const movimientosRows =
        (movimientosPagados ?? []) as unknown as MovimientoPagoListado[]

      movimientosRows.forEach((row) => {
        movimientoMap.set(row.id, row)
      })

      const pagos = (cxcPagadas as CuentaPorCobrarRow[])
        .map((cxc) => {
          const movimientoId = cxc.movimiento_id || ''
          const movimiento = movimientoMap.get(movimientoId)

          if (!movimiento) return null

          return {
            movimiento_id: movimientoId,
            numero_factura: movimiento.numero_documento || '',
            cliente: movimiento.clientes?.[0]?.nombre || '-',
            descripcion: movimiento.descripcion || '-',
            fecha_pago: movimiento.fecha,
            fecha_emision: cxc.fecha_emision || null,
            fecha_vencimiento: cxc.fecha_vencimiento || null,
            monto_total: Number(cxc.monto_total || 0),
            medio_pago: movimiento.medio_pago || null,
            cuenta_bancaria_id: movimiento.cuenta_bancaria_id || null,
            updated_at: cxc.updated_at || '',
          } satisfies PagoRegistrado
        })
        .filter((item): item is PagoRegistrado => Boolean(item))

      setPagosRegistrados(pagos)
    } catch {
      setPagosRegistrados([])
    } finally {
      setLoadingPagosRegistrados(false)
    }
  }

  const loadBitacora = async () => {
    if (!empresaActivaId) {
      setBitacora([])
      return
    }

    try {
      setLoadingBitacora(true)

      const { data, error } = await supabase
        .from('cobranza_bitacora')
        .select('id,empresa_id,numero_factura,cliente,accion,detalle,usuario_id,created_at')
        .eq('empresa_id', empresaActivaId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error || !data) {
        setBitacora([])
        return
      }

      setBitacora(data as BitacoraCobranzaRow[])
    } catch {
      setBitacora([])
    } finally {
      setLoadingBitacora(false)
    }
  }

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
    const fetchGestiones = async () => {
      if (!empresaActivaId) {
        setGestiones({})
        return
      }

      try {
        const { data, error } = await supabase
          .from('cobranza_gestiones')
          .select(
            'numero_factura, estado_gestion, fecha_contacto, proximo_contacto, observacion, updated_at'
          )
          .eq('empresa_id', empresaActivaId)

        if (error) {
          return
        }

        const mapped: GestionesMap = {}

        ;(data || []).forEach((item: GestionCobranzaRow) => {
          mapped[item.numero_factura] = {
            estado_gestion: item.estado_gestion || 'sin_gestion',
            fecha_contacto: item.fecha_contacto || '',
            proximo_contacto: item.proximo_contacto || '',
            observacion: item.observacion || '',
            updated_at: item.updated_at || '',
          }
        })

        setGestiones(mapped)
      } catch {
        setGestiones({})
      }
    }

    fetchGestiones()
  }, [empresaActivaId])

  useEffect(() => {
    const fetchClientesEmail = async () => {
      if (!empresaActivaId) {
        setClienteEmailMap({})
        return
      }

      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('empresa_id', empresaActivaId)

        if (error || !data) {
          setClienteEmailMap({})
          return
        }

        const map: Record<string, string> = {}

        ;(data as ClienteEmailRow[]).forEach((row) => {
          const nombre = normalize(getClienteDisplayName(row))
          const email = typeof row.email === 'string' ? row.email.trim() : ''

          if (nombre && email) {
            map[nombre] = email
          }
        })

        setClienteEmailMap(map)
      } catch {
        setClienteEmailMap({})
      }
    }

    fetchClientesEmail()
  }, [empresaActivaId])

  useEffect(() => {
    const fetchCuentasBancarias = async () => {
      if (!empresaActivaId) {
        setCuentasBancarias([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('cuentas_bancarias')
          .select('id,banco,nombre_cuenta')
          .eq('empresa_id', empresaActivaId)
          .order('banco', { ascending: true })

        if (error) return

        setCuentasBancarias((data || []) as CuentaBancariaOption[])
      } catch {
        setCuentasBancarias([])
      }
    }

    fetchCuentasBancarias()
  }, [empresaActivaId])

  useEffect(() => {
    if (!detalleSeleccionado) return

    const gestion = gestiones[detalleSeleccionado.numero_factura]

    setEstadoGestionInput(gestion?.estado_gestion || 'sin_gestion')
    setFechaContactoInput(gestion?.fecha_contacto || '')
    setProximoContactoInput(gestion?.proximo_contacto || '')
    setObservacionInput(gestion?.observacion || '')

    setFechaPagoInput(getToday())
    setCuentaBancariaPagoId('')
    setMedioPagoInput('transferencia')
    setObservacionPagoInput('')
  }, [detalleSeleccionado, gestiones])

  useEffect(() => {
    void loadCobranza()
  }, [empresaActivaId, desde, hasta])

  useEffect(() => {
    void loadPagosRegistrados()
    void loadBitacora()
  }, [empresaActivaId])

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

  const sinGestionItems = useMemo(() => {
    return cobranza.filter((item) =>
      isSinGestion(gestiones[item.numero_factura])
    )
  }, [cobranza, gestiones])

  const compromisoPagoItems = useMemo(() => {
    return cobranza.filter((item) =>
      isCompromisoPago(gestiones[item.numero_factura])
    )
  }, [cobranza, gestiones])

  const proximoContactoVencidoItems = useMemo(() => {
    return cobranza.filter((item) =>
      isProximoContactoVencidoOHoy(gestiones[item.numero_factura])
    )
  }, [cobranza, gestiones])

  const cobranzaFiltrada = useMemo(() => {
    const texto = normalize(busqueda.trim())

    return cobranza.filter((item) => {
      const estadoVisual = normalize(
        getEstadoVisual(item.estado, item.fecha_vencimiento)
      )
      const estadoBase = getEstadoBase(item.estado)
      const gestion = gestiones[item.numero_factura]

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

      let cumpleGestion = true

      if (gestionFiltro === 'con_gestion') {
        cumpleGestion = isConGestion(gestion)
      } else if (gestionFiltro === 'sin_gestion') {
        cumpleGestion = isSinGestion(gestion)
      } else if (gestionFiltro === 'proximo_contacto_vencido') {
        cumpleGestion = isProximoContactoVencidoOHoy(gestion)
      } else if (gestionFiltro !== 'todos') {
        cumpleGestion =
          (gestion?.estado_gestion || 'sin_gestion') === gestionFiltro
      }

      return cumpleBusqueda && cumpleEstado && cumpleVista && cumpleGestion
    })
  }, [cobranza, busqueda, estadoFiltro, vistaRapida, gestionFiltro, gestiones])

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
    } catch {
      alert('No se pudo copiar el detalle.')
    }
  }

  const getClienteEmail = (clienteNombre: string) => {
    return clienteEmailMap[normalize(clienteNombre || '')] || ''
  }

  const buildReminderMailto = (item: CobranzaPendiente) => {
    const email = getClienteEmail(item.cliente || '')

    if (!email) return ''

    const subject = `Recordatorio de pago factura N° ${item.numero_factura}`
    const body = [
      `Estimado/a ${item.cliente || ''},`,
      '',
      `Junto con saludar, le recordamos que la factura N° ${item.numero_factura} se encuentra pendiente de pago.`,
      '',
      `Monto: ${formatCLP(item.saldo_pendiente || item.monto_total)}`,
      `Fecha de vencimiento: ${formatFecha(item.fecha_vencimiento)}`,
      '',
      'Agradeceremos su confirmación o información de pago.',
      '',
      'Saludos cordiales,',
      empresaActivaNombre || 'RMSIC',
    ].join('\n')

    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`
  }

  const handleEmailReminder = async (item: CobranzaPendiente) => {
    const mailto = buildReminderMailto(item)

    if (!mailto) {
      alert('Este cliente no tiene correo registrado.')
      return
    }

    try {
      const ahoraIso = new Date().toISOString()
      const hoy = getToday()
      const gestionActual = gestiones[item.numero_factura]

      const notaAutomatica = [
        'Recordatorio de pago preparado por correo.',
        `Factura: ${item.numero_factura}.`,
        `Monto: ${formatCLP(item.saldo_pendiente || item.monto_total)}.`,
        `Vencimiento: ${formatFecha(item.fecha_vencimiento)}.`,
        `Fecha registro: ${new Date(ahoraIso).toLocaleString('es-CL')}.`,
      ].join(' ')

      const observacionAnterior = gestionActual?.observacion?.trim()
      const observacionNueva = observacionAnterior
        ? `${observacionAnterior}\n\n${notaAutomatica}`
        : notaAutomatica

      const payload = {
        empresa_id: empresaActivaId,
        numero_factura: item.numero_factura,
        estado_gestion:
          gestionActual?.estado_gestion &&
          gestionActual.estado_gestion !== 'sin_gestion'
            ? gestionActual.estado_gestion
            : 'contactado',
        fecha_contacto: hoy,
        proximo_contacto: gestionActual?.proximo_contacto || null,
        observacion: observacionNueva,
        updated_at: ahoraIso,
      }

      const { error } = await supabase
        .from('cobranza_gestiones')
        .upsert(payload, { onConflict: 'empresa_id,numero_factura' })

      if (!error) {
        setGestiones((prev) => ({
          ...prev,
          [item.numero_factura]: {
            estado_gestion: payload.estado_gestion,
            fecha_contacto: payload.fecha_contacto || '',
            proximo_contacto: payload.proximo_contacto || '',
            observacion: payload.observacion || '',
            updated_at: payload.updated_at,
          },
        }))
      }

      await registrarBitacora({
        numeroFactura: item.numero_factura,
        cliente: item.cliente,
        accion: 'email_preparado',
        detalle: `Email preparado para ${item.cliente}. Monto ${formatCLP(
          item.saldo_pendiente || item.monto_total
        )}. Vencimiento ${formatFecha(item.fecha_vencimiento)}.`,
      })
    } catch {
      // sin bloqueo visual
    }

    window.location.href = mailto
  }

  const handleSaveGestion = async () => {
    if (!detalleSeleccionado || !empresaActivaId) return

    const payload = {
      empresa_id: empresaActivaId,
      numero_factura: detalleSeleccionado.numero_factura,
      estado_gestion: estadoGestionInput,
      fecha_contacto: fechaContactoInput || null,
      proximo_contacto: proximoContactoInput || null,
      observacion: observacionInput || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('cobranza_gestiones')
      .upsert(payload, { onConflict: 'empresa_id,numero_factura' })

    if (error) {
      alert('No se pudo guardar el seguimiento.')
      return
    }

    setGestiones((prev) => ({
      ...prev,
      [detalleSeleccionado.numero_factura]: {
        estado_gestion: estadoGestionInput,
        fecha_contacto: fechaContactoInput,
        proximo_contacto: proximoContactoInput,
        observacion: observacionInput,
        updated_at: payload.updated_at,
      },
    }))

    await registrarBitacora({
      numeroFactura: detalleSeleccionado.numero_factura,
      cliente: detalleSeleccionado.cliente,
      accion: 'seguimiento_guardado',
      detalle: `Estado gestión: ${getGestionLabel(
        estadoGestionInput
      )}. Próximo contacto: ${
        proximoContactoInput ? formatFecha(proximoContactoInput) : '-'
      }. Observación: ${observacionInput || '-'}`,
    })

    alert('Seguimiento guardado.')
  }

  const handleRegistrarPago = async () => {
    if (!detalleSeleccionado || !empresaActivaId) return

    if (!cuentaBancariaPagoId) {
      alert('Debes seleccionar la cuenta bancaria donde ingresó el pago.')
      return
    }

    try {
      setSavingPago(true)

      const numeroFactura = String(
        detalleSeleccionado.numero_factura || ''
      ).trim()
      const montoDocumento = Number(detalleSeleccionado.monto_total || 0)
      const observacionPago = observacionPagoInput.trim() || null

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !sessionData.session) {
        router.push('/login')
        return
      }

      const currentUserId = sessionData.session.user.id

      let movimientoExistente: MovimientoRow | null = null
      let cxcRow: CuentaPorCobrarRow | null = null

      const { data: movimientoData, error: movimientoError } = await supabase
        .from('movimientos')
        .select(
          'id,cliente_id,descripcion,monto_total,monto_neto,monto_iva,monto_exento,observaciones'
        )
        .eq('empresa_id', empresaActivaId)
        .eq('tipo_movimiento', 'ingreso')
        .ilike('tipo_documento', 'factura')
        .eq('numero_documento', numeroFactura)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (movimientoError) {
        alert('No se pudo validar el movimiento asociado.')
        return
      }

      movimientoExistente = (movimientoData as MovimientoRow | null) || null

      if (movimientoExistente?.id) {
        const { data: cxcByMovimiento, error: cxcByMovimientoError } =
          await supabase
            .from('cuentas_por_cobrar')
            .select(
              'id,empresa_id,movimiento_id,cliente_id,fecha_emision,fecha_vencimiento,monto_total,monto_pagado,saldo_pendiente,estado,updated_at'
            )
            .eq('empresa_id', empresaActivaId)
            .eq('movimiento_id', movimientoExistente.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (cxcByMovimientoError) {
          alert('No se pudo identificar la cuenta por cobrar.')
          return
        }

        cxcRow = (cxcByMovimiento as CuentaPorCobrarRow | null) || null
      }

      if (!cxcRow) {
        const { data: cxcFallback, error: cxcFallbackError } = await supabase
          .from('cuentas_por_cobrar')
          .select(
            'id,empresa_id,movimiento_id,cliente_id,fecha_emision,fecha_vencimiento,monto_total,monto_pagado,saldo_pendiente,estado,updated_at'
          )
          .eq('empresa_id', empresaActivaId)
          .eq('fecha_emision', detalleSeleccionado.fecha_emision)
          .eq(
            'fecha_vencimiento',
            detalleSeleccionado.fecha_vencimiento ||
              detalleSeleccionado.fecha_emision
          )
          .eq('monto_total', montoDocumento)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cxcFallbackError) {
          alert('No se pudo identificar la cuenta por cobrar.')
          return
        }

        cxcRow = (cxcFallback as CuentaPorCobrarRow | null) || null
      }

      if (!cxcRow) {
        alert(
          'No se encontró el registro de cuenta por cobrar asociado a esta factura.'
        )
        return
      }

      const montoPago = Number(
        cxcRow.monto_total || detalleSeleccionado.monto_total || 0
      )

      let movimientoId = cxcRow.movimiento_id || movimientoExistente?.id || null

      if (movimientoId) {
        const { error: movimientoUpdateError } = await supabase
          .from('movimientos')
          .update({
            fecha: fechaPagoInput,
            cuenta_bancaria_id: cuentaBancariaPagoId,
            estado: 'pagado',
            medio_pago: medioPagoInput || null,
            observaciones: observacionPago,
            updated_at: new Date().toISOString(),
          })
          .eq('id', movimientoId)

        if (movimientoUpdateError) {
          alert(
            movimientoUpdateError.message ||
              'No se pudo actualizar el ingreso asociado.'
          )
          return
        }
      } else {
        const { data: nuevoMovimiento, error: nuevoMovimientoError } =
          await supabase
            .from('movimientos')
            .insert({
              empresa_id: empresaActivaId,
              tipo_movimiento: 'ingreso',
              fecha: fechaPagoInput,
              fecha_vencimiento: detalleSeleccionado.fecha_vencimiento || null,
              tercero_tipo: 'cliente',
              cliente_id: cxcRow.cliente_id || null,
              cuenta_bancaria_id: cuentaBancariaPagoId,
              tipo_documento: 'factura',
              numero_documento: numeroFactura,
              descripcion:
                detalleSeleccionado.descripcion ||
                movimientoExistente?.descripcion ||
                `Pago factura ${numeroFactura}`,
              monto_neto:
                Number(movimientoExistente?.monto_neto || 0) || montoPago,
              monto_iva: Number(movimientoExistente?.monto_iva || 0),
              monto_exento: Number(movimientoExistente?.monto_exento || 0),
              monto_total: montoPago,
              estado: 'pagado',
              medio_pago: medioPagoInput || null,
              observaciones:
                observacionPago || movimientoExistente?.observaciones || null,
              created_by: currentUserId,
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (nuevoMovimientoError || !nuevoMovimiento?.id) {
          alert(
            nuevoMovimientoError?.message ||
              'No se pudo crear el ingreso asociado al pago.'
          )
          return
        }

        movimientoId = nuevoMovimiento.id
      }

      const { error: cxcUpdateError } = await supabase
        .from('cuentas_por_cobrar')
        .update({
          movimiento_id: movimientoId,
          monto_pagado: montoPago,
          saldo_pendiente: 0,
          estado: 'pagado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', cxcRow.id)

      if (cxcUpdateError) {
        alert(
          cxcUpdateError.message || 'No se pudo actualizar la cuenta por cobrar.'
        )
        return
      }

      await registrarBitacora({
        numeroFactura,
        cliente: detalleSeleccionado.cliente,
        accion: 'pago_registrado',
        detalle: `Pago registrado por ${formatCLP(
          montoPago
        )}. Medio de pago: ${formatMedioPago(
          medioPagoInput
        )}. Cuenta: ${getCuentaLabel(cuentaBancariaPagoId)}. Observación: ${
          observacionPago || '-'
        }`,
      })

      alert('Pago registrado correctamente.')

      setDetalleSeleccionado(null)
      setCuentaBancariaPagoId('')
      setObservacionPagoInput('')

      await Promise.all([loadCobranza(), loadPagosRegistrados()])
    } catch {
      alert('Ocurrió un error al registrar el pago.')
    } finally {
      setSavingPago(false)
    }
  }

  const handleRevertirPago = async (pago: PagoRegistrado) => {
    if (!empresaActivaId) return

    const motivo = window.prompt(
      `Ingresa el motivo de reversa para la factura ${pago.numero_factura}:`
    )
    const motivoLimpio = (motivo || '').trim()

    if (!motivoLimpio) {
      alert('Debes ingresar un motivo para revertir el pago.')
      return
    }

    const confirmar = window.confirm(
      `¿Deseas revertir el pago de la factura ${pago.numero_factura}?\n\nMotivo: ${motivoLimpio}\n\nLa factura volverá a estado pendiente y reaparecerá en cobranza.`
    )

    if (!confirmar) return

    try {
      setRevertingPagoId(pago.movimiento_id)

      const { data: cxcRow, error: cxcError } = await supabase
        .from('cuentas_por_cobrar')
        .select(
          'id,empresa_id,movimiento_id,cliente_id,fecha_emision,fecha_vencimiento,monto_total,monto_pagado,saldo_pendiente,estado,updated_at'
        )
        .eq('empresa_id', empresaActivaId)
        .eq('movimiento_id', pago.movimiento_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cxcError || !cxcRow) {
        alert('No se encontró la cuenta por cobrar asociada a ese pago.')
        return
      }

      const saldoRestaurado = Number(cxcRow.monto_total || pago.monto_total || 0)

      const { error: movimientoUpdateError } = await supabase
        .from('movimientos')
        .update({
          fecha: cxcRow.fecha_emision || pago.fecha_emision || pago.fecha_pago,
          fecha_vencimiento:
            cxcRow.fecha_vencimiento || pago.fecha_vencimiento || null,
          cuenta_bancaria_id: null,
          estado: 'pendiente',
          medio_pago: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pago.movimiento_id)

      if (movimientoUpdateError) {
        alert(
          movimientoUpdateError.message ||
            'No se pudo revertir el movimiento de ingreso.'
        )
        return
      }

      const { error: cxcUpdateError } = await supabase
        .from('cuentas_por_cobrar')
        .update({
          monto_pagado: 0,
          saldo_pendiente: saldoRestaurado,
          estado: 'pendiente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', cxcRow.id)

      if (cxcUpdateError) {
        alert(
          cxcUpdateError.message ||
            'No se pudo devolver la cuenta por cobrar a pendiente.'
        )
        return
      }

      const gestionActual = gestiones[pago.numero_factura]
      const ahoraIso = new Date().toISOString()
      const notaAutomatica = [
        'Pago revertido manualmente desde cobranza.',
        `Factura: ${pago.numero_factura}.`,
        `Monto restaurado: ${formatCLP(saldoRestaurado)}.`,
        `Motivo de reversa: ${motivoLimpio}.`,
        `Fecha registro: ${new Date(ahoraIso).toLocaleString('es-CL')}.`,
      ].join(' ')

      const observacionAnterior = gestionActual?.observacion?.trim()
      const observacionNueva = observacionAnterior
        ? `${observacionAnterior}\n\n${notaAutomatica}`
        : notaAutomatica

      const payloadGestion = {
        empresa_id: empresaActivaId,
        numero_factura: pago.numero_factura,
        estado_gestion: gestionActual?.estado_gestion || 'sin_gestion',
        fecha_contacto: gestionActual?.fecha_contacto || null,
        proximo_contacto: gestionActual?.proximo_contacto || null,
        observacion: observacionNueva,
        updated_at: ahoraIso,
      }

      const { error: gestionError } = await supabase
        .from('cobranza_gestiones')
        .upsert(payloadGestion, { onConflict: 'empresa_id,numero_factura' })

      if (!gestionError) {
        setGestiones((prev) => ({
          ...prev,
          [pago.numero_factura]: {
            estado_gestion: payloadGestion.estado_gestion,
            fecha_contacto: payloadGestion.fecha_contacto || '',
            proximo_contacto: payloadGestion.proximo_contacto || '',
            observacion: payloadGestion.observacion || '',
            updated_at: payloadGestion.updated_at,
          },
        }))
      }

      await registrarBitacora({
        numeroFactura: pago.numero_factura,
        cliente: pago.cliente,
        accion: 'pago_revertido',
        detalle: `Pago revertido por ${formatCLP(
          saldoRestaurado
        )}. Motivo: ${motivoLimpio}.`,
      })

      alert('Pago revertido correctamente.')

      await Promise.all([loadCobranza(), loadPagosRegistrados()])
    } catch {
      alert('Ocurrió un error al revertir el pago.')
    } finally {
      setRevertingPagoId('')
    }
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

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Sin gestión</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {sinGestionItems.length}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {formatCLP(
                  sinGestionItems.reduce(
                    (acc, item) => acc + Number(item.saldo_pendiente || 0),
                    0
                  )
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <p className="text-sm text-emerald-700">Compromiso de pago</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">
                {compromisoPagoItems.length}
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                {formatCLP(
                  compromisoPagoItems.reduce(
                    (acc, item) => acc + Number(item.saldo_pendiente || 0),
                    0
                  )
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
              <p className="text-sm text-orange-700">Próximo contacto vencido/hoy</p>
              <p className="mt-2 text-2xl font-semibold text-orange-800">
                {proximoContactoVencidoItems.length}
              </p>
              <p className="mt-1 text-sm text-orange-700">
                {formatCLP(
                  proximoContactoVencidoItems.reduce(
                    (acc, item) => acc + Number(item.saldo_pendiente || 0),
                    0
                  )
                )}
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
                  Estado documento
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
                  Gestión
                </label>
                <select
                  value={gestionFiltro}
                  onChange={(e) => setGestionFiltro(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                >
                  <option value="todos">Todas</option>
                  <option value="con_gestion">Solo con gestión</option>
                  <option value="sin_gestion">Solo sin gestión</option>
                  <option value="contactado">Contactado</option>
                  <option value="compromiso_pago">Compromiso de pago</option>
                  <option value="en_revision">En revisión</option>
                  <option value="sin_respuesta">Sin respuesta</option>
                  <option value="proximo_contacto_vencido">
                    Próximo contacto vencido/hoy
                  </option>
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
                onClick={() => setGestionFiltro('sin_gestion')}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Sin gestión
              </button>

              <button
                type="button"
                onClick={() => setGestionFiltro('compromiso_pago')}
                className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
              >
                Compromiso de pago
              </button>

              <button
                type="button"
                onClick={() => setGestionFiltro('proximo_contacto_vencido')}
                className="rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700"
              >
                Próx. contacto vencido/hoy
              </button>

              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setEstadoFiltro('todos')
                  setVistaRapida('todas')
                  setGestionFiltro('todos')
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Bitácora reciente
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Historial de acciones realizadas en cobranza.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                    <th className="px-4 py-3 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBitacora ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Cargando bitácora...
                      </td>
                    </tr>
                  ) : bitacora.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No hay acciones registradas todavía.
                      </td>
                    </tr>
                  ) : (
                    bitacora.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">
                          {formatFechaHora(item.created_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.numero_factura}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.cliente || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatAccionBitacora(item.accion)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.detalle || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Pagos registrados desde cobranza
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Desde aquí puedes revertir un pago y devolver la factura a pendiente.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Fecha pago</th>
                    <th className="px-4 py-3 font-medium">Medio pago</th>
                    <th className="px-4 py-3 font-medium">Cuenta bancaria</th>
                    <th className="px-4 py-3 font-medium text-right">Monto</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPagosRegistrados ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Cargando pagos registrados...
                      </td>
                    </tr>
                  ) : pagosRegistrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No hay pagos recientes registrados desde cobranza.
                      </td>
                    </tr>
                  ) : (
                    pagosRegistrados.map((pago) => (
                      <tr
                        key={pago.movimiento_id}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 text-slate-700">
                          {pago.numero_factura || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {pago.cliente || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatFecha(pago.fecha_pago)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatMedioPago(pago.medio_pago)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {getCuentaLabel(pago.cuenta_bancaria_id)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCLP(pago.monto_total)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void handleRevertirPago(pago)}
                            disabled={revertingPagoId === pago.movimiento_id}
                            className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60"
                          >
                            {revertingPagoId === pago.movimiento_id
                              ? 'Revirtiendo...'
                              : 'Revertir pago'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                              <button
                                type="button"
                                onClick={() => void handleEmailReminder(item)}
                                className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                              >
                                Email
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
                    label="Correo cliente"
                    value={getClienteEmail(detalleSeleccionado.cliente || '') || '-'}
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
                    Este seguimiento queda guardado en Supabase por empresa.
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
                      onClick={() => void handleSaveGestion()}
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
                      onClick={() => void handleEmailReminder(detalleSeleccionado)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      Enviar recordatorio
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

                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <h3 className="text-lg font-semibold text-emerald-900">
                    Registrar pago confirmado
                  </h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    Esto dejará la factura como pagada en cobranza y actualizará o
                    creará el ingreso en movimientos para que impacte bancos.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Fecha de pago
                      </label>
                      <input
                        type="date"
                        value={fechaPagoInput}
                        onChange={(e) => setFechaPagoInput(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Cuenta bancaria
                      </label>
                      <select
                        value={cuentaBancariaPagoId}
                        onChange={(e) => setCuentaBancariaPagoId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      >
                        <option value="">Seleccionar cuenta</option>
                        {cuentasBancarias.map((cuenta) => (
                          <option key={cuenta.id} value={cuenta.id}>
                            {cuenta.banco} - {cuenta.nombre_cuenta}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Medio de pago
                      </label>
                      <select
                        value={medioPagoInput}
                        onChange={(e) => setMedioPagoInput(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      >
                        <option value="transferencia">Transferencia</option>
                        <option value="deposito">Depósito</option>
                        <option value="cheque">Cheque</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Observación del pago
                    </label>
                    <textarea
                      value={observacionPagoInput}
                      onChange={(e) => setObservacionPagoInput(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Ejemplo: transferencia recibida, abono confirmado, número de referencia, etc."
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleRegistrarPago()}
                      disabled={savingPago}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {savingPago ? 'Registrando pago...' : 'Registrar pago'}
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