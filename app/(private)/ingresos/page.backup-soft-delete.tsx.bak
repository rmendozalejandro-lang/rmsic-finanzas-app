'use client'

import Link from 'next/link'
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'
import EmpresaActivaBanner from '../../../components/EmpresaActivaBanner'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'

type Cliente = {
  id: string
  nombre: string
}

type CuentaBancaria = {
  id: string
  banco: string
  nombre_cuenta: string
}

type Categoria = {
  id: string
  empresa_id: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  clasificacion_financiera: string | null
  activa: boolean
}

type CentroCosto = {
  id: string
  empresa_id: string
  nombre: string
}

type TratamientoTributario = 'afecto_iva' | 'exento' | 'mixto'

type Ingreso = {
  id: string
  fecha: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
  tratamiento_tributario: string | null
  monto_neto: number | null
  monto_exento: number | null
  monto_iva: number | null
  impuesto_especifico: number | null
  monto_total: number
  estado: string
  cliente_id: string | null
  cliente_nombre?: string | null
  categoria_id: string | null
  categoria_nombre?: string | null
  centro_costo_id: string | null
  centro_costo_nombre?: string | null
  cuenta_bancaria_id: string | null
  cuenta_bancaria_nombre?: string | null
  empresa_id: string
  activo?: boolean | null
  deleted_at?: string | null
}

type FormData = {
  fecha: string
  tipo_documento: string
  numero_documento: string
  descripcion: string
  tratamiento_tributario: TratamientoTributario
  monto_neto: string
  monto_exento: string
  monto_iva: string
  impuesto_especifico: string
  monto_total: string
  estado: string
  cliente_id: string
  categoria_id: string
  centro_costo_id: string
  cuenta_bancaria_id: string
}

type FiltroEstado = 'todos' | 'pendiente' | 'pagado' | 'anulado'

type Filters = {
  estado: FiltroEstado
  fechaDesde: string
  fechaHasta: string
  numeroDocumento: string
  clienteId: string
  texto: string
}

const STORAGE_KEY = 'empresa_activa_id'
const IVA_RATE = 0.19

const buildInitialForm = (): FormData => ({
  fecha: new Date().toISOString().slice(0, 10),
  tipo_documento: 'factura',
  numero_documento: '',
  descripcion: '',
  tratamiento_tributario: 'afecto_iva',
  monto_neto: '',
  monto_exento: '',
  monto_iva: '',
  impuesto_especifico: '0',
  monto_total: '',
  estado: 'pendiente',
  cliente_id: '',
  categoria_id: '',
  centro_costo_id: '',
  cuenta_bancaria_id: '',
})

const buildInitialFilters = (): Filters => ({
  estado: 'todos',
  fechaDesde: '',
  fechaHasta: '',
  numeroDocumento: '',
  clienteId: '',
  texto: '',
})

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatDate = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CL')
}

const formatTratamientoTributario = (value: string | null | undefined) => {
  switch (value) {
    case 'afecto_iva':
      return 'Con IVA'
    case 'exento':
      return 'Exento de IVA'
    case 'mixto':
      return 'Con IVA + Exento IVA'
    default:
      return value || '-'
  }
}

const inferTratamientoTributario = (item: Ingreso): TratamientoTributario => {
  if (item.tratamiento_tributario === 'afecto_iva') return 'afecto_iva'
  if (item.tratamiento_tributario === 'exento') return 'exento'
  if (item.tratamiento_tributario === 'mixto') return 'mixto'

  const neto = Number(item.monto_neto || 0)
  const exento = Number(item.monto_exento || 0)

  if (neto > 0 && exento > 0) return 'mixto'
  if (exento > 0 && neto <= 0) return 'exento'
  return 'afecto_iva'
}

function FormModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function IngresosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])

  const [formData, setFormData] = useState<FormData>(buildInitialForm())
  const [filters, setFilters] = useState<Filters>(buildInitialFilters())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [usuarioRol, setUsuarioRol] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const loadData = useCallback(async () => {
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
      const userId = sessionData.session.user.id
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const headers = {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }

      const [
        clientesResp,
        cuentasResp,
        categoriasResp,
        centrosResp,
        ingresosResp,
        rolResp,
      ] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/clientes?select=id,nombre&empresa_id=eq.${empresaActivaId}&activo=eq.true&deleted_at=is.null&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?select=id,banco,nombre_cuenta&empresa_id=eq.${empresaActivaId}&activa=eq.true&deleted_at=is.null&order=banco.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/categorias?select=id,empresa_id,nombre,tipo,clasificacion_financiera,activa&empresa_id=eq.${empresaActivaId}&tipo=eq.ingreso&activa=eq.true&deleted_at=is.null&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/centros_costo?select=id,empresa_id,nombre&empresa_id=eq.${empresaActivaId}&activo=eq.true&deleted_at=is.null&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_documento,numero_documento,descripcion,tratamiento_tributario,monto_neto,monto_exento,monto_iva,impuesto_especifico,monto_total,estado,cliente_id,categoria_id,centro_costo_id,cuenta_bancaria_id,empresa_id,activo,deleted_at&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&activo=eq.true&deleted_at=is.null&order=fecha.desc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/usuario_empresas?select=rol&usuario_id=eq.${userId}&empresa_id=eq.${empresaActivaId}&activo=eq.true`,
          { headers }
        ),
      ])

      const clientesJson = await clientesResp.json()
      const cuentasJson = await cuentasResp.json()
      const categoriasJson = await categoriasResp.json()
      const centrosJson = await centrosResp.json()
      const ingresosJson = await ingresosResp.json()
      const rolJson = await rolResp.json()

      if (!clientesResp.ok) {
        setError('No se pudieron cargar los clientes.')
        return
      }
      if (!cuentasResp.ok) {
        setError('No se pudieron cargar las cuentas bancarias.')
        return
      }
      if (!categoriasResp.ok) {
        setError('No se pudieron cargar las categorías.')
        return
      }
      if (!centrosResp.ok) {
        setError('No se pudieron cargar los centros de costo.')
        return
      }
      if (!ingresosResp.ok) {
        setError('No se pudieron cargar los ingresos.')
        return
      }
      if (!rolResp.ok) {
        setError('No se pudo cargar el rol del usuario.')
        return
      }

      const clientesData = (clientesJson ?? []) as Cliente[]
      const cuentasData = (cuentasJson ?? []) as CuentaBancaria[]
      const categoriasData = (categoriasJson ?? []) as Categoria[]
      const centrosData = (centrosJson ?? []) as CentroCosto[]
      const ingresosBase = (ingresosJson ?? []) as Ingreso[]

      const rol =
        Array.isArray(rolJson) && rolJson.length > 0 ? rolJson[0].rol || '' : ''

      setUsuarioRol(rol)
      setIsAdmin(rol === 'admin')

      const clientesMap = new Map(clientesData.map((item) => [item.id, item.nombre]))
      const cuentasMap = new Map(
        cuentasData.map((item) => [item.id, `${item.banco} · ${item.nombre_cuenta}`])
      )
      const categoriasMap = new Map(categoriasData.map((item) => [item.id, item.nombre]))
      const centrosMap = new Map(centrosData.map((item) => [item.id, item.nombre]))

      const ingresosEnriquecidos = ingresosBase.map((item) => ({
        ...item,
        cliente_nombre: item.cliente_id ? clientesMap.get(item.cliente_id) || '-' : '-',
        categoria_nombre: item.categoria_id ? categoriasMap.get(item.categoria_id) || '-' : '-',
        centro_costo_nombre: item.centro_costo_id ? centrosMap.get(item.centro_costo_id) || '-' : '-',
        cuenta_bancaria_nombre: item.cuenta_bancaria_id ? cuentasMap.get(item.cuenta_bancaria_id) || '-' : '-',
      }))

      setClientes(clientesData)
      setCuentas(cuentasData)
      setCategorias(categoriasData)
      setCentrosCosto(centrosData)
      setIngresos(ingresosEnriquecidos)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al cargar ingresos.')
      }
    } finally {
      setLoading(false)
    }
  }, [empresaActivaId, router])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const neto = Number(formData.monto_neto || 0)
    const exento = Number(formData.monto_exento || 0)

    let iva = 0
    let total = 0

    if (formData.tratamiento_tributario === 'afecto_iva') {
      iva = Math.round(neto * IVA_RATE)
      total = neto + iva
    } else if (formData.tratamiento_tributario === 'exento') {
      iva = 0
      total = exento
    } else if (formData.tratamiento_tributario === 'mixto') {
      iva = Math.round(neto * IVA_RATE)
      total = neto + iva + exento
    }

    const nextIva = iva ? String(iva) : ''
    const nextTotal = total ? String(total) : ''

    setFormData((prev) => {
      if (prev.monto_iva === nextIva && prev.monto_total === nextTotal) {
        return prev
      }
      return {
        ...prev,
        monto_iva: nextIva,
        monto_total: nextTotal,
      }
    })
  }, [formData.tratamiento_tributario, formData.monto_neto, formData.monto_exento])

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setFormData(buildInitialForm())
    setEditingId(null)
  }

  const openNewModal = () => {
    if (!isAdmin) return
    resetForm()
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleEdit = (item: Ingreso) => {
    if (!isAdmin) return

    const tratamiento = inferTratamientoTributario(item)

    setError('')
    setSuccess('')
    setEditingId(item.id)
    setFormData({
      fecha: item.fecha || new Date().toISOString().slice(0, 10),
      tipo_documento: item.tipo_documento || 'factura',
      numero_documento: item.numero_documento || '',
      descripcion: item.descripcion || '',
      tratamiento_tributario: tratamiento,
      monto_neto: String(Number(item.monto_neto || 0) || ''),
      monto_exento: String(Number(item.monto_exento || 0) || ''),
      monto_iva: String(Number(item.monto_iva || 0) || ''),
      impuesto_especifico: String(Number(item.impuesto_especifico || 0) || '0'),
      monto_total: String(item.monto_total || ''),
      estado: item.estado || 'pendiente',
      cliente_id: item.cliente_id || '',
      categoria_id: item.categoria_id || '',
      centro_costo_id: item.centro_costo_id || '',
      cuenta_bancaria_id: item.cuenta_bancaria_id || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!isAdmin) {
      setError('Solo el administrador puede registrar o modificar ingresos.')
      return
    }
    if (!empresaActivaId) {
      setError('No hay empresa activa seleccionada.')
      return
    }
    if (!formData.fecha || !formData.descripcion) {
      setError('Complete los campos obligatorios del ingreso.')
      return
    }

    const neto = Number(formData.monto_neto || 0)
    const exento = Number(formData.monto_exento || 0)
    const iva = Number(formData.monto_iva || 0)
    const total = Number(formData.monto_total || 0)

    if (formData.tratamiento_tributario === 'afecto_iva' && neto <= 0) {
      setError('Debes ingresar un monto neto afecto mayor a 0.')
      return
    }
    if (formData.tratamiento_tributario === 'exento' && exento <= 0) {
      setError('Debes ingresar un monto exento mayor a 0.')
      return
    }
    if (formData.tratamiento_tributario === 'mixto') {
      if (neto <= 0) {
        setError('Debes ingresar un monto neto afecto mayor a 0 para un documento mixto.')
        return
      }
      if (exento <= 0) {
        setError('Debes ingresar un monto exento mayor a 0 para un documento mixto.')
        return
      }
    }
    if (total <= 0) {
      setError('El monto total debe ser mayor a 0.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const userId = sessionData.session.user.id
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const updatedAt = new Date().toISOString()

      const basePayload = {
        empresa_id: empresaActivaId,
        tipo_movimiento: 'ingreso',
        fecha: formData.fecha,
        tipo_documento: formData.tipo_documento || null,
        numero_documento: formData.numero_documento || null,
        descripcion: formData.descripcion,
        tratamiento_tributario: formData.tratamiento_tributario,
        monto_neto: formData.tratamiento_tributario === 'exento' ? 0 : neto,
        monto_exento: formData.tratamiento_tributario === 'afecto_iva' ? 0 : exento,
        monto_iva: iva,
        impuesto_especifico: 0,
        monto_total: total,
        estado: formData.estado,
        cliente_id: formData.cliente_id || null,
        categoria_id: formData.categoria_id || null,
        centro_costo_id: formData.centro_costo_id || null,
        cuenta_bancaria_id: formData.cuenta_bancaria_id || null,
        updated_by: userId,
        updated_at: updatedAt,
      }

      const isEditing = Boolean(editingId)
      const payload = isEditing
        ? basePayload
        : {
            ...basePayload,
            created_by: userId,
            activo: true,
            deleted_at: null,
            deleted_by: null,
          }

      const url = isEditing
        ? `${baseUrl}/rest/v1/movimientos?id=eq.${editingId}&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&activo=eq.true&deleted_at=is.null`
        : `${baseUrl}/rest/v1/movimientos`
      const method = isEditing ? 'PATCH' : 'POST'

      const resp = await fetch(url, {
        method,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })

      const json = await resp.json()

      if (!resp.ok) {
        console.error(json)
        setError(isEditing ? 'No se pudo actualizar el ingreso.' : 'No se pudo registrar el ingreso.')
        return
      }

      setSuccess(isEditing ? 'Ingreso actualizado correctamente.' : 'Ingreso registrado correctamente.')
      closeModal()
      await loadData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al guardar el ingreso.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleArchivar = async (item: Ingreso) => {
    if (!isAdmin) {
      setError('Solo el administrador puede archivar ingresos.')
      return
    }

    const confirmacion = window.confirm(
      `¿Desea archivar el ingreso "${item.descripcion}"? No se borrará de la base de datos.`
    )
    if (!confirmacion) return

    try {
      setError('')
      setSuccess('')

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const userId = sessionData.session.user.id
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const deletedAt = new Date().toISOString()

      const resp = await fetch(
        `${baseUrl}/rest/v1/movimientos?id=eq.${item.id}&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&activo=eq.true&deleted_at=is.null`,
        {
          method: 'PATCH',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            estado: 'anulado',
            activo: false,
            deleted_at: deletedAt,
            deleted_by: userId,
            updated_by: userId,
            updated_at: deletedAt,
          }),
        }
      )

      const json = await resp.json()
      if (!resp.ok) {
        console.error(json)
        setError('No se pudo archivar el ingreso.')
        return
      }

      if (editingId === item.id) closeModal()

      setSuccess('Ingreso archivado correctamente.')
      await loadData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al archivar el ingreso.')
      }
    }
  }

  const ingresosFiltrados = useMemo(() => {
    return ingresos.filter((item) => {
      const estado = (item.estado || '').toLowerCase()
      const numeroDocumento = (item.numero_documento || '').toLowerCase()
      const descripcion = (item.descripcion || '').toLowerCase()
      const clienteId = item.cliente_id || ''
      const fecha = item.fecha || ''
      const search = filters.texto.trim().toLowerCase()

      const matchesEstado = filters.estado === 'todos' || estado === filters.estado
      const matchesDesde = !filters.fechaDesde || fecha >= filters.fechaDesde
      const matchesHasta = !filters.fechaHasta || fecha <= filters.fechaHasta
      const matchesNumero = !filters.numeroDocumento || numeroDocumento.includes(filters.numeroDocumento.toLowerCase())
      const matchesCliente = !filters.clienteId || clienteId === filters.clienteId
      const matchesTexto =
        !search ||
        descripcion.includes(search) ||
        numeroDocumento.includes(search) ||
        (item.cliente_nombre || '').toLowerCase().includes(search) ||
        (item.categoria_nombre || '').toLowerCase().includes(search)

      return matchesEstado && matchesDesde && matchesHasta && matchesNumero && matchesCliente && matchesTexto
    })
  }, [ingresos, filters])

  const totalIngresos = useMemo(
    () => ingresosFiltrados.reduce((acc, item) => acc + Number(item.monto_total || 0), 0),
    [ingresosFiltrados]
  )

  const ingresosPendientes = useMemo(
    () => ingresosFiltrados.filter((item) => (item.estado || '').toLowerCase() === 'pendiente').length,
    [ingresosFiltrados]
  )

  const ingresosPagados = useMemo(
    () => ingresosFiltrados.filter((item) => (item.estado || '').toLowerCase() === 'pagado').length,
    [ingresosFiltrados]
  )

  const ingresosAnulados = useMemo(
    () => ingresosFiltrados.filter((item) => (item.estado || '').toLowerCase() === 'anulado').length,
    [ingresosFiltrados]
  )

  return (
    <ProtectedModuleRoute moduleKey="ingresos">
      <main className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">Ingresos</h1>
            <p className="mt-2 text-slate-600">
              Registro, control y seguimiento de ingresos de la empresa activa.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={openNewModal}
                className="rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#245C90]"
              >
                Nuevo ingreso
              </button>
            ) : null}

            <Link
              href="/reportes"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Ver reporte de ingresos
            </Link>
          </div>
        </div>

        <EmpresaActivaBanner
          modulo="Ingresos"
          descripcion="Todos los registros visibles corresponden únicamente a la empresa activa seleccionada."
        />

        {!isAdmin && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El usuario actual tiene rol{' '}
            <span className="font-semibold">{usuarioRol || 'sin rol asignado'}</span>.
            Solo el administrador puede registrar, editar o anular ingresos.
          </div>
        ) : null}

        <section className="rounded-2xl border-2 border-[#163A5F] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">Filtros de ingresos</h2>
            <p className="text-sm text-slate-500">
              Busca por fecha, documento, cliente o descripción.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
              <select
                value={filters.estado}
                onChange={(e) => setFilters((prev) => ({ ...prev, estado: e.target.value as FiltroEstado }))}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
                <option value="anulado">Anulado</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Desde</label>
              <input
                type="date"
                value={filters.fechaDesde}
                onChange={(e) => setFilters((prev) => ({ ...prev, fechaDesde: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                type="date"
                value={filters.fechaHasta}
                onChange={(e) => setFilters((prev) => ({ ...prev, fechaHasta: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">N° documento</label>
              <input
                type="text"
                value={filters.numeroDocumento}
                onChange={(e) => setFilters((prev) => ({ ...prev, numeroDocumento: e.target.value }))}
                placeholder="Ej: 12345"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
              <select
                value={filters.clienteId}
                onChange={(e) => setFilters((prev) => ({ ...prev, clienteId: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              >
                <option value="">Todos</option>
                {clientes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Buscar</label>
              <input
                type="text"
                value={filters.texto}
                onChange={(e) => setFilters((prev) => ({ ...prev, texto: e.target.value }))}
                placeholder="Descripción, cliente o categoría"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              />
            </div>
          </div>
        </section>

        {!loading && !error ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total ingresos filtrados</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">{formatCLP(totalIngresos)}</h2>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-amber-700">Pendientes</p>
              <h2 className="mt-2 text-3xl font-semibold text-amber-900">{ingresosPendientes}</h2>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-sm text-emerald-700">Pagados</p>
              <h2 className="mt-2 text-3xl font-semibold text-emerald-900">{ingresosPagados}</h2>
            </article>
            <article className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <p className="text-sm text-slate-600">Anulados</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">{ingresosAnulados}</h2>
            </article>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Listado de ingresos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Historial filtrado de ingresos registrados para la empresa activa.
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {ingresosFiltrados.length} registro(s)
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Cargando ingresos...</p>
          ) : ingresosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500">No hay ingresos para los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Documento</th>
                    <th className="py-3 pr-4">Descripción</th>
                    <th className="py-3 pr-4">Cliente</th>
                    <th className="py-3 pr-4">Categoría</th>
                    <th className="py-3 pr-4">Centro costo</th>
                    <th className="py-3 pr-4">Cuenta bancaria</th>
                    <th className="py-3 pr-4">Tratamiento</th>
                    <th className="py-3 pr-4 text-right">Monto</th>
                    <th className="py-3 pr-4">Estado</th>
                    {isAdmin ? <th className="py-3 pr-4 text-right">Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {ingresosFiltrados.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDate(item.fecha)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{item.tipo_documento || '-'}</div>
                        <div className="text-slate-500">{item.numero_documento || '-'}</div>
                      </td>
                      <td className="py-3 pr-4 min-w-[260px]">{item.descripcion}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{item.cliente_nombre || '-'}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{item.categoria_nombre || '-'}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{item.centro_costo_nombre || '-'}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{item.cuenta_bancaria_nombre || '-'}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{formatTratamientoTributario(item.tratamiento_tributario)}</td>
                      <td className="py-3 pr-4 text-right font-medium">{formatCLP(item.monto_total)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={item.estado} /></td>
                      {isAdmin ? (
                        <td className="py-3 pr-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleArchivar(item)}
                              className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Archivar
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <FormModal
          open={showModal}
          onClose={closeModal}
          title={editingId ? 'Editar ingreso' : 'Nuevo ingreso'}
          subtitle={editingId ? 'Modifique los datos del ingreso seleccionado.' : 'Registre un nuevo movimiento de ingreso para la empresa activa.'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
                <input
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo documento</label>
                <select
                  name="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                >
                  <option value="factura">Factura</option>
                  <option value="boleta">Boleta</option>
                  <option value="recibo">Recibo</option>
                  <option value="otro">Otro</option>
                  <option value="nota_credito">Nota de crédito</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Número documento</label>
                <input
                  type="text"
                  name="numero_documento"
                  value={formData.numero_documento}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  placeholder="Ej: 12345"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
                <select
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="anulado">Anulado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                className="min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                placeholder="Detalle del ingreso"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tratamiento tributario</label>
              <select
                name="tratamiento_tributario"
                value={formData.tratamiento_tributario}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
              >
                <option value="afecto_iva">Con IVA</option>
                <option value="exento">Exento de IVA</option>
                <option value="mixto">Con IVA + Exento IVA</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Neto afecto</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  name="monto_neto"
                  value={formData.monto_neto}
                  onChange={handleChange}
                  disabled={formData.tratamiento_tributario === 'exento'}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Monto exento</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  name="monto_exento"
                  value={formData.monto_exento}
                  onChange={handleChange}
                  disabled={formData.tratamiento_tributario === 'afecto_iva'}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">IVA</label>
                <input
                  type="number"
                  name="monto_iva"
                  value={formData.monto_iva}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Total</label>
                <input
                  type="number"
                  name="monto_total"
                  value={formData.monto_total}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
                <select
                  name="cliente_id"
                  value={formData.cliente_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                >
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((item) => (
                    <option key={item.id} value={item.id}>{item.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
                <select
                  name="categoria_id"
                  value={formData.categoria_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((item) => (
                    <option key={item.id} value={item.id}>{item.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Centro de costo</label>
                <select
                  name="centro_costo_id"
                  value={formData.centro_costo_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                >
                  <option value="">Seleccionar centro de costo</option>
                  {centrosCosto.map((item) => (
                    <option key={item.id} value={item.id}>{item.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cuenta bancaria</label>
                <select
                  name="cuenta_bancaria_id"
                  value={formData.cuenta_bancaria_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                >
                  <option value="">Seleccionar cuenta</option>
                  {cuentas.map((item) => (
                    <option key={item.id} value={item.id}>{item.banco} · {item.nombre_cuenta}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#245C90] disabled:opacity-70"
              >
                {saving ? (editingId ? 'Actualizando...' : 'Guardando...') : editingId ? 'Actualizar ingreso' : 'Registrar ingreso'}
              </button>
            </div>
          </form>
        </FormModal>
      </main>
    </ProtectedModuleRoute>
  )
}
