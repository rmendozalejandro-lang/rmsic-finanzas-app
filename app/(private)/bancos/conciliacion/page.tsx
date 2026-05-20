'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Banco = {
  id: string
  banco: string | null
  nombre_cuenta: string | null
  numero_cuenta: string | null
  tipo_cuenta: string | null
  moneda: string | null
}

type Sugerencia = {
  fila_banco_id: string
  empresa_id: string
  cuenta_bancaria_id: string
  fecha_banco: string | null
  descripcion_original: string
  documento_banco: string | null
  cargo: number | string
  abono: number | string
  tipo_banco: string
  monto_banco: number | string
  movimiento_id: string
  fecha_movimiento: string | null
  tipo_movimiento: string
  documento_movimiento: string | null
  descripcion_movimiento: string | null
  monto_total: number | string
  dias_diferencia: number
  puntaje: number
}

type FilaBanco = {
  id: string
  empresa_id: string
  cuenta_bancaria_id: string
  fecha: string | null
  descripcion_original: string
  numero_documento: string | null
  cargo: number | string
  abono: number | string
  estado: string
  movimiento_id: string | null
  conciliado_at: string | null
  conciliacion_tipo: string | null
  diferencia_conciliacion: number | string | null
}

type Movimiento = {
  id: string
  fecha: string | null
  tipo_movimiento: string
  numero_documento: string | null
  descripcion: string | null
  monto_total: number | string
  estado: string
  cuenta_bancaria_id: string | null
}

type RelacionNombre = {
  nombre: string | null
  rut?: string | null
}

type CategoriaMovimiento = {
  nombre: string | null
}

type MovimientoManual = {
  id: string
  fecha: string | null
  tipo_movimiento: 'ingreso' | 'egreso' | string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string | null
  monto_neto: number | string | null
  monto_iva: number | string | null
  monto_exento: number | string | null
  impuesto_especifico: number | string | null
  monto_total: number | string
  estado: string
  clientes?: RelacionNombre | RelacionNombre[] | null
  proveedores?: RelacionNombre | RelacionNombre[] | null
  categorias?: CategoriaMovimiento | CategoriaMovimiento[] | null
}


type PagoParcialResumen = {
  movimiento_id: string
  total_documento: number | string
  total_pagado_parcial: number | string
  saldo_pendiente: number | string
  cantidad_pagos: number | string
  estado_pago_calculado: string
}

type TransferenciaBancaria = {
  id: string
  empresa_id?: string
  fecha?: string | null
  monto?: number | string | null
  monto_total?: number | string | null
  valor?: number | string | null
  estado?: string | null
  descripcion?: string | null
  observacion?: string | null
  observaciones?: string | null
  cuenta_origen_id?: string | null
  cuenta_destino_id?: string | null
  cuenta_bancaria_origen_id?: string | null
  cuenta_bancaria_destino_id?: string | null
  origen_cuenta_bancaria_id?: string | null
  destino_cuenta_bancaria_id?: string | null
  created_at?: string | null
}

type Cliente = {
  id: string
  nombre: string
  rut: string | null
}

type Proveedor = {
  id: string
  nombre: string
  rut: string | null
}

type Categoria = {
  id: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  cuenta_contable_id: string | null
  requiere_centro_costo: boolean
}

type CentroCosto = {
  id: string
  nombre: string
  codigo: string | null
}

type FormTributario = {
  fila_id: string
  tipo_movimiento: 'ingreso' | 'egreso'
  monto_banco: string
  descripcion_banco: string
  tipo_documento:
    | 'factura'
    | 'boleta'
    | 'nota_credito'
    | 'nota_debito'
    | 'comprobante'
    | 'otro'
  numero_documento: string
  tercero_tipo: 'cliente' | 'proveedor' | 'otro'
  cliente_id: string
  proveedor_id: string
  categoria_id: string
  centro_costo_id: string
  monto_neto: string
  monto_iva: string
  monto_exento: string
  impuesto_especifico: string
  tratamiento_tributario:
    | 'afecto_iva'
    | 'iva'
    | 'exento'
    | 'no_afecto'
    | 'mixto'
    | 'combustible'
  descripcion: string
}

type FormSimple = {
  fila_id: string
  tipo_movimiento: 'ingreso' | 'egreso'
  monto_banco: string
  descripcion_banco: string
  tipo_documento: 'comprobante' | 'boleta' | 'otro'
  numero_documento: string
  categoria_id: string
  centro_costo_id: string
  descripcion: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const initialTributarioForm: FormTributario = {
  fila_id: '',
  tipo_movimiento: 'egreso',
  monto_banco: '0',
  descripcion_banco: '',
  tipo_documento: 'factura',
  numero_documento: '',
  tercero_tipo: 'proveedor',
  cliente_id: '',
  proveedor_id: '',
  categoria_id: '',
  centro_costo_id: '',
  monto_neto: '',
  monto_iva: '',
  monto_exento: '',
  impuesto_especifico: '',
  tratamiento_tributario: 'afecto_iva',
  descripcion: '',
}

const initialSimpleForm: FormSimple = {
  fila_id: '',
  tipo_movimiento: 'egreso',
  monto_banco: '0',
  descripcion_banco: '',
  tipo_documento: 'comprobante',
  numero_documento: '',
  categoria_id: '',
  centro_costo_id: '',
  descripcion: '',
}

function formatCLP(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value

  return `${day}-${month}-${year}`
}

function limpiarMonto(value: string) {
  return value.replace(/[^\d]/g, '')
}

function getRelacionNombre(
  value: RelacionNombre | RelacionNombre[] | CategoriaMovimiento | CategoriaMovimiento[] | null | undefined
) {
  const item = Array.isArray(value) ? value[0] : value

  return item?.nombre || ''
}

function getMontoFila(fila: FilaBanco | null) {
  if (!fila) return 0

  return Number(fila.cargo ?? 0) > 0
    ? Number(fila.cargo ?? 0)
    : Number(fila.abono ?? 0)
}

function getTransferenciaMonto(transferencia: TransferenciaBancaria) {
  return Number(
    transferencia.monto ?? transferencia.monto_total ?? transferencia.valor ?? 0
  )
}

function getTransferenciaCuentaOrigenId(transferencia: TransferenciaBancaria) {
  return (
    transferencia.cuenta_origen_id ||
    transferencia.cuenta_bancaria_origen_id ||
    transferencia.origen_cuenta_bancaria_id ||
    null
  )
}

function getTransferenciaCuentaDestinoId(transferencia: TransferenciaBancaria) {
  return (
    transferencia.cuenta_destino_id ||
    transferencia.cuenta_bancaria_destino_id ||
    transferencia.destino_cuenta_bancaria_id ||
    null
  )
}

function getTransferenciaDescripcion(transferencia: TransferenciaBancaria) {
  return (
    transferencia.descripcion ||
    transferencia.observacion ||
    transferencia.observaciones ||
    'Transferencia interna'
  )
}

function getDateDistanceDays(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return 9999

  const dateA = new Date(`${a.slice(0, 10)}T00:00:00`)
  const dateB = new Date(`${b.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
    return 9999
  }

  return Math.abs(
    Math.round((dateA.getTime() - dateB.getTime()) / 86_400_000)
  )
}

function getBancoLabel(banco: Banco | undefined) {
  if (!banco) return 'Cuenta no identificada'

  const nombreCuenta = banco.nombre_cuenta || 'Cuenta bancaria'
  const bancoNombre = banco.banco ? ` - ${banco.banco}` : ''
  const numeroCuenta = banco.numero_cuenta ? ` - ${banco.numero_cuenta}` : ''
  const tipoCuenta = banco.tipo_cuenta ? ` - ${banco.tipo_cuenta}` : ''
  const moneda = banco.moneda ? ` (${banco.moneda})` : ''

  return `${nombreCuenta}${bancoNombre}${numeroCuenta}${tipoCuenta}${moneda}`
}

export default function ConciliacionBancariaPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [bancos, setBancos] = useState<Banco[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
  const [cuentaFiltro, setCuentaFiltro] = useState('')
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [pendientes, setPendientes] = useState<FilaBanco[]>([])
  const [conciliadas, setConciliadas] = useState<FilaBanco[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [pendientesCount, setPendientesCount] = useState(0)
  const [conciliadasCount, setConciliadasCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showSimpleForm, setShowSimpleForm] = useState(false)
  const [savingSimple, setSavingSimple] = useState(false)
  const [simpleError, setSimpleError] = useState('')
  const [simpleForm, setSimpleForm] =
    useState<FormSimple>(initialSimpleForm)

  const [showTributarioForm, setShowTributarioForm] = useState(false)
  const [savingTributario, setSavingTributario] = useState(false)
  const [tributarioError, setTributarioError] = useState('')
  const [tributarioForm, setTributarioForm] =
    useState<FormTributario>(initialTributarioForm)

  const [showConciliarManualForm, setShowConciliarManualForm] = useState(false)
  const [manualFila, setManualFila] = useState<FilaBanco | null>(null)
  const [manualBusqueda, setManualBusqueda] = useState('')
  const [manualTipo, setManualTipo] = useState<
    'todos' | 'ingreso' | 'egreso'
  >('todos')
  const [manualResultados, setManualResultados] = useState<MovimientoManual[]>(
    []
  )
  const [manualMovimientoId, setManualMovimientoId] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState('')

  const [showConciliarMultipleForm, setShowConciliarMultipleForm] =
    useState(false)
  const [multipleFila, setMultipleFila] = useState<FilaBanco | null>(null)
  const [multipleBusqueda, setMultipleBusqueda] = useState('')
  const [multipleTipo, setMultipleTipo] = useState<
    'todos' | 'ingreso' | 'egreso'
  >('todos')
  const [multipleResultados, setMultipleResultados] = useState<
    MovimientoManual[]
  >([])
  const [multipleMovimientoIds, setMultipleMovimientoIds] = useState<
    string[]
  >([])
  const [multipleLoading, setMultipleLoading] = useState(false)
  const [multipleSaving, setMultipleSaving] = useState(false)
  const [multipleError, setMultipleError] = useState('')

  const [showConciliarParcialForm, setShowConciliarParcialForm] =
    useState(false)
  const [parcialFila, setParcialFila] = useState<FilaBanco | null>(null)
  const [parcialBusqueda, setParcialBusqueda] = useState('')
  const [parcialTipo, setParcialTipo] = useState<
    'todos' | 'ingreso' | 'egreso'
  >('todos')
  const [parcialResultados, setParcialResultados] = useState<
    MovimientoManual[]
  >([])
  const [parcialMovimientoId, setParcialMovimientoId] = useState('')
  const [parcialResumenPorMovimiento, setParcialResumenPorMovimiento] =
    useState<Record<string, PagoParcialResumen>>({})
  const [parcialLoading, setParcialLoading] = useState(false)
  const [parcialSaving, setParcialSaving] = useState(false)
  const [parcialError, setParcialError] = useState('')

  const [showTransferenciaForm, setShowTransferenciaForm] = useState(false)
  const [transferenciaFila, setTransferenciaFila] = useState<FilaBanco | null>(null)
  const [transferenciaBusqueda, setTransferenciaBusqueda] = useState('')
  const [transferenciaResultados, setTransferenciaResultados] = useState<
    TransferenciaBancaria[]
  >([])
  const [transferenciaId, setTransferenciaId] = useState('')
  const [transferenciaLoading, setTransferenciaLoading] = useState(false)
  const [transferenciaSaving, setTransferenciaSaving] = useState(false)
  const [transferenciaError, setTransferenciaError] = useState('')

  const cargarEmpresaActiva = useCallback(() => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)
  }, [])

  const bancosPorId = useMemo(() => {
    const map = new Map<string, Banco>()

    for (const banco of bancos) {
      map.set(banco.id, banco)
    }

    return map
  }, [bancos])

  const movimientosPorId = useMemo(() => {
    const map = new Map<string, Movimiento>()

    for (const movimiento of movimientos) {
      map.set(movimiento.id, movimiento)
    }

    return map
  }, [movimientos])

  const categoriasFiltradas = useMemo(() => {
    return categorias.filter(
      (categoria) => categoria.tipo === tributarioForm.tipo_movimiento
    )
  }, [categorias, tributarioForm.tipo_movimiento])

  const categoriaSeleccionada = useMemo(() => {
    return categorias.find(
      (categoria) => categoria.id === tributarioForm.categoria_id
    )
  }, [categorias, tributarioForm.categoria_id])

  const categoriasSimpleFiltradas = useMemo(() => {
    return categorias.filter(
      (categoria) => categoria.tipo === simpleForm.tipo_movimiento
    )
  }, [categorias, simpleForm.tipo_movimiento])

  const categoriaSimpleSeleccionada = useMemo(() => {
    return categorias.find(
      (categoria) => categoria.id === simpleForm.categoria_id
    )
  }, [categorias, simpleForm.categoria_id])

  const totalSimple = Number(simpleForm.monto_banco || 0)

  const totalTributario = useMemo(() => {
    return (
      Number(limpiarMonto(tributarioForm.monto_neto) || 0) +
      Number(limpiarMonto(tributarioForm.monto_iva) || 0) +
      Number(limpiarMonto(tributarioForm.monto_exento) || 0) +
      Number(limpiarMonto(tributarioForm.impuesto_especifico) || 0)
    )
  }, [
    tributarioForm.monto_neto,
    tributarioForm.monto_iva,
    tributarioForm.monto_exento,
    tributarioForm.impuesto_especifico,
  ])

  const totalBancoTributario = Number(tributarioForm.monto_banco || 0)
  const diferenciaTributaria = totalTributario - totalBancoTributario

  const cargarDatos = useCallback(async () => {
    if (!empresaActivaId) {
      setBancos([])
      setClientes([])
      setProveedores([])
      setCategorias([])
      setCentrosCosto([])
      setSugerencias([])
      setPendientes([])
      setConciliadas([])
      setMovimientos([])
      setPendientesCount(0)
      setConciliadasCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const bancosResp = await supabase
      .from('cuentas_bancarias')
      .select(`
        id,
        banco,
        nombre_cuenta,
        numero_cuenta,
        tipo_cuenta,
        moneda
      `)
      .eq('empresa_id', empresaActivaId)
      .eq('activa', true)
      .is('deleted_at', null)
      .order('nombre_cuenta', { ascending: true })

    if (bancosResp.error) {
      setError(`Error al cargar cuentas bancarias: ${bancosResp.error.message}`)
      setLoading(false)
      return
    }

    setBancos((bancosResp.data ?? []) as Banco[])

    const clientesResp = await supabase
      .from('clientes')
      .select('id, nombre, rut')
      .eq('empresa_id', empresaActivaId)
      .eq('activo', true)
      .is('deleted_at', null)
      .order('nombre', { ascending: true })

    if (clientesResp.error) {
      setError(`Error al cargar clientes: ${clientesResp.error.message}`)
      setLoading(false)
      return
    }

    setClientes((clientesResp.data ?? []) as Cliente[])

    const proveedoresResp = await supabase
      .from('proveedores')
      .select('id, nombre, rut')
      .eq('empresa_id', empresaActivaId)
      .eq('activo', true)
      .is('deleted_at', null)
      .order('nombre', { ascending: true })

    if (proveedoresResp.error) {
      setError(`Error al cargar proveedores: ${proveedoresResp.error.message}`)
      setLoading(false)
      return
    }

    setProveedores((proveedoresResp.data ?? []) as Proveedor[])

    const categoriasResp = await supabase
      .from('categorias')
      .select(`
        id,
        nombre,
        tipo,
        cuenta_contable_id,
        requiere_centro_costo
      `)
      .eq('empresa_id', empresaActivaId)
      .eq('activa', true)
      .is('deleted_at', null)
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })

    if (categoriasResp.error) {
      setError(`Error al cargar categorías: ${categoriasResp.error.message}`)
      setLoading(false)
      return
    }

    setCategorias((categoriasResp.data ?? []) as Categoria[])

    const centrosResp = await supabase
      .from('centros_costo')
      .select('id, nombre, codigo')
      .eq('empresa_id', empresaActivaId)
      .eq('activo', true)
      .is('deleted_at', null)
      .order('orden', { ascending: true })

    if (centrosResp.error) {
      setError(`Error al cargar centros de costo: ${centrosResp.error.message}`)
      setLoading(false)
      return
    }

    setCentrosCosto((centrosResp.data ?? []) as CentroCosto[])

    let sugerenciasQuery = supabase
      .from('v_conciliacion_bancaria_sugerencias')
      .select(`
        fila_banco_id,
        empresa_id,
        cuenta_bancaria_id,
        fecha_banco,
        descripcion_original,
        documento_banco,
        cargo,
        abono,
        tipo_banco,
        monto_banco,
        movimiento_id,
        fecha_movimiento,
        tipo_movimiento,
        documento_movimiento,
        descripcion_movimiento,
        monto_total,
        dias_diferencia,
        puntaje
      `)
      .eq('empresa_id', empresaActivaId)
      .order('puntaje', { ascending: false })
      .order('dias_diferencia', { ascending: true })
      .order('fecha_banco', { ascending: false })
      .limit(30)

    if (cuentaFiltro) {
      sugerenciasQuery = sugerenciasQuery.eq('cuenta_bancaria_id', cuentaFiltro)
    }

    const sugerenciasResp = await sugerenciasQuery

    if (sugerenciasResp.error) {
      setError(`Error al cargar sugerencias: ${sugerenciasResp.error.message}`)
      setLoading(false)
      return
    }

    setSugerencias((sugerenciasResp.data ?? []) as Sugerencia[])

    let pendientesQuery = supabase
  .from('banco_importacion_filas')
  .select(
    `
    id,
    empresa_id,
    cuenta_bancaria_id,
    fecha,
    descripcion_original,
    numero_documento,
    cargo,
    abono,
    estado,
    movimiento_id,
    transferencia_bancaria_id,
    conciliado_at,
    conciliacion_tipo,
    diferencia_conciliacion
  `,
    { count: 'exact' }
  )
  .eq('empresa_id', empresaActivaId)
  .eq('estado', 'pendiente')
  .is('movimiento_id', null)
  .is('transferencia_bancaria_id', null)
  .eq('es_duplicado', false)
  .eq('tipo_registro', 'movimiento')
  .order('fecha', { ascending: false })
  .limit(30)

    if (cuentaFiltro) {
      pendientesQuery = pendientesQuery.eq('cuenta_bancaria_id', cuentaFiltro)
    }

    const pendientesResp = await pendientesQuery

    if (pendientesResp.error) {
      setError(`Error al cargar pendientes: ${pendientesResp.error.message}`)
      setLoading(false)
      return
    }

    setPendientes((pendientesResp.data ?? []) as FilaBanco[])
    setPendientesCount(pendientesResp.count ?? 0)

    let conciliadasQuery = supabase
      .from('banco_importacion_filas')
      .select(
        `
        id,
        empresa_id,
        cuenta_bancaria_id,
        fecha,
        descripcion_original,
        numero_documento,
        cargo,
        abono,
        estado,
        movimiento_id,
        conciliado_at,
        conciliacion_tipo,
        diferencia_conciliacion
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaActivaId)
      .eq('estado', 'conciliada')
      .not('movimiento_id', 'is', null)
      .order('conciliado_at', { ascending: false })
      .limit(20)

    if (cuentaFiltro) {
      conciliadasQuery = conciliadasQuery.eq('cuenta_bancaria_id', cuentaFiltro)
    }

    const conciliadasResp = await conciliadasQuery

    if (conciliadasResp.error) {
      setError(`Error al cargar conciliadas: ${conciliadasResp.error.message}`)
      setLoading(false)
      return
    }

    const conciliadasData = (conciliadasResp.data ?? []) as FilaBanco[]
    setConciliadas(conciliadasData)
    setConciliadasCount(conciliadasResp.count ?? 0)

    const movimientosIds = conciliadasData
      .map((fila) => fila.movimiento_id)
      .filter((id): id is string => Boolean(id))

    if (movimientosIds.length > 0) {
      const movimientosResp = await supabase
        .from('movimientos')
        .select(`
          id,
          fecha,
          tipo_movimiento,
          numero_documento,
          descripcion,
          monto_total,
          estado,
          cuenta_bancaria_id
        `)
        .in('id', movimientosIds)

      if (movimientosResp.error) {
        setError(`Error al cargar movimientos: ${movimientosResp.error.message}`)
        setLoading(false)
        return
      }

      setMovimientos((movimientosResp.data ?? []) as Movimiento[])
    } else {
      setMovimientos([])
    }

    setLoading(false)
  }, [empresaActivaId, cuentaFiltro])

  useEffect(() => {
    cargarEmpresaActiva()

    window.addEventListener('empresa-activa-cambiada', cargarEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', cargarEmpresaActiva)
    }
  }, [cargarEmpresaActiva])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const conciliarSugerencia = async (sugerencia: Sugerencia) => {
    const confirmar = window.confirm(
      `¿Conciliar esta sugerencia por ${formatCLP(sugerencia.monto_banco)}?`
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'conciliar_movimiento_bancario',
      {
        p_fila_id: sugerencia.fila_banco_id,
        p_movimiento_id: sugerencia.movimiento_id,
        p_observacion: 'Conciliación manual desde pantalla de conciliación',
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    setSuccess('Movimiento conciliado correctamente.')
    await cargarDatos()
    setProcessing(false)
  }

  const conciliarExactas = async () => {
    const confirmar = window.confirm(
      '¿Conciliar automáticamente las coincidencias exactas? Solo se tomarán sugerencias no ambiguas con misma fecha, monto, tipo y cuenta bancaria.'
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { data, error: rpcError } = await supabase.rpc(
      'conciliar_sugerencias_bancarias_exactas',
      {
        p_empresa_id: empresaActivaId || null,
        p_cuenta_bancaria_id: cuentaFiltro || null,
        p_limite: 50,
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    const conciliadasOk = (data ?? []).filter(
      (item: { resultado: string }) => item.resultado === 'conciliada'
    ).length

    setSuccess(
      `Conciliación automática finalizada. Registros conciliados: ${conciliadasOk}.`
    )
    await cargarDatos()
    setProcessing(false)
  }

  const reversarConciliacion = async (fila: FilaBanco) => {
    const confirmar = window.confirm(
      '¿Reversar esta conciliación? La línea bancaria volverá a estado pendiente.'
    )

    if (!confirmar) return

    setProcessing(true)
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'reversar_conciliacion_bancaria',
      {
        p_fila_id: fila.id,
        p_observacion: 'Conciliación reversada desde pantalla de conciliación',
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setProcessing(false)
      return
    }

    setSuccess('Conciliación reversada correctamente.')
    await cargarDatos()
    setProcessing(false)
  }

  const crearMovimientoSimple = (fila: FilaBanco) => {
    const esEgreso = Number(fila.cargo ?? 0) > 0
    const montoBanco = getMontoFila(fila)

    setSimpleForm({
      ...initialSimpleForm,
      fila_id: fila.id,
      tipo_movimiento: esEgreso ? 'egreso' : 'ingreso',
      monto_banco: String(montoBanco),
      descripcion_banco: fila.descripcion_original,
      numero_documento: fila.numero_documento || '',
      descripcion: fila.descripcion_original,
    })
    setSimpleError('')
    setShowSimpleForm(true)
  }

  const cerrarFormularioSimple = () => {
    if (savingSimple) return

    setShowSimpleForm(false)
    setSimpleError('')
    setSimpleForm(initialSimpleForm)
  }

  const handleSimpleChange = (field: keyof FormSimple, value: string) => {
    setSimpleForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'categoria_id') {
        next.centro_costo_id = ''
      }

      return next
    })
  }

  const guardarMovimientoSimple = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!simpleForm.fila_id) {
      setSimpleError('No se encontró la línea de cartola.')
      return
    }

    if (!simpleForm.categoria_id) {
      setSimpleError('Debes seleccionar una categoría contable.')
      return
    }

    if (!categoriaSimpleSeleccionada?.cuenta_contable_id) {
      setSimpleError(
        'La categoría seleccionada no tiene cuenta contable asociada. Selecciona otra categoría o corrige la categoría antes de crear el movimiento.'
      )
      return
    }

    if (
      categoriaSimpleSeleccionada.requiere_centro_costo &&
      !simpleForm.centro_costo_id
    ) {
      setSimpleError('La categoría seleccionada requiere centro de costo.')
      return
    }

    if (!simpleForm.descripcion.trim()) {
      setSimpleError('Debes ingresar una descripción.')
      return
    }

    const confirmar = window.confirm(
      `¿Crear movimiento simple no afecto por ${formatCLP(
        totalSimple
      )} y conciliarlo automáticamente?`
    )

    if (!confirmar) return

    setSavingSimple(true)
    setSimpleError('')
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'crear_movimiento_tributario_desde_fila_bancaria',
      {
        p_fila_id: simpleForm.fila_id,
        p_tipo_documento: simpleForm.tipo_documento,
        p_numero_documento: simpleForm.numero_documento,
        p_categoria_id: simpleForm.categoria_id,
        p_tercero_tipo: 'otro',
        p_cliente_id: null,
        p_proveedor_id: null,
        p_monto_neto: 0,
        p_monto_iva: 0,
        p_monto_exento: totalSimple,
        p_impuesto_especifico: 0,
        p_tratamiento_tributario: 'no_afecto',
        p_descripcion: simpleForm.descripcion,
        p_centro_costo_id: simpleForm.centro_costo_id || null,
      }
    )

    if (rpcError) {
      setSimpleError(rpcError.message)
      setSavingSimple(false)
      return
    }

    setSuccess(
      'Movimiento simple creado, conciliado y enviado a asiento borrador correctamente.'
    )
    await cargarDatos()

    setSavingSimple(false)
    cerrarFormularioSimple()
  }

  const cargarMovimientosManual = async (
    fila: FilaBanco | null = manualFila,
    busqueda: string = manualBusqueda,
    tipo: 'todos' | 'ingreso' | 'egreso' = manualTipo
  ) => {
    if (!empresaActivaId || !fila) return

    setManualLoading(true)
    setManualError('')
    setManualMovimientoId('')

    const texto = busqueda.trim().toLowerCase()
    const montoBuscado = Number(limpiarMonto(busqueda) || 0)

    let query = supabase
      .from('movimientos')
      .select(`
        id,
        fecha,
        tipo_movimiento,
        tipo_documento,
        numero_documento,
        descripcion,
        monto_neto,
        monto_iva,
        monto_exento,
        impuesto_especifico,
        monto_total,
        estado,
        clientes:cliente_id (
          nombre,
          rut
        ),
        proveedores:proveedor_id (
          nombre,
          rut
        ),
        categorias:categoria_id (
          nombre
        )
      `)
      .eq('empresa_id', empresaActivaId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .limit(montoBuscado > 0 ? 80 : 300)

    if (tipo !== 'todos') {
      query = query.eq('tipo_movimiento', tipo)
    }

    if (montoBuscado > 0) {
      query = query.or(
        `monto_total.eq.${montoBuscado},monto_neto.eq.${montoBuscado},monto_iva.eq.${montoBuscado},monto_exento.eq.${montoBuscado},impuesto_especifico.eq.${montoBuscado}`
      )
    }

    const { data, error: queryError } = await query

    if (queryError) {
      setManualError(`Error al buscar movimientos: ${queryError.message}`)
      setManualResultados([])
      setManualLoading(false)
      return
    }

    let resultados = ((data ?? []) as unknown as MovimientoManual[]).filter(
      (movimiento) => {
        if (!texto || montoBuscado > 0) return true

        const campos = [
          movimiento.tipo_movimiento,
          movimiento.tipo_documento,
          movimiento.numero_documento,
          movimiento.descripcion,
          movimiento.estado,
          getRelacionNombre(movimiento.clientes),
          getRelacionNombre(movimiento.proveedores),
          getRelacionNombre(movimiento.categorias),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return campos.includes(texto)
      }
    )

    resultados = resultados.sort((a, b) => {
      const diffA = Math.abs(Number(a.monto_total ?? 0) - getMontoFila(fila))
      const diffB = Math.abs(Number(b.monto_total ?? 0) - getMontoFila(fila))

      if (diffA !== diffB) return diffA - diffB

      return String(b.fecha || '').localeCompare(String(a.fecha || ''))
    })

    setManualResultados(resultados)
    setManualMovimientoId(resultados[0]?.id || '')
    setManualLoading(false)
  }

  const abrirConciliacionManual = async (fila: FilaBanco) => {
    const monto = getMontoFila(fila)
    const tipo = Number(fila.cargo ?? 0) > 0 ? 'egreso' : 'ingreso'

    setManualFila(fila)
    setManualBusqueda(String(Math.round(monto)))
    setManualTipo(tipo)
    setManualResultados([])
    setManualMovimientoId('')
    setManualError('')
    setShowConciliarManualForm(true)

    await cargarMovimientosManual(fila, String(Math.round(monto)), tipo)
  }

  const cerrarConciliacionManual = () => {
    if (manualSaving) return

    setShowConciliarManualForm(false)
    setManualFila(null)
    setManualBusqueda('')
    setManualTipo('todos')
    setManualResultados([])
    setManualMovimientoId('')
    setManualError('')
  }

  const conciliarManual = async () => {
    if (!manualFila) {
      setManualError('No se encontró la línea de cartola seleccionada.')
      return
    }

    const movimiento = manualResultados.find(
      (item) => item.id === manualMovimientoId
    )

    if (!movimiento) {
      setManualError('Debes seleccionar un movimiento para conciliar.')
      return
    }

    const diferencia =
      getMontoFila(manualFila) - Number(movimiento.monto_total ?? 0)

    if (Math.abs(diferencia) > 0.49) {
      setManualError(
        `El monto seleccionado no coincide con la cartola. Diferencia: ${formatCLP(
          diferencia
        )}`
      )
      return
    }

    const confirmar = window.confirm(
      `¿Conciliar esta línea de cartola por ${formatCLP(
        getMontoFila(manualFila)
      )} con el movimiento seleccionado?`
    )

    if (!confirmar) return

    setManualSaving(true)
    setManualError('')
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'conciliar_movimiento_bancario',
      {
        p_fila_id: manualFila.id,
        p_movimiento_id: movimiento.id,
        p_observacion: `Conciliación manual desde app: ${
          movimiento.tipo_movimiento
        } ${movimiento.tipo_documento || ''} ${
          movimiento.numero_documento || ''
        }`.trim(),
      }
    )

    if (rpcError) {
      setManualError(rpcError.message)
      setManualSaving(false)
      return
    }

    setSuccess('Movimiento conciliado manualmente correctamente.')
    await cargarDatos()

    setManualSaving(false)
    cerrarConciliacionManual()
  }

  const cargarMovimientosMultiple = async (
    fila: FilaBanco | null = multipleFila,
    busqueda: string = multipleBusqueda,
    tipo: 'todos' | 'ingreso' | 'egreso' = multipleTipo
  ) => {
    if (!empresaActivaId || !fila) return

    setMultipleLoading(true)
    setMultipleError('')

    const texto = busqueda.trim().toLowerCase()
    const montoBuscado = Number(limpiarMonto(busqueda) || 0)

    let query = supabase
      .from('movimientos')
      .select(`
        id,
        fecha,
        tipo_movimiento,
        tipo_documento,
        numero_documento,
        descripcion,
        monto_neto,
        monto_iva,
        monto_exento,
        impuesto_especifico,
        monto_total,
        estado,
        clientes:cliente_id (
          nombre,
          rut
        ),
        proveedores:proveedor_id (
          nombre,
          rut
        ),
        categorias:categoria_id (
          nombre
        )
      `)
      .eq('empresa_id', empresaActivaId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .limit(montoBuscado > 0 ? 80 : 300)

    if (tipo !== 'todos') {
      query = query.eq('tipo_movimiento', tipo)
    }

    if (montoBuscado > 0) {
      query = query.or(
        `monto_total.eq.${montoBuscado},monto_neto.eq.${montoBuscado},monto_iva.eq.${montoBuscado},monto_exento.eq.${montoBuscado},impuesto_especifico.eq.${montoBuscado}`
      )
    }

    const { data, error: queryError } = await query

    if (queryError) {
      setMultipleError(`Error al buscar movimientos: ${queryError.message}`)
      setMultipleResultados([])
      setMultipleLoading(false)
      return
    }

    let resultados = ((data ?? []) as unknown as MovimientoManual[]).filter(
      (movimiento) => {
        if (!texto || montoBuscado > 0) return true

        const campos = [
          movimiento.tipo_movimiento,
          movimiento.tipo_documento,
          movimiento.numero_documento,
          movimiento.descripcion,
          movimiento.estado,
          getRelacionNombre(movimiento.clientes),
          getRelacionNombre(movimiento.proveedores),
          getRelacionNombre(movimiento.categorias),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return campos.includes(texto)
      }
    )

    resultados = resultados.sort((a, b) => {
      return String(b.fecha || '').localeCompare(String(a.fecha || ''))
    })

    setMultipleResultados(resultados)
    setMultipleLoading(false)
  }

  const abrirConciliacionMultiple = async (fila: FilaBanco) => {
    const tipo = Number(fila.cargo ?? 0) > 0 ? 'egreso' : 'ingreso'

    setMultipleFila(fila)
    setMultipleBusqueda('')
    setMultipleTipo(tipo)
    setMultipleResultados([])
    setMultipleMovimientoIds([])
    setMultipleError('')
    setShowConciliarMultipleForm(true)

    await cargarMovimientosMultiple(fila, '', tipo)
  }

  const cerrarConciliacionMultiple = () => {
    if (multipleSaving) return

    setShowConciliarMultipleForm(false)
    setMultipleFila(null)
    setMultipleBusqueda('')
    setMultipleTipo('todos')
    setMultipleResultados([])
    setMultipleMovimientoIds([])
    setMultipleError('')
  }

  const toggleMovimientoMultiple = (movimientoId: string) => {
    setMultipleMovimientoIds((current) =>
      current.includes(movimientoId)
        ? current.filter((id) => id !== movimientoId)
        : [...current, movimientoId]
    )
  }

  const getTotalMultipleSeleccionado = () => {
    return multipleResultados
      .filter((movimiento) => multipleMovimientoIds.includes(movimiento.id))
      .reduce(
        (total, movimiento) => total + Number(movimiento.monto_total ?? 0),
        0
      )
  }

  const conciliarMultiple = async () => {
    if (!multipleFila) {
      setMultipleError('No se encontró la línea de cartola seleccionada.')
      return
    }

    if (multipleMovimientoIds.length < 2) {
      setMultipleError(
        'Selecciona al menos dos movimientos. Para uno solo usa Conciliar manual.'
      )
      return
    }

    const totalSeleccionado = getTotalMultipleSeleccionado()
    const montoBanco = getMontoFila(multipleFila)
    const diferencia = totalSeleccionado - montoBanco

    if (Math.abs(diferencia) > 0.49) {
      setMultipleError(
        `La suma seleccionada no coincide con la cartola. Diferencia: ${formatCLP(
          diferencia
        )}`
      )
      return
    }

    const confirmar = window.confirm(
      `¿Conciliar esta línea de cartola por ${formatCLP(
        montoBanco
      )} con ${multipleMovimientoIds.length} movimientos seleccionados?`
    )

    if (!confirmar) return

    setMultipleSaving(true)
    setMultipleError('')
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'conciliar_multiples_movimientos_bancarios',
      {
        p_fila_id: multipleFila.id,
        p_movimiento_ids: multipleMovimientoIds,
        p_observacion: 'Conciliación múltiple desde app',
      }
    )

    if (rpcError) {
      setMultipleError(rpcError.message)
      setMultipleSaving(false)
      return
    }

    setSuccess('Conciliación múltiple realizada correctamente.')
    await cargarDatos()

    setMultipleSaving(false)
    cerrarConciliacionMultiple()
  }

  const cargarMovimientosParcial = async (
    fila: FilaBanco | null = parcialFila,
    busqueda: string = parcialBusqueda,
    tipo: 'todos' | 'ingreso' | 'egreso' = parcialTipo
  ) => {
    if (!empresaActivaId || !fila) return

    setParcialLoading(true)
    setParcialError('')
    setParcialMovimientoId('')

    const texto = busqueda.trim().toLowerCase()
    const montoBuscado = Number(limpiarMonto(busqueda) || 0)
    const montoBanco = getMontoFila(fila)

    let query = supabase
      .from('movimientos')
      .select(`
        id,
        fecha,
        tipo_movimiento,
        tipo_documento,
        numero_documento,
        descripcion,
        monto_neto,
        monto_iva,
        monto_exento,
        impuesto_especifico,
        monto_total,
        estado,
        clientes:cliente_id (
          nombre,
          rut
        ),
        proveedores:proveedor_id (
          nombre,
          rut
        ),
        categorias:categoria_id (
          nombre
        )
      `)
      .eq('empresa_id', empresaActivaId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .limit(montoBuscado > 0 ? 120 : 300)

    if (tipo !== 'todos') {
      query = query.eq('tipo_movimiento', tipo)
    }

    if (montoBuscado > 0) {
      query = query.or(
        `monto_total.eq.${montoBuscado},numero_documento.ilike.%${montoBuscado}%,descripcion.ilike.%${montoBuscado}%`
      )
    }

    const { data, error: queryError } = await query

    if (queryError) {
      setParcialError(`Error al buscar movimientos: ${queryError.message}`)
      setParcialResultados([])
      setParcialResumenPorMovimiento({})
      setParcialLoading(false)
      return
    }

    const movimientosBase = (data ?? []) as unknown as MovimientoManual[]
    const ids = movimientosBase.map((movimiento) => movimiento.id)

    let resumenMap: Record<string, PagoParcialResumen> = {}

    if (ids.length > 0) {
      const { data: resumenData, error: resumenError } = await supabase
        .from('v_conciliacion_pago_parcial_resumen')
        .select(`
          movimiento_id,
          total_documento,
          total_pagado_parcial,
          saldo_pendiente,
          cantidad_pagos,
          estado_pago_calculado
        `)
        .in('movimiento_id', ids)

      if (resumenError) {
        setParcialError(
          `Error al cargar saldos parciales: ${resumenError.message}`
        )
        setParcialResultados([])
        setParcialResumenPorMovimiento({})
        setParcialLoading(false)
        return
      }

      resumenMap = Object.fromEntries(
        ((resumenData ?? []) as PagoParcialResumen[]).map((item) => [
          item.movimiento_id,
          item,
        ])
      )
    }

    let resultados = movimientosBase.filter((movimiento) => {
      const resumen = resumenMap[movimiento.id]
      const saldoPendiente = Number(
        resumen?.saldo_pendiente ?? movimiento.monto_total ?? 0
      )

      if (saldoPendiente <= 0.49) return false

      if (!texto || montoBuscado > 0) return true

      const campos = [
        movimiento.tipo_movimiento,
        movimiento.tipo_documento,
        movimiento.numero_documento,
        movimiento.descripcion,
        movimiento.estado,
        getRelacionNombre(movimiento.clientes),
        getRelacionNombre(movimiento.proveedores),
        getRelacionNombre(movimiento.categorias),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return campos.includes(texto)
    })

    resultados = resultados.sort((a, b) => {
      const resumenA = resumenMap[a.id]
      const resumenB = resumenMap[b.id]
      const saldoA = Number(resumenA?.saldo_pendiente ?? a.monto_total ?? 0)
      const saldoB = Number(resumenB?.saldo_pendiente ?? b.monto_total ?? 0)
      const diffA = Math.abs(saldoA - montoBanco)
      const diffB = Math.abs(saldoB - montoBanco)

      if (diffA !== diffB) return diffA - diffB

      return String(b.fecha || '').localeCompare(String(a.fecha || ''))
    })

    const enrichedResumenMap = { ...resumenMap }

    for (const movimiento of resultados) {
      if (!enrichedResumenMap[movimiento.id]) {
        enrichedResumenMap[movimiento.id] = {
          movimiento_id: movimiento.id,
          total_documento: movimiento.monto_total,
          total_pagado_parcial: 0,
          saldo_pendiente: movimiento.monto_total,
          cantidad_pagos: 0,
          estado_pago_calculado: 'sin_pagos',
        }
      }
    }

    setParcialResumenPorMovimiento(enrichedResumenMap)
    setParcialResultados(resultados)
    setParcialMovimientoId(resultados[0]?.id || '')
    setParcialLoading(false)
  }

  const abrirConciliacionParcial = async (fila: FilaBanco) => {
    const tipo = Number(fila.cargo ?? 0) > 0 ? 'egreso' : 'ingreso'

    setParcialFila(fila)
    setParcialBusqueda('')
    setParcialTipo(tipo)
    setParcialResultados([])
    setParcialMovimientoId('')
    setParcialResumenPorMovimiento({})
    setParcialError('')
    setShowConciliarParcialForm(true)

    await cargarMovimientosParcial(fila, '', tipo)
  }

  const cerrarConciliacionParcial = () => {
    if (parcialSaving) return

    setShowConciliarParcialForm(false)
    setParcialFila(null)
    setParcialBusqueda('')
    setParcialTipo('todos')
    setParcialResultados([])
    setParcialMovimientoId('')
    setParcialResumenPorMovimiento({})
    setParcialError('')
  }

  const getResumenParcialMovimiento = (movimiento: MovimientoManual | undefined) => {
    if (!movimiento) return null

    return (
      parcialResumenPorMovimiento[movimiento.id] || {
        movimiento_id: movimiento.id,
        total_documento: movimiento.monto_total,
        total_pagado_parcial: 0,
        saldo_pendiente: movimiento.monto_total,
        cantidad_pagos: 0,
        estado_pago_calculado: 'sin_pagos',
      }
    )
  }

  const getMovimientoParcialSeleccionado = () => {
    return parcialResultados.find((item) => item.id === parcialMovimientoId)
  }

  const conciliarParcial = async () => {
    if (!parcialFila) {
      setParcialError('No se encontró la línea de cartola seleccionada.')
      return
    }

    const movimiento = getMovimientoParcialSeleccionado()

    if (!movimiento) {
      setParcialError('Debes seleccionar una factura o movimiento.')
      return
    }

    const resumen = getResumenParcialMovimiento(movimiento)
    const montoBanco = getMontoFila(parcialFila)
    const saldoPendiente = Number(resumen?.saldo_pendiente ?? 0)

    if (montoBanco <= 0) {
      setParcialError('La línea bancaria no tiene monto válido.')
      return
    }

    if (montoBanco > saldoPendiente + 0.49) {
      setParcialError(
        `El pago excede el saldo pendiente. Saldo: ${formatCLP(
          saldoPendiente
        )}, pago banco: ${formatCLP(montoBanco)}.`
      )
      return
    }

    const saldoDespues = Math.max(saldoPendiente - montoBanco, 0)

    const confirmar = window.confirm(
      `¿Aplicar este pago parcial por ${formatCLP(
        montoBanco
      )} al documento seleccionado?\n\nSaldo actual: ${formatCLP(
        saldoPendiente
      )}\nSaldo después: ${formatCLP(saldoDespues)}`
    )

    if (!confirmar) return

    setParcialSaving(true)
    setParcialError('')
    setError('')
    setSuccess('')

    const { data, error: rpcError } = await supabase.rpc(
      'conciliar_pago_parcial_bancario',
      {
        p_banco_importacion_fila_id: parcialFila.id,
        p_movimiento_id: movimiento.id,
        p_observacion: `Conciliación parcial desde app: ${
          movimiento.tipo_movimiento
        } ${movimiento.tipo_documento || ''} ${
          movimiento.numero_documento || ''
        }`.trim(),
      }
    )

    if (rpcError) {
      setParcialError(rpcError.message)
      setParcialSaving(false)
      return
    }

    const resultado = Array.isArray(data) ? data[0] : null
    const saldoFinal = resultado?.saldo_pendiente

    setSuccess(
      typeof saldoFinal !== 'undefined'
        ? `Pago parcial registrado correctamente. Saldo pendiente: ${formatCLP(
            saldoFinal
          )}.`
        : 'Pago parcial registrado correctamente.'
    )

    await cargarDatos()

    setParcialSaving(false)
    cerrarConciliacionParcial()
  }


  const transferenciaCompatibleConFila = (
    transferencia: TransferenciaBancaria,
    fila: FilaBanco | null = transferenciaFila
  ) => {
    if (!fila) return false

    const cuentaOrigenId = getTransferenciaCuentaOrigenId(transferencia)
    const cuentaDestinoId = getTransferenciaCuentaDestinoId(transferencia)

    if (Number(fila.cargo ?? 0) > 0) {
      return cuentaOrigenId === fila.cuenta_bancaria_id
    }

    if (Number(fila.abono ?? 0) > 0) {
      return cuentaDestinoId === fila.cuenta_bancaria_id
    }

    return false
  }

  const cargarTransferencias = async (
    fila: FilaBanco | null = transferenciaFila,
    busqueda: string = transferenciaBusqueda
  ) => {
    if (!empresaActivaId || !fila) return

    setTransferenciaLoading(true)
    setTransferenciaError('')

    const texto = busqueda.trim().toLowerCase()
    const montoBanco = getMontoFila(fila)

    const { data, error: queryError } = await supabase
      .from('transferencias_bancarias')
      .select('*')
      .eq('empresa_id', empresaActivaId)
      .order('fecha', { ascending: false })
      .limit(300)

    if (queryError) {
      setTransferenciaError(
        `Error al buscar transferencias: ${queryError.message}`
      )
      setTransferenciaResultados([])
      setTransferenciaLoading(false)
      return
    }

    let resultados = ((data ?? []) as TransferenciaBancaria[]).filter(
      (transferencia) => {
        const montoTransferencia = getTransferenciaMonto(transferencia)
        const estado = String(transferencia.estado || '').toLowerCase()

        if (estado === 'anulada' || estado === 'cancelada') return false

        if (Math.abs(montoTransferencia - montoBanco) > 0.49) return false

        if (!texto) return true

        const campos = [
          transferencia.fecha,
          transferencia.estado,
          getTransferenciaDescripcion(transferencia),
          getTransferenciaCuentaOrigenId(transferencia),
          getTransferenciaCuentaDestinoId(transferencia),
          String(montoTransferencia),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return campos.includes(texto)
      }
    )

    resultados = resultados.sort((a, b) => {
      const compatibleA = transferenciaCompatibleConFila(a, fila) ? 0 : 1
      const compatibleB = transferenciaCompatibleConFila(b, fila) ? 0 : 1

      if (compatibleA !== compatibleB) return compatibleA - compatibleB

      const diffA = getDateDistanceDays(a.fecha, fila.fecha)
      const diffB = getDateDistanceDays(b.fecha, fila.fecha)

      if (diffA !== diffB) return diffA - diffB

      return String(b.fecha || '').localeCompare(String(a.fecha || ''))
    })

    setTransferenciaResultados(resultados)
    setTransferenciaId(resultados[0]?.id || '')
    setTransferenciaLoading(false)
  }

  const abrirVincularTransferencia = async (fila: FilaBanco) => {
    setTransferenciaFila(fila)
    setTransferenciaBusqueda('')
    setTransferenciaResultados([])
    setTransferenciaId('')
    setTransferenciaError('')
    setShowTransferenciaForm(true)

    await cargarTransferencias(fila, '')
  }

  const cerrarVincularTransferencia = () => {
    if (transferenciaSaving) return

    setShowTransferenciaForm(false)
    setTransferenciaFila(null)
    setTransferenciaBusqueda('')
    setTransferenciaResultados([])
    setTransferenciaId('')
    setTransferenciaError('')
  }

  const vincularTransferencia = async () => {
    if (!transferenciaFila) {
      setTransferenciaError('No se encontró la línea de cartola seleccionada.')
      return
    }

    const transferencia = transferenciaResultados.find(
      (item) => item.id === transferenciaId
    )

    if (!transferencia) {
      setTransferenciaError('Debes seleccionar una transferencia existente.')
      return
    }

    const montoBanco = getMontoFila(transferenciaFila)
    const montoTransferencia = getTransferenciaMonto(transferencia)
    const diferencia = montoTransferencia - montoBanco

    if (Math.abs(diferencia) > 0.49) {
      setTransferenciaError(
        `El monto de la transferencia no coincide con la cartola. Diferencia: ${formatCLP(
          diferencia
        )}`
      )
      return
    }

    const compatible = transferenciaCompatibleConFila(
      transferencia,
      transferenciaFila
    )

    const mensajeCompatibilidad = compatible
      ? ''
      : '\n\nAdvertencia: la cuenta bancaria de la línea no coincide claramente con la cuenta origen/destino de la transferencia. La función de base de datos validará antes de conciliar.'

    const confirmar = window.confirm(
      `¿Vincular esta línea de cartola por ${formatCLP(
        montoBanco
      )} con la transferencia seleccionada?${mensajeCompatibilidad}`
    )

    if (!confirmar) return

    setTransferenciaSaving(true)
    setTransferenciaError('')
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'vincular_transferencia_existente_a_fila_bancaria',
      {
        p_fila_id: transferenciaFila.id,
        p_transferencia_id: transferencia.id,
        p_observacion:
          'Conciliación transferencia interna entre cuentas propias desde app',
      }
    )

    if (rpcError) {
      setTransferenciaError(rpcError.message)
      setTransferenciaSaving(false)
      return
    }

    setSuccess('Transferencia interna vinculada y conciliada correctamente.')
    await cargarDatos()

    setTransferenciaSaving(false)
    cerrarVincularTransferencia()
  }

  const abrirFormularioTributario = (fila: FilaBanco) => {
    const esEgreso = Number(fila.cargo ?? 0) > 0
    const montoBanco = esEgreso
      ? Number(fila.cargo ?? 0)
      : Number(fila.abono ?? 0)

    setTributarioForm({
      ...initialTributarioForm,
      fila_id: fila.id,
      tipo_movimiento: esEgreso ? 'egreso' : 'ingreso',
      monto_banco: String(montoBanco),
      descripcion_banco: fila.descripcion_original,
      tercero_tipo: esEgreso ? 'proveedor' : 'cliente',
      tipo_documento: 'factura',
      numero_documento: fila.numero_documento || '',
      tratamiento_tributario: 'afecto_iva',
      descripcion: fila.descripcion_original,
    })
    setTributarioError('')
    setShowTributarioForm(true)
  }

  const cerrarFormularioTributario = () => {
    if (savingTributario) return

    setShowTributarioForm(false)
    setTributarioError('')
    setTributarioForm(initialTributarioForm)
  }

  const handleTributarioChange = (
    field: keyof FormTributario,
    value: string
  ) => {
    setTributarioForm((current) => {
      const montoFields: Array<keyof FormTributario> = [
        'monto_neto',
        'monto_iva',
        'monto_exento',
        'impuesto_especifico',
      ]

      const next = {
        ...current,
        [field]: montoFields.includes(field) ? limpiarMonto(value) : value,
      } as FormTributario

      if (field === 'tercero_tipo') {
        if (value !== 'cliente') next.cliente_id = ''
        if (value !== 'proveedor') next.proveedor_id = ''
      }

      if (field === 'categoria_id') {
        next.centro_costo_id = ''
      }

      return next
    })
  }

  const calcularIvaDesdeNeto = () => {
    const neto = Number(limpiarMonto(tributarioForm.monto_neto) || 0)

    if (!neto || neto <= 0) return

    const iva = Math.round(neto * 0.19)

    setTributarioForm((current) => ({
      ...current,
      monto_iva: String(iva),
      tratamiento_tributario: 'afecto_iva',
    }))
  }

  const calcularAfectoDesdeTotalBanco = () => {
    const total = Number(tributarioForm.monto_banco || 0)

    if (!total || total <= 0) return

    const neto = Math.round(total / 1.19)
    const iva = total - neto

    setTributarioForm((current) => ({
      ...current,
      monto_neto: String(neto),
      monto_iva: String(iva),
      monto_exento: '',
      impuesto_especifico: '',
      tratamiento_tributario: 'afecto_iva',
    }))
  }

  const guardarMovimientoTributario = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!tributarioForm.fila_id) {
      setTributarioError('No se encontró la línea de cartola.')
      return
    }

    if (!tributarioForm.categoria_id) {
      setTributarioError('Debes seleccionar una categoría.')
      return
    }

    if (tributarioForm.tercero_tipo === 'cliente' && !tributarioForm.cliente_id) {
      setTributarioError('Debes seleccionar un cliente.')
      return
    }

    if (
      tributarioForm.tercero_tipo === 'proveedor' &&
      !tributarioForm.proveedor_id
    ) {
      setTributarioError('Debes seleccionar un proveedor.')
      return
    }

    if (
      categoriaSeleccionada?.requiere_centro_costo &&
      !tributarioForm.centro_costo_id
    ) {
      setTributarioError('La categoría seleccionada requiere centro de costo.')
      return
    }

    if (Math.abs(diferenciaTributaria) > 0.49) {
      setTributarioError(
        `El total tributario no coincide con la cartola. Diferencia: ${formatCLP(
          diferenciaTributaria
        )}`
      )
      return
    }

    const confirmar = window.confirm(
      `¿Crear movimiento tributario por ${formatCLP(
        totalBancoTributario
      )} y conciliarlo automáticamente?`
    )

    if (!confirmar) return

    setSavingTributario(true)
    setTributarioError('')
    setError('')
    setSuccess('')

    const { error: rpcError } = await supabase.rpc(
      'crear_movimiento_tributario_desde_fila_bancaria',
      {
        p_fila_id: tributarioForm.fila_id,
        p_tipo_documento: tributarioForm.tipo_documento,
        p_numero_documento: tributarioForm.numero_documento,
        p_categoria_id: tributarioForm.categoria_id,
        p_tercero_tipo: tributarioForm.tercero_tipo,
        p_cliente_id:
          tributarioForm.tercero_tipo === 'cliente'
            ? tributarioForm.cliente_id
            : null,
        p_proveedor_id:
          tributarioForm.tercero_tipo === 'proveedor'
            ? tributarioForm.proveedor_id
            : null,
        p_monto_neto: Number(limpiarMonto(tributarioForm.monto_neto) || 0),
        p_monto_iva: Number(limpiarMonto(tributarioForm.monto_iva) || 0),
        p_monto_exento: Number(limpiarMonto(tributarioForm.monto_exento) || 0),
        p_impuesto_especifico: Number(
          limpiarMonto(tributarioForm.impuesto_especifico) || 0
        ),
        p_tratamiento_tributario: tributarioForm.tratamiento_tributario,
        p_descripcion: tributarioForm.descripcion,
        p_centro_costo_id: tributarioForm.centro_costo_id || null,
      }
    )

    if (rpcError) {
      setTributarioError(rpcError.message)
      setSavingTributario(false)
      return
    }

    setSuccess('Movimiento tributario creado y conciliado correctamente.')
    await cargarDatos()

    setSavingTributario(false)
    setShowTributarioForm(false)
    setTributarioForm(initialTributarioForm)
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Bancos</p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Conciliación bancaria
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Empresa activa:{' '}
            <span className="font-medium text-slate-900">
              {empresaActivaNombre || 'Sin empresa activa'}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading || processing}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Actualizar
          </button>

          <button
            type="button"
            onClick={conciliarExactas}
            disabled={loading || processing || sugerencias.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {processing ? 'Procesando...' : 'Conciliar exactas'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Cuenta bancaria
        </label>

        <select
          value={cuentaFiltro}
          onChange={(event) => setCuentaFiltro(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 md:max-w-xl"
        >
          <option value="">Todas las cuentas</option>

          {bancos.map((banco) => (
            <option key={banco.id} value={banco.id}>
              {getBancoLabel(banco)}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes cartola</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {pendientesCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Sugerencias visibles</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {sugerencias.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Conciliadas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {conciliadasCount}
          </p>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando conciliación bancaria...
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {success ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">
          {success}
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Sugerencias automáticas
            </h2>
            <p className="text-sm text-slate-500">
              Coincidencias entre cartola bancaria y movimientos internos por
              cuenta, tipo, monto y fecha cercana.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {sugerencias.length > 0 ? (
              sugerencias.map((sugerencia) => (
                <div
                  key={`${sugerencia.fila_banco_id}-${sugerencia.movimiento_id}`}
                  className="rounded-2xl border p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase text-slate-500">
                        Cartola banco
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {sugerencia.descripcion_original}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(sugerencia.fecha_banco)} ·{' '}
                        {sugerencia.tipo_banco}
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCLP(sugerencia.monto_banco)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs font-medium uppercase text-blue-700">
                        Movimiento Auren
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {sugerencia.descripcion_movimiento || 'Sin descripción'}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(sugerencia.fecha_movimiento)} · Doc:{' '}
                        {sugerencia.documento_movimiento || '-'}
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCLP(sugerencia.monto_total)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <p>
                          Puntaje:{' '}
                          <span className="font-semibold">
                            {sugerencia.puntaje}
                          </span>
                        </p>
                        <p>
                          Diferencia días:{' '}
                          <span className="font-semibold">
                            {sugerencia.dias_diferencia}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => conciliarSugerencia(sugerencia)}
                        disabled={processing}
                        className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Conciliar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                No hay sugerencias disponibles con los filtros actuales.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Pendientes de cartola
          </h2>

          <div className="mt-5 overflow-hidden rounded-xl border text-sm">
            <div className="grid grid-cols-6 bg-slate-50 text-xs uppercase text-slate-500">
              <div className="px-4 py-3 font-semibold">Fecha</div>
              <div className="px-4 py-3 font-semibold">Descripción</div>
              <div className="px-4 py-3 font-semibold">Cuenta</div>
              <div className="px-4 py-3 font-semibold">Cargo</div>
              <div className="px-4 py-3 font-semibold">Abono</div>
              <div className="px-4 py-3 font-semibold">Acción</div>
            </div>

            {pendientes.length > 0 ? (
              <div className="divide-y">
                {pendientes.map((fila) => (
                  <div key={fila.id} className="grid grid-cols-6 items-center">
                    <div className="px-4 py-3">{formatDate(fila.fecha)}</div>

                    <div className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {fila.descripcion_original}
                      </p>
                      <p className="text-xs text-slate-500">
                        Doc: {fila.numero_documento || '-'}
                      </p>
                    </div>

                    <div className="px-4 py-3 text-xs text-slate-600">
                      {getBancoLabel(bancosPorId.get(fila.cuenta_bancaria_id))}
                    </div>

                    <div className="px-4 py-3 font-medium text-red-700">
                      {Number(fila.cargo ?? 0) > 0
                        ? formatCLP(fila.cargo)
                        : '-'}
                    </div>

                    <div className="px-4 py-3 font-medium text-emerald-700">
                      {Number(fila.abono ?? 0) > 0
                        ? formatCLP(fila.abono)
                        : '-'}
                    </div>

                    <div className="space-y-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => crearMovimientoSimple(fila)}
                        disabled={processing}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Crear mov. simple
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirFormularioTributario(fila)}
                        disabled={processing}
                        className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        Crear compra/venta
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirConciliacionManual(fila)}
                        disabled={processing}
                        className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        Conciliar manual
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirConciliacionParcial(fila)}
                        disabled={processing}
                        className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        Conciliar parcial
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirConciliacionMultiple(fila)}
                        disabled={processing}
                        className="w-full rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                      >
                        Conciliar múltiple
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirVincularTransferencia(fila)}
                        disabled={processing}
                        className="w-full rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
                      >
                        Vincular transferencia
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-5 text-center text-slate-500">
                No hay líneas pendientes con los filtros actuales.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Conciliadas recientes
          </h2>

          <div className="mt-5 space-y-3">
            {conciliadas.length > 0 ? (
              conciliadas.map((fila) => {
                const movimiento = fila.movimiento_id
                  ? movimientosPorId.get(fila.movimiento_id)
                  : undefined

                return (
                  <div key={fila.id} className="rounded-2xl border p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-500">
                          Cartola bancaria
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">
                          {fila.descripcion_original}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDate(fila.fecha)} ·{' '}
                          {Number(fila.cargo ?? 0) > 0
                            ? formatCLP(fila.cargo)
                            : formatCLP(fila.abono)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 p-4">
                        <p className="text-xs font-medium uppercase text-emerald-700">
                          Movimiento conciliado
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">
                          {movimiento?.descripcion ||
                            'Movimiento no encontrado'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {movimiento?.numero_documento || '-'} ·{' '}
                          {formatCLP(movimiento?.monto_total)}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          {fila.conciliacion_tipo || 'conciliada'} · diferencia{' '}
                          {formatCLP(fila.diferencia_conciliacion)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => reversarConciliacion(fila)}
                        disabled={processing}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Reversar
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                No hay conciliaciones recientes con los filtros actuales.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {showSimpleForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Crear desde cartola
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Movimiento simple no afecto
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {simpleForm.descripcion_banco || 'Sin descripción'} ·{' '}
                  {formatCLP(totalSimple)}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarFormularioSimple}
                disabled={savingSimple}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={guardarMovimientoSimple} className="mt-5 space-y-5">
              {simpleError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {simpleError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Tipo</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {simpleForm.tipo_movimiento === 'egreso'
                      ? 'Egreso'
                      : 'Ingreso'}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Monto cartola</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCLP(totalSimple)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Tipo documento
                  <select
                    value={simpleForm.tipo_documento}
                    onChange={(event) =>
                      handleSimpleChange(
                        'tipo_documento',
                        event.target.value as FormSimple['tipo_documento']
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="comprobante">Comprobante</option>
                    <option value="boleta">Boleta</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Número documento
                  <input
                    type="text"
                    value={simpleForm.numero_documento}
                    onChange={(event) =>
                      handleSimpleChange('numero_documento', event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    placeholder="Folio, comprobante o referencia"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Categoría contable
                <select
                  value={simpleForm.categoria_id}
                  onChange={(event) =>
                    handleSimpleChange('categoria_id', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasSimpleFiltradas.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                      {categoria.cuenta_contable_id ? '' : ' - sin cuenta'}
                    </option>
                  ))}
                </select>
                {categoriaSimpleSeleccionada?.cuenta_contable_id ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Esta categoría tiene cuenta contable asociada.
                  </p>
                ) : simpleForm.categoria_id ? (
                  <p className="mt-1 text-xs text-red-700">
                    Esta categoría no tiene cuenta contable asociada.
                  </p>
                ) : null}
              </label>

              {categoriaSimpleSeleccionada?.requiere_centro_costo ? (
                <label className="block text-sm font-medium text-slate-700">
                  Centro de costo
                  <select
                    value={simpleForm.centro_costo_id}
                    onChange={(event) =>
                      handleSimpleChange('centro_costo_id', event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    required
                  >
                    <option value="">Seleccionar centro de costo</option>
                    {centrosCosto.map((centro) => (
                      <option key={centro.id} value={centro.id}>
                        {centro.codigo ? `${centro.codigo} - ` : ''}
                        {centro.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block text-sm font-medium text-slate-700">
                Descripción
                <input
                  type="text"
                  value={simpleForm.descripcion}
                  onChange={(event) =>
                    handleSimpleChange('descripcion', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  required
                />
              </label>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Usa esta opción para pagos no afectos o movimientos sin IVA,
                como F29, comisiones, intereses, ajustes bancarios o cargos no
                tributarios. Para facturas o compras con IVA usa “Crear
                compra/venta”.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarFormularioSimple}
                  disabled={savingSimple}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingSimple}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingSimple ? 'Creando...' : 'Crear y conciliar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showConciliarManualForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Conciliar línea bancaria
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Conciliación manual
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {manualFila?.descripcion_original || 'Sin descripción'} ·{' '}
                  {formatDate(manualFila?.fecha)} ·{' '}
                  {formatCLP(getMontoFila(manualFila))}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarConciliacionManual}
                disabled={manualSaving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {manualError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {manualError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Buscar movimiento existente
                  </label>
                  <input
                    type="text"
                    value={manualBusqueda}
                    onChange={(event) => setManualBusqueda(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void cargarMovimientosManual()
                      }
                    }}
                    placeholder="Monto, factura, proveedor/cliente o descripción"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={manualTipo}
                    onChange={(event) =>
                      setManualTipo(
                        event.target.value as 'todos' | 'ingreso' | 'egreso'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="todos">Todos</option>
                    <option value="ingreso">Ingresos</option>
                    <option value="egreso">Egresos</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => cargarMovimientosManual()}
                    disabled={manualLoading || manualSaving}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {manualLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-800">
                Usa esta opción solo cuando el ingreso o egreso ya existe en
                Auren y quieres vincularlo con la cartola. No crea documentos
                nuevos.
              </div>

              <div className="overflow-hidden rounded-xl border text-sm">
                <div className="grid grid-cols-7 bg-slate-50 text-xs uppercase text-slate-500">
                  <div className="px-4 py-3 font-semibold">Sel.</div>
                  <div className="px-4 py-3 font-semibold">Fecha</div>
                  <div className="px-4 py-3 font-semibold">Tipo</div>
                  <div className="px-4 py-3 font-semibold">Documento</div>
                  <div className="px-4 py-3 font-semibold">Tercero</div>
                  <div className="px-4 py-3 font-semibold">Descripción</div>
                  <div className="px-4 py-3 font-semibold">Total</div>
                </div>

                {manualResultados.length > 0 ? (
                  <div className="divide-y">
                    {manualResultados.map((movimiento) => {
                      const tercero =
                        getRelacionNombre(movimiento.clientes) ||
                        getRelacionNombre(movimiento.proveedores) ||
                        '-'
                      const categoria = getRelacionNombre(movimiento.categorias)
                      const diferencia =
                        getMontoFila(manualFila) - Number(movimiento.monto_total ?? 0)

                      return (
                        <label
                          key={movimiento.id}
                          className={
                            movimiento.id === manualMovimientoId
                              ? 'grid cursor-pointer grid-cols-7 items-center bg-emerald-50'
                              : 'grid cursor-pointer grid-cols-7 items-center hover:bg-slate-50'
                          }
                        >
                          <div className="px-4 py-3">
                            <input
                              type="radio"
                              name="movimiento-manual"
                              checked={movimiento.id === manualMovimientoId}
                              onChange={() => setManualMovimientoId(movimiento.id)}
                            />
                          </div>

                          <div className="px-4 py-3">
                            {formatDate(movimiento.fecha)}
                          </div>

                          <div className="px-4 py-3 capitalize">
                            {movimiento.tipo_movimiento}
                            <p className="text-xs text-slate-500">
                              {movimiento.estado}
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {movimiento.tipo_documento || '-'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {movimiento.numero_documento || 'Sin número'}
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {tercero}
                            </p>
                            {categoria ? (
                              <p className="text-xs text-slate-500">
                                {categoria}
                              </p>
                            ) : null}
                          </div>

                          <div className="px-4 py-3 text-slate-700">
                            {movimiento.descripcion || '-'}
                            {Math.abs(diferencia) > 0.49 ? (
                              <p className="mt-1 text-xs font-medium text-red-700">
                                Diferencia: {formatCLP(diferencia)}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs font-medium text-emerald-700">
                                Monto coincide
                              </p>
                            )}
                          </div>

                          <div className="px-4 py-3 font-semibold text-slate-900">
                            {formatCLP(movimiento.monto_total)}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-slate-500">
                    No hay movimientos para la búsqueda actual. Prueba con el
                    monto exacto, número de factura, proveedor/cliente o
                    descripción.
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarConciliacionManual}
                  disabled={manualSaving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={conciliarManual}
                  disabled={manualSaving || !manualMovimientoId}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
                >
                  {manualSaving ? 'Conciliando...' : 'Conciliar seleccionado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showConciliarMultipleForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Conciliar una línea con varios movimientos
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Conciliación múltiple
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {multipleFila?.descripcion_original || 'Sin descripción'} ·{' '}
                  {formatDate(multipleFila?.fecha)} ·{' '}
                  {formatCLP(getMontoFila(multipleFila))}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarConciliacionMultiple}
                disabled={multipleSaving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {multipleError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {multipleError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Buscar movimientos existentes
                  </label>
                  <input
                    type="text"
                    value={multipleBusqueda}
                    onChange={(event) =>
                      setMultipleBusqueda(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void cargarMovimientosMultiple()
                      }
                    }}
                    placeholder="Factura, proveedor/cliente, descripción o monto individual"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={multipleTipo}
                    onChange={(event) =>
                      setMultipleTipo(
                        event.target.value as 'todos' | 'ingreso' | 'egreso'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="todos">Todos</option>
                    <option value="ingreso">Ingresos</option>
                    <option value="egreso">Egresos</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => cargarMovimientosMultiple()}
                    disabled={multipleLoading || multipleSaving}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {multipleLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Monto cartola</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCLP(getMontoFila(multipleFila))}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Seleccionado</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCLP(getTotalMultipleSeleccionado())}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {multipleMovimientoIds.length} movimientos
                  </p>
                </div>

                <div
                  className={
                    Math.abs(
                      getTotalMultipleSeleccionado() - getMontoFila(multipleFila)
                    ) <= 0.49
                      ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4'
                      : 'rounded-2xl border border-red-200 bg-red-50 p-4'
                  }
                >
                  <p className="text-sm text-slate-500">Diferencia</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCLP(
                      getTotalMultipleSeleccionado() - getMontoFila(multipleFila)
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-800">
                Usa esta opción cuando una sola línea bancaria paga varias
                facturas o movimientos ya creados. La suma seleccionada debe
                coincidir exactamente con el monto de la cartola.
              </div>

              <div className="overflow-hidden rounded-xl border text-sm">
                <div className="grid grid-cols-7 bg-slate-50 text-xs uppercase text-slate-500">
                  <div className="px-4 py-3 font-semibold">Sel.</div>
                  <div className="px-4 py-3 font-semibold">Fecha</div>
                  <div className="px-4 py-3 font-semibold">Tipo</div>
                  <div className="px-4 py-3 font-semibold">Documento</div>
                  <div className="px-4 py-3 font-semibold">Tercero</div>
                  <div className="px-4 py-3 font-semibold">Descripción</div>
                  <div className="px-4 py-3 font-semibold">Total</div>
                </div>

                {multipleResultados.length > 0 ? (
                  <div className="divide-y">
                    {multipleResultados.map((movimiento) => {
                      const tercero =
                        getRelacionNombre(movimiento.clientes) ||
                        getRelacionNombre(movimiento.proveedores) ||
                        '-'
                      const categoria = getRelacionNombre(movimiento.categorias)
                      const seleccionado = multipleMovimientoIds.includes(
                        movimiento.id
                      )

                      return (
                        <label
                          key={movimiento.id}
                          className={
                            seleccionado
                              ? 'grid cursor-pointer grid-cols-7 items-center bg-purple-50'
                              : 'grid cursor-pointer grid-cols-7 items-center hover:bg-slate-50'
                          }
                        >
                          <div className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={() =>
                                toggleMovimientoMultiple(movimiento.id)
                              }
                            />
                          </div>

                          <div className="px-4 py-3">
                            {formatDate(movimiento.fecha)}
                          </div>

                          <div className="px-4 py-3 capitalize">
                            {movimiento.tipo_movimiento}
                            <p className="text-xs text-slate-500">
                              {movimiento.estado}
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {movimiento.tipo_documento || '-'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {movimiento.numero_documento || 'Sin número'}
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {tercero}
                            </p>
                            {categoria ? (
                              <p className="text-xs text-slate-500">
                                {categoria}
                              </p>
                            ) : null}
                          </div>

                          <div className="px-4 py-3 text-slate-700">
                            {movimiento.descripcion || '-'}
                          </div>

                          <div className="px-4 py-3 font-semibold text-slate-900">
                            {formatCLP(movimiento.monto_total)}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-slate-500">
                    No hay movimientos para la búsqueda actual. Prueba con
                    proveedor, descripción, número de factura o monto individual.
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarConciliacionMultiple}
                  disabled={multipleSaving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={conciliarMultiple}
                  disabled={
                    multipleSaving ||
                    multipleMovimientoIds.length < 2 ||
                    Math.abs(
                      getTotalMultipleSeleccionado() - getMontoFila(multipleFila)
                    ) > 0.49
                  }
                  className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-800 disabled:opacity-60"
                >
                  {multipleSaving
                    ? 'Conciliando...'
                    : 'Conciliar seleccionados'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showConciliarParcialForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Conciliar varios pagos contra una factura
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Conciliación parcial
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {parcialFila?.descripcion_original || 'Sin descripción'} ·{' '}
                  {formatDate(parcialFila?.fecha)} ·{' '}
                  {formatCLP(getMontoFila(parcialFila))}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarConciliacionParcial}
                disabled={parcialSaving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {parcialError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {parcialError}
                </div>
              ) : null}

              <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-800">
                Usa esta opción cuando una factura o movimiento ya existe por el
                total, pero fue pagado con dos o más líneas bancarias desde una
                o más cuentas. No crea otra factura ni duplica IVA/gasto.
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Buscar factura o movimiento existente
                  </label>
                  <input
                    type="text"
                    value={parcialBusqueda}
                    onChange={(event) =>
                      setParcialBusqueda(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void cargarMovimientosParcial()
                      }
                    }}
                    placeholder="Factura, proveedor/cliente, descripción o monto total"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={parcialTipo}
                    onChange={(event) =>
                      setParcialTipo(
                        event.target.value as 'todos' | 'ingreso' | 'egreso'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="todos">Todos</option>
                    <option value="ingreso">Ingresos</option>
                    <option value="egreso">Egresos</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => cargarMovimientosParcial()}
                    disabled={parcialLoading || parcialSaving}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {parcialLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              {(() => {
                const movimiento = getMovimientoParcialSeleccionado()
                const resumen = getResumenParcialMovimiento(movimiento)
                const montoBanco = getMontoFila(parcialFila)
                const saldoPendiente = Number(resumen?.saldo_pendiente ?? 0)
                const saldoDespues = Math.max(saldoPendiente - montoBanco, 0)

                return (
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Pago cartola</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCLP(montoBanco)}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Total documento</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCLP(resumen?.total_documento)}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Ya pagado parcial</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCLP(resumen?.total_pagado_parcial)}
                      </p>
                    </div>

                    <div
                      className={
                        movimiento && montoBanco <= saldoPendiente + 0.49
                          ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4'
                          : 'rounded-2xl border border-amber-200 bg-amber-50 p-4'
                      }
                    >
                      <p className="text-sm text-slate-500">Saldo después</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {movimiento ? formatCLP(saldoDespues) : '-'}
                      </p>
                    </div>
                  </div>
                )
              })()}

              <div className="overflow-hidden rounded-xl border text-sm">
                <div className="grid grid-cols-8 bg-slate-50 text-xs uppercase text-slate-500">
                  <div className="px-4 py-3 font-semibold">Sel.</div>
                  <div className="px-4 py-3 font-semibold">Fecha</div>
                  <div className="px-4 py-3 font-semibold">Tipo</div>
                  <div className="px-4 py-3 font-semibold">Documento</div>
                  <div className="px-4 py-3 font-semibold">Tercero</div>
                  <div className="px-4 py-3 font-semibold">Descripción</div>
                  <div className="px-4 py-3 font-semibold">Total</div>
                  <div className="px-4 py-3 font-semibold">Saldo</div>
                </div>

                {parcialResultados.length > 0 ? (
                  <div className="divide-y">
                    {parcialResultados.map((movimiento) => {
                      const tercero =
                        getRelacionNombre(movimiento.clientes) ||
                        getRelacionNombre(movimiento.proveedores) ||
                        '-'
                      const categoria = getRelacionNombre(movimiento.categorias)
                      const resumen = getResumenParcialMovimiento(movimiento)
                      const saldo = Number(resumen?.saldo_pendiente ?? 0)
                      const seleccionado = movimiento.id === parcialMovimientoId
                      const compatible =
                        getMontoFila(parcialFila) <= saldo + 0.49

                      return (
                        <label
                          key={movimiento.id}
                          className={
                            seleccionado
                              ? 'grid cursor-pointer grid-cols-8 items-center bg-amber-50'
                              : 'grid cursor-pointer grid-cols-8 items-center hover:bg-slate-50'
                          }
                        >
                          <div className="px-4 py-3">
                            <input
                              type="radio"
                              name="movimiento-parcial"
                              checked={seleccionado}
                              onChange={() =>
                                setParcialMovimientoId(movimiento.id)
                              }
                            />
                          </div>

                          <div className="px-4 py-3">
                            {formatDate(movimiento.fecha)}
                          </div>

                          <div className="px-4 py-3 capitalize">
                            {movimiento.tipo_movimiento}
                            <p className="text-xs text-slate-500">
                              {movimiento.estado}
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {movimiento.tipo_documento || '-'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {movimiento.numero_documento || 'Sin número'}
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {tercero}
                            </p>
                            {categoria ? (
                              <p className="text-xs text-slate-500">
                                {categoria}
                              </p>
                            ) : null}
                          </div>

                          <div className="px-4 py-3 text-slate-700">
                            {movimiento.descripcion || '-'}
                            <p
                              className={
                                compatible
                                  ? 'mt-1 text-xs font-medium text-emerald-700'
                                  : 'mt-1 text-xs font-medium text-red-700'
                              }
                            >
                              {compatible
                                ? 'El pago cabe en el saldo'
                                : 'El pago excede el saldo'}
                            </p>
                          </div>

                          <div className="px-4 py-3 font-semibold text-slate-900">
                            {formatCLP(resumen?.total_documento)}
                          </div>

                          <div className="px-4 py-3 font-semibold text-amber-700">
                            {formatCLP(resumen?.saldo_pendiente)}
                            {Number(resumen?.cantidad_pagos ?? 0) > 0 ? (
                              <p className="text-xs font-normal text-slate-500">
                                {resumen?.cantidad_pagos} pago(s)
                              </p>
                            ) : null}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-slate-500">
                    No hay facturas o movimientos disponibles para la búsqueda.
                    Prueba con número de factura, proveedor/cliente o
                    descripción.
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarConciliacionParcial}
                  disabled={parcialSaving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={conciliarParcial}
                  disabled={parcialSaving || !parcialMovimientoId}
                  className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-800 disabled:opacity-60"
                >
                  {parcialSaving
                    ? 'Conciliando...'
                    : 'Aplicar pago parcial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showTransferenciaForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Vincular transferencia existente
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Transferencia interna
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {transferenciaFila?.descripcion_original || 'Sin descripción'} ·{' '}
                  {formatDate(transferenciaFila?.fecha)} ·{' '}
                  {formatCLP(getMontoFila(transferenciaFila))}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarVincularTransferencia}
                disabled={transferenciaSaving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {transferenciaError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {transferenciaError}
                </div>
              ) : null}

              <div className="rounded-2xl border bg-cyan-50 p-4 text-sm text-cyan-800">
                Usa esta opción solo para transferencias entre cuentas propias ya creadas en el módulo Transferencias. No crea movimientos ni egresos nuevos.
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Buscar transferencia existente
                  </label>
                  <input
                    type="text"
                    value={transferenciaBusqueda}
                    onChange={(event) =>
                      setTransferenciaBusqueda(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void cargarTransferencias()
                      }
                    }}
                    placeholder="Descripción, fecha, estado o monto"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => cargarTransferencias()}
                    disabled={transferenciaLoading || transferenciaSaving}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {transferenciaLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Monto cartola</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCLP(getMontoFila(transferenciaFila))}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Cuenta cartola</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {getBancoLabel(
                      transferenciaFila
                        ? bancosPorId.get(transferenciaFila.cuenta_bancaria_id)
                        : undefined
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Tipo línea</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {Number(transferenciaFila?.cargo ?? 0) > 0
                      ? 'Salida / origen'
                      : 'Entrada / destino'}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border text-sm">
                <div className="grid grid-cols-7 bg-slate-50 text-xs uppercase text-slate-500">
                  <div className="px-4 py-3 font-semibold">Sel.</div>
                  <div className="px-4 py-3 font-semibold">Fecha</div>
                  <div className="px-4 py-3 font-semibold">Monto</div>
                  <div className="px-4 py-3 font-semibold">Origen</div>
                  <div className="px-4 py-3 font-semibold">Destino</div>
                  <div className="px-4 py-3 font-semibold">Estado</div>
                  <div className="px-4 py-3 font-semibold">Descripción</div>
                </div>

                {transferenciaResultados.length > 0 ? (
                  <div className="divide-y">
                    {transferenciaResultados.map((transferencia) => {
                      const seleccionado = transferencia.id === transferenciaId
                      const origenId = getTransferenciaCuentaOrigenId(transferencia)
                      const destinoId = getTransferenciaCuentaDestinoId(transferencia)
                      const compatible = transferenciaCompatibleConFila(
                        transferencia,
                        transferenciaFila
                      )

                      return (
                        <label
                          key={transferencia.id}
                          className={
                            seleccionado
                              ? 'grid cursor-pointer grid-cols-7 items-center bg-cyan-50'
                              : 'grid cursor-pointer grid-cols-7 items-center hover:bg-slate-50'
                          }
                        >
                          <div className="px-4 py-3">
                            <input
                              type="radio"
                              name="transferencia_bancaria_id"
                              checked={seleccionado}
                              onChange={() => setTransferenciaId(transferencia.id)}
                            />
                          </div>

                          <div className="px-4 py-3">
                            {formatDate(transferencia.fecha)}
                            {compatible ? (
                              <p className="text-xs text-emerald-600">
                                Cuenta compatible
                              </p>
                            ) : (
                              <p className="text-xs text-amber-600">
                                Revisar cuenta
                              </p>
                            )}
                          </div>

                          <div className="px-4 py-3 font-semibold text-slate-900">
                            {formatCLP(getTransferenciaMonto(transferencia))}
                          </div>

                          <div className="px-4 py-3 text-xs text-slate-700">
                            {getBancoLabel(
                              origenId ? bancosPorId.get(origenId) : undefined
                            )}
                          </div>

                          <div className="px-4 py-3 text-xs text-slate-700">
                            {getBancoLabel(
                              destinoId ? bancosPorId.get(destinoId) : undefined
                            )}
                          </div>

                          <div className="px-4 py-3 capitalize text-slate-700">
                            {transferencia.estado || '-'}
                          </div>

                          <div className="px-4 py-3 text-slate-700">
                            {getTransferenciaDescripcion(transferencia)}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-slate-500">
                    No se encontraron transferencias existentes por el mismo monto. Primero registra la transferencia en el módulo Transferencias.
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarVincularTransferencia}
                  disabled={transferenciaSaving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={vincularTransferencia}
                  disabled={transferenciaSaving || !transferenciaId}
                  className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60"
                >
                  {transferenciaSaving
                    ? 'Vinculando...'
                    : 'Vincular transferencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showTributarioForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Crear compra/venta desde cartola
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Movimiento tributario
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {tributarioForm.descripcion_banco}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarFormularioTributario}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <form
              onSubmit={guardarMovimientoTributario}
              className="mt-5 space-y-5"
            >
              {tributarioError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {tributarioError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Tipo</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {tributarioForm.tipo_movimiento === 'egreso'
                      ? 'Compra / egreso'
                      : 'Venta / ingreso'}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Total banco</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatCLP(totalBancoTributario)}
                  </p>
                </div>

                <div
                  className={
                    Math.abs(diferenciaTributaria) <= 0.49
                      ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4'
                      : 'rounded-2xl border border-red-200 bg-red-50 p-4'
                  }
                >
                  <p className="text-sm text-slate-500">Diferencia</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatCLP(diferenciaTributaria)}
                  </p>
                </div>
              </div>

              <section className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo documento
                  </label>
                  <select
                    value={tributarioForm.tipo_documento}
                    onChange={(event) =>
                      handleTributarioChange(
                        'tipo_documento',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="factura">Factura</option>
                    <option value="boleta">Boleta</option>
                    <option value="nota_credito">Nota de crédito</option>
                    <option value="nota_debito">Nota de débito</option>
                    <option value="comprobante">Comprobante</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Número documento
                  </label>
                  <input
                    type="text"
                    value={tributarioForm.numero_documento}
                    onChange={(event) =>
                      handleTributarioChange(
                        'numero_documento',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tercero
                  </label>
                  <select
                    value={tributarioForm.tercero_tipo}
                    onChange={(event) =>
                      handleTributarioChange(
                        'tercero_tipo',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="proveedor">Proveedor</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {tributarioForm.tercero_tipo === 'cliente' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Cliente
                    </label>
                    <select
                      value={tributarioForm.cliente_id}
                      onChange={(event) =>
                        handleTributarioChange(
                          'cliente_id',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    >
                      <option value="">Seleccionar cliente</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                          {cliente.rut ? ` - ${cliente.rut}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {tributarioForm.tercero_tipo === 'proveedor' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Proveedor
                    </label>
                    <select
                      value={tributarioForm.proveedor_id}
                      onChange={(event) =>
                        handleTributarioChange(
                          'proveedor_id',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    >
                      <option value="">Seleccionar proveedor</option>
                      {proveedores.map((proveedor) => (
                        <option key={proveedor.id} value={proveedor.id}>
                          {proveedor.nombre}
                          {proveedor.rut ? ` - ${proveedor.rut}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Categoría
                  </label>
                  <select
                    value={tributarioForm.categoria_id}
                    onChange={(event) =>
                      handleTributarioChange(
                        'categoria_id',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categoriasFiltradas.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                        {categoria.requiere_centro_costo
                          ? ' - requiere C.C.'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {categoriaSeleccionada?.requiere_centro_costo ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Centro de costo
                    </label>
                    <select
                      value={tributarioForm.centro_costo_id}
                      onChange={(event) =>
                        handleTributarioChange(
                          'centro_costo_id',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    >
                      <option value="">Seleccionar centro de costo</option>
                      {centrosCosto.map((centro) => (
                        <option key={centro.id} value={centro.id}>
                          {centro.codigo ? `${centro.codigo} - ` : ''}
                          {centro.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </section>

              <section className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Neto
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tributarioForm.monto_neto}
                    onChange={(event) =>
                      handleTributarioChange('monto_neto', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    IVA
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tributarioForm.monto_iva}
                    onChange={(event) =>
                      handleTributarioChange('monto_iva', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />

                  <div className="mt-1 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={calcularIvaDesdeNeto}
                      className="text-left text-xs font-medium text-blue-700 hover:underline"
                    >
                      Calcular IVA 19% desde neto
                    </button>

                    <button
                      type="button"
                      onClick={calcularAfectoDesdeTotalBanco}
                      className="text-left text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Calcular neto e IVA desde total banco
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Exento
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tributarioForm.monto_exento}
                    onChange={(event) =>
                      handleTributarioChange('monto_exento', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Impuesto específico
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tributarioForm.impuesto_especifico}
                    onChange={(event) =>
                      handleTributarioChange(
                        'impuesto_especifico',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tratamiento tributario
                  </label>
                  <select
                    value={tributarioForm.tratamiento_tributario}
                    onChange={(event) =>
                      handleTributarioChange(
                        'tratamiento_tributario',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="afecto_iva">Afecto IVA</option>
                    <option value="iva">IVA</option>
                    <option value="exento">Exento</option>
                    <option value="no_afecto">No afecto</option>
                    <option value="mixto">Mixto</option>
                    <option value="combustible">Combustible</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={tributarioForm.descripcion}
                    onChange={(event) =>
                      handleTributarioChange('descripcion', event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </section>

              <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  Total tributario:{' '}
                  <span className="font-semibold text-slate-900">
                    {formatCLP(totalTributario)}
                  </span>
                </p>
                <p>
                  Total cartola:{' '}
                  <span className="font-semibold text-slate-900">
                    {formatCLP(totalBancoTributario)}
                  </span>
                </p>
                <p>
                  Diferencia:{' '}
                  <span
                    className={
                      Math.abs(diferenciaTributaria) <= 0.49
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-red-700'
                    }
                  >
                    {formatCLP(diferenciaTributaria)}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Usa este formulario solo para compras o ventas con respaldo
                tributario. Para comisiones bancarias, intereses o ajustes usa
                “Crear mov. simple”.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarFormularioTributario}
                  disabled={savingTributario}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    savingTributario || Math.abs(diferenciaTributaria) > 0.49
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingTributario
                    ? 'Guardando...'
                    : 'Crear y conciliar movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}