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

type Proveedor = {
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

type Egreso = {
  id: string
  fecha: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
  monto_total: number
  estado: string
  proveedor_id: string | null
  proveedor_nombre?: string | null
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
  proveedor_id: string
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
  proveedor_id: '',
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

export default function EgresosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])

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
        proveedoresResp,
        cuentasResp,
        categoriasResp,
        centrosResp,
        egresosResp,
        rolResp,
      ] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/proveedores?select=id,nombre&empresa_id=eq.${empresaActivaId}&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?select=id,banco,nombre_cuenta&empresa_id=eq.${empresaActivaId}&order=banco.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/categorias?select=id,empresa_id,nombre,tipo,clasificacion_financiera,activa&empresa_id=eq.${empresaActivaId}&tipo=eq.egreso&activa=eq.true&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/centros_costo?select=id,empresa_id,nombre&empresa_id=eq.${empresaActivaId}&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/movimientos?select=id,fecha,tipo_documento,numero_documento,descripcion,monto_total,estado,proveedor_id,categoria_id,centro_costo_id,cuenta_bancaria_id,empresa_id&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&order=fecha.desc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/usuario_empresas?select=rol&usuario_id=eq.${userId}&empresa_id=eq.${empresaActivaId}&activo=eq.true`,
          { headers }
        ),
      ])

      const proveedoresJson = await proveedoresResp.json()
      const cuentasJson = await cuentasResp.json()
      const categoriasJson = await categoriasResp.json()
      const centrosJson = await centrosResp.json()
      const egresosJson = await egresosResp.json()
      const rolJson = await rolResp.json()

      if (!proveedoresResp.ok) {
        setError('No se pudieron cargar los proveedores.')
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

      if (!egresosResp.ok) {
        setError('No se pudieron cargar los egresos.')
        return
      }

      if (!rolResp.ok) {
        setError('No se pudo cargar el rol del usuario.')
        return
      }

      const proveedoresData = (proveedoresJson ?? []) as Proveedor[]
      const cuentasData = (cuentasJson ?? []) as CuentaBancaria[]
      const categoriasData = (categoriasJson ?? []) as Categoria[]
      const centrosData = (centrosJson ?? []) as CentroCosto[]
      const egresosBase = (egresosJson ?? []) as Egreso[]

      const rol =
        Array.isArray(rolJson) && rolJson.length > 0 ? rolJson[0].rol || '' : ''
      setUsuarioRol(rol)
      setIsAdmin(rol === 'admin')

      const proveedoresMap = new Map(
        proveedoresData.map((item) => [item.id, item.nombre])
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

      const egresosEnriquecidos = egresosBase.map((item) => ({
        ...item,
        proveedor_nombre: item.proveedor_id
          ? proveedoresMap.get(item.proveedor_id) || '-'
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

      setProveedores(proveedoresData)
      setCuentas(cuentasData)
      setCategorias(categoriasData)
      setCentrosCosto(centrosData)
      setEgresos(egresosEnriquecidos)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al cargar egresos.')
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

  const handleEdit = (item: Egreso) => {
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
      proveedor_id: item.proveedor_id || '',
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
      setError('Solo el administrador puede registrar o modificar egresos.')
      return
    }

    if (!empresaActivaId) {
      setError('No hay empresa activa seleccionada.')
      return
    }

    if (!formData.fecha || !formData.descripcion || !formData.monto_total) {
      setError('Complete los campos obligatorios del egreso.')
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
        tipo_movimiento: 'egreso',
        fecha: formData.fecha,
        tipo_documento: formData.tipo_documento || null,
        numero_documento: formData.numero_documento || null,
        descripcion: formData.descripcion,
        monto_total: Number(formData.monto_total || 0),
        estado: formData.estado,
        proveedor_id: formData.proveedor_id || null,
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
        setError(
          isEditing
            ? 'No se pudo actualizar el egreso.'
            : 'No se pudo registrar el egreso.'
        )
        return
      }

      setSuccess(
        isEditing
          ? 'Egreso actualizado correctamente.'
          : 'Egreso registrado correctamente.'
      )
      resetForm()
      await loadData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al guardar el egreso.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAnular = async (item: Egreso) => {
    if (!isAdmin) {
      setError('Solo el administrador puede anular egresos.')
      return
    }

    if (item.estado?.toLowerCase() === 'anulado') return

    const confirmacion = window.confirm(
      `¿Desea anular el egreso "${item.descripcion}"?`
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
        setError('No se pudo anular el egreso.')
        return
      }

      if (editingId === item.id) {
        resetForm()
      }

      setSuccess('Egreso anulado correctamente.')
      await loadData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al anular el egreso.')
      }
    }
  }

  const egresosFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return egresos
    return egresos.filter(
      (item) => (item.estado || '').toLowerCase() === filtroEstado
    )
  }, [egresos, filtroEstado])

  const totalEgresos = useMemo(
    () => egresos.reduce((acc, item) => acc + Number(item.monto_total || 0), 0),
    [egresos]
  )

  const egresosPendientes = useMemo(
    () =>
      egresos.filter((item) => (item.estado || '').toLowerCase() === 'pendiente')
        .length,
    [egresos]
  )

  const egresosPagados = useMemo(
    () =>
      egresos.filter((item) => (item.estado || '').toLowerCase() === 'pagado')
        .length,
    [egresos]
  )

  const egresosAnulados = useMemo(
    () =>
      egresos.filter((item) => (item.estado || '').toLowerCase() === 'anulado')
        .length,
    [egresos]
  )

  return (
    <ProtectedModuleRoute moduleKey="egresos">
      <main className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">Egresos</h1>
            <p className="mt-2 text-slate-600">
              Registro, control y seguimiento de egresos de la empresa activa.
            </p>
          </div>

          <Link
            href="/reportes"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ver reporte de egresos
          </Link>
        </div>

        <EmpresaActivaBanner
          modulo="Egresos"
          descripcion="Todos los registros visibles corresponden únicamente a la empresa activa seleccionada."
        />

        {!isAdmin && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El usuario actual tiene rol <span className="font-semibold">{usuarioRol || 'sin rol asignado'}</span>. Solo el administrador puede registrar, editar o anular egresos.
          </div>
        ) : null}

        <section className="rounded-2xl border-2 border-[#163A5F] bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Filtros de egresos
            </h2>
            <p className="text-sm text-slate-500">
              Filtre el listado por estado del egreso.
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
              <p className="text-sm text-slate-500">Total egresos</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {formatCLP(totalEgresos)}
              </h2>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-amber-700">Pendientes</p>
              <h2 className="mt-2 text-3xl font-semibold text-amber-900">
                {egresosPendientes}
              </h2>
            </article>

            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-sm text-emerald-700">Pagados</p>
              <h2 className="mt-2 text-3xl font-semibold text-emerald-900">
                {egresosPagados}
              </h2>
            </article>

            <article className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <p className="text-sm text-slate-600">Anulados</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {egresosAnulados}
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
                    {editingId ? 'Editar egreso' : 'Nuevo egreso'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingId
                      ? 'Modifique los datos del egreso seleccionado.'
                      : 'Registre un nuevo movimiento de egreso para la empresa activa.'}
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
                    placeholder="Detalle del egreso"
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
                    Proveedor
                  </label>
                  <select
                    name="proveedor_id"
                    value={formData.proveedor_id}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map((item) => (
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
                      ? 'Actualizar egreso'
                      : 'Registrar egreso'}
                </button>
              </form>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
              <h2 className="text-2xl font-semibold text-slate-900">
                Acciones restringidas
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Este módulo permite visualizar y filtrar egresos, pero solo el administrador puede registrar, editar o anular.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Listado de egresos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Historial de egresos registrados para la empresa activa.
              </p>
            </div>

            {loading && <div className="text-slate-500">Cargando egresos...</div>}

            {!loading && !error && egresosFiltrados.length === 0 && (
              <div className="text-sm text-slate-500">
                No hay egresos para el filtro seleccionado.
              </div>
            )}

            {!loading && !error && egresosFiltrados.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Documento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Proveedor</th>
                      <th className="py-3 pr-4">Categoría</th>
                      <th className="py-3 pr-4">Centro costo</th>
                      <th className="py-3 pr-4">Cuenta</th>
                      <th className="py-3 pr-4">Monto</th>
                      <th className="py-3 pr-4">Estado</th>
                      {isAdmin ? <th className="py-3 pr-4">Acciones</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {egresosFiltrados.map((item) => {
                      const isAnulado = (item.estado || '').toLowerCase() === 'anulado'

                      return (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4">{formatDate(item.fecha)}</td>
                          <td className="py-3 pr-4">
                            {item.tipo_documento || '-'} {item.numero_documento || ''}
                          </td>
                          <td className="py-3 pr-4">{item.descripcion}</td>
                          <td className="py-3 pr-4">{item.proveedor_nombre || '-'}</td>
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

            {!loading && error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </ProtectedModuleRoute>
  )
}