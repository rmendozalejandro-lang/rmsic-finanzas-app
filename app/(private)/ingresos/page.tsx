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

type Ingreso = {
  id: string
  fecha: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
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
}

type FormData = {
  fecha: string
  tipo_documento: string
  numero_documento: string
  descripcion: string
  monto_total: string
  estado: string
  cliente_id: string
  categoria_id: string
  centro_costo_id: string
  cuenta_bancaria_id: string
}

type FiltroEstado = 'todos' | 'pendiente' | 'pagado' | 'anulado'

const STORAGE_KEY = 'empresa_activa_id'

const buildInitialForm = (): FormData => ({
  fecha: new Date().toISOString().slice(0, 10),
  tipo_documento: 'factura',
  numero_documento: '',
  descripcion: '',
  monto_total: '',
  estado: 'pendiente',
  cliente_id: '',
  categoria_id: '',
  centro_costo_id: '',
  cuenta_bancaria_id: '',
})

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatDate = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CL')
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
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [usuarioRol, setUsuarioRol] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

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
          `${baseUrl}/rest/v1/clientes?select=id,nombre&empresa_id=eq.${empresaActivaId}&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?select=id,banco,nombre_cuenta&empresa_id=eq.${empresaActivaId}&order=banco.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/categorias?select=id,empresa_id,nombre,tipo,clasificacion_financiera,activa&empresa_id=eq.${empresaActivaId}&tipo=eq.ingreso&activa=eq.true&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/centros_costo?select=id,empresa_id,nombre&empresa_id=eq.${empresaActivaId}&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_documento,numero_documento,descripcion,monto_total,estado,cliente_id,categoria_id,centro_costo_id,cuenta_bancaria_id,empresa_id&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&order=fecha.desc`,
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

      const rol = Array.isArray(rolJson) && rolJson.length > 0 ? rolJson[0].rol || '' : ''
      setUsuarioRol(rol)
      setIsAdmin(rol === 'admin')

      const clientesMap = new Map(
        clientesData.map((item) => [item.id, item.nombre])
      )
      const cuentasMap = new Map(
        cuentasData.map((item) => [item.id, `${item.banco} · ${item.nombre_cuenta}`])
      )
      const categoriasMap = new Map(
        categoriasData.map((item) => [item.id, item.nombre])
      )
      const centrosMap = new Map(
        centrosData.map((item) => [item.id, item.nombre])
      )

      const ingresosEnriquecidos = ingresosBase.map((item) => ({
        ...item,
        cliente_nombre: item.cliente_id
          ? clientesMap.get(item.cliente_id) || '-'
          : '-',
        categoria_nombre: item.categoria_id
          ? categoriasMap.get(item.categoria_id) || '-'
          : '-',
        centro_costo_nombre: item.centro_costo_id
          ? centrosMap.get(item.centro_costo_id) || '-'
          : '-',
        cuenta_bancaria_nombre: item.cuenta_bancaria_id
          ? cuentasMap.get(item.cuenta_bancaria_id) || '-'
          : '-',
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setFormData(buildInitialForm())
    setEditingId(null)
  }

  const handleEdit = (item: Ingreso) => {
    if (!isAdmin) return

    setError('')
    setSuccess('')
    setEditingId(item.id)
    setFormData({
      fecha: item.fecha || new Date().toISOString().slice(0, 10),
      tipo_documento: item.tipo_documento || 'factura',
      numero_documento: item.numero_documento || '',
      descripcion: item.descripcion || '',
      monto_total: String(item.monto_total || ''),
      estado: item.estado || 'pendiente',
      cliente_id: item.cliente_id || '',
      categoria_id: item.categoria_id || '',
      centro_costo_id: item.centro_costo_id || '',
      cuenta_bancaria_id: item.cuenta_bancaria_id || '',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    resetForm()
    setError('')
    setSuccess('')
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

    if (!formData.fecha || !formData.descripcion || !formData.monto_total) {
      setError('Complete los campos obligatorios del ingreso.')
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
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const payload = {
        empresa_id: empresaActivaId,
        tipo_movimiento: 'ingreso',
        fecha: formData.fecha,
        tipo_documento: formData.tipo_documento || null,
        numero_documento: formData.numero_documento || null,
        descripcion: formData.descripcion,
        monto_total: Number(formData.monto_total || 0),
        estado: formData.estado,
        cliente_id: formData.cliente_id || null,
        categoria_id: formData.categoria_id || null,
        centro_costo_id: formData.centro_costo_id || null,
        cuenta_bancaria_id: formData.cuenta_bancaria_id || null,
      }

      const isEditing = Boolean(editingId)

      const url = isEditing
        ? `${baseUrl}/rest/v1/movimientos?id=eq.${editingId}`
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
      resetForm()
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

  const handleAnular = async (item: Ingreso) => {
    if (!isAdmin) {
      setError('Solo el administrador puede anular ingresos.')
      return
    }

    if (item.estado?.toLowerCase() === 'anulado') return

    const confirmacion = window.confirm(
      `¿Desea anular el ingreso "${item.descripcion}"?`
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
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const resp = await fetch(
        `${baseUrl}/rest/v1/movimientos?id=eq.${item.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ estado: 'anulado' }),
        }
      )

      const json = await resp.json()

      if (!resp.ok) {
        console.error(json)
        setError('No se pudo anular el ingreso.')
        return
      }

      if (editingId === item.id) {
        resetForm()
      }

      setSuccess('Ingreso anulado correctamente.')
      await loadData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al anular el ingreso.')
      }
    }
  }

  const ingresosFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return ingresos
    return ingresos.filter(
      (item) => (item.estado || '').toLowerCase() === filtroEstado
    )
  }, [ingresos, filtroEstado])

  const totalIngresos = useMemo(
    () => ingresos.reduce((acc, item) => acc + Number(item.monto_total || 0), 0),
    [ingresos]
  )

  const ingresosPendientes = useMemo(
    () =>
      ingresos.filter((item) => (item.estado || '').toLowerCase() === 'pendiente')
        .length,
    [ingresos]
  )

  const ingresosPagados = useMemo(
    () =>
      ingresos.filter((item) => (item.estado || '').toLowerCase() === 'pagado')
        .length,
    [ingresos]
  )

  const ingresosAnulados = useMemo(
    () =>
      ingresos.filter((item) => (item.estado || '').toLowerCase() === 'anulado')
        .length,
    [ingresos]
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

          <Link
            href="/reportes"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ver reporte de ingresos
          </Link>
        </div>

        <EmpresaActivaBanner
          modulo="Ingresos"
          descripcion="Todos los registros visibles corresponden únicamente a la empresa activa seleccionada."
        />

        {!isAdmin && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El usuario actual tiene rol <span className="font-semibold">{usuarioRol || 'sin rol asignado'}</span>. Solo el administrador puede registrar, editar o anular ingresos.
          </div>
        ) : null}

        <section className="rounded-2xl border-2 border-[#163A5F] bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Filtros de ingresos
            </h2>
            <p className="text-sm text-slate-500">
              Filtre el listado por estado del ingreso.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'todos'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setFiltroEstado('pendiente')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'pendiente'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pendientes
            </button>

            <button
              onClick={() => setFiltroEstado('pagado')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'pagado'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pagados
            </button>

            <button
              onClick={() => setFiltroEstado('anulado')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'anulado'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Anulados
            </button>
          </div>
        </section>

        {!loading && !error && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total ingresos</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {formatCLP(totalIngresos)}
              </h2>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-amber-700">Pendientes</p>
              <h2 className="mt-2 text-3xl font-semibold text-amber-900">
                {ingresosPendientes}
              </h2>
            </article>

            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-sm text-emerald-700">Pagados</p>
              <h2 className="mt-2 text-3xl font-semibold text-emerald-900">
                {ingresosPagados}
              </h2>
            </article>

            <article className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <p className="text-sm text-slate-600">Anulados</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {ingresosAnulados}
              </h2>
            </article>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {isAdmin ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {editingId ? 'Editar ingreso' : 'Nuevo ingreso'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingId
                      ? 'Modifique los datos del ingreso seleccionado.'
                      : 'Registre un nuevo movimiento de ingreso para la empresa activa.'}
                  </p>
                </div>

                {editingId ? (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha
                  </label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo documento
                  </label>
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Número documento
                  </label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Descripción
                  </label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Monto total
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="monto_total"
                    value={formData.monto_total}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    placeholder="0"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Estado
                  </label>
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cliente
                  </label>
                  <select
                    name="cliente_id"
                    value={formData.cliente_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Categoría
                  </label>
                  <select
                    name="categoria_id"
                    value={formData.categoria_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Centro de costo
                  </label>
                  <select
                    name="centro_costo_id"
                    value={formData.centro_costo_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Seleccionar centro de costo</option>
                    {centrosCosto.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cuenta bancaria
                  </label>
                  <select
                    name="cuenta_bancaria_id"
                    value={formData.cuenta_bancaria_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.banco} · {item.nombre_cuenta}
                      </option>
                    ))}
                  </select>
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#245C90] disabled:opacity-70"
                >
                  {saving
                    ? editingId
                      ? 'Actualizando...'
                      : 'Guardando...'
                    : editingId
                      ? 'Actualizar ingreso'
                      : 'Registrar ingreso'}
                </button>
              </form>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
              <h2 className="text-2xl font-semibold text-slate-900">
                Acciones restringidas
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Este módulo permite visualizar y filtrar ingresos, pero solo el administrador puede registrar, editar o anular.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Listado de ingresos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Historial de ingresos registrados para la empresa activa.
              </p>
            </div>

            {loading && <div className="text-slate-500">Cargando ingresos...</div>}

            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && ingresosFiltrados.length === 0 && (
              <div className="text-sm text-slate-500">
                No hay ingresos para el filtro seleccionado.
              </div>
            )}

            {!loading && !error && ingresosFiltrados.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Documento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Cliente</th>
                      <th className="py-3 pr-4">Categoría</th>
                      <th className="py-3 pr-4">Centro costo</th>
                      <th className="py-3 pr-4">Cuenta</th>
                      <th className="py-3 pr-4">Monto</th>
                      <th className="py-3 pr-4">Estado</th>
                      {isAdmin ? <th className="py-3 pr-4">Acciones</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {ingresosFiltrados.map((item) => {
                      const isAnulado = (item.estado || '').toLowerCase() === 'anulado'

                      return (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4">{formatDate(item.fecha)}</td>
                          <td className="py-3 pr-4">
                            {item.tipo_documento || '-'} {item.numero_documento || ''}
                          </td>
                          <td className="py-3 pr-4">{item.descripcion}</td>
                          <td className="py-3 pr-4">{item.cliente_nombre || '-'}</td>
                          <td className="py-3 pr-4">{item.categoria_nombre || '-'}</td>
                          <td className="py-3 pr-4">{item.centro_costo_nombre || '-'}</td>
                          <td className="py-3 pr-4">
                            {item.cuenta_bancaria_nombre || '-'}
                          </td>
                          <td className="py-3 pr-4 font-medium">
                            {formatCLP(Number(item.monto_total))}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={item.estado} />
                          </td>

                          {isAdmin ? (
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  disabled={isAnulado}
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleAnular(item)}
                                  disabled={isAnulado}
                                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Anular
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </ProtectedModuleRoute>
  )
}