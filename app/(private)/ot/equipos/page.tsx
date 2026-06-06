'use client'

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'

type Cliente = {
  id: string
  nombre: string
  rut: string | null
}

type Equipo = {
  id: string
  empresa_id: string
  cliente_id: string | null
  cliente_nombre: string | null
  cliente_rut: string | null
  tag: string
  nombre: string | null
  descripcion: string | null
  tipo_equipo: string | null
  planta: string | null
  area: string | null
  linea: string | null
  ubicacion: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  potencia: string | null
  criticidad: string | null
  estado: string
  observaciones: string | null
  activo: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type EquipoForm = {
  cliente_id: string
  tag: string
  nombre: string
  descripcion: string
  tipo_equipo: string
  planta: string
  area: string
  linea: string
  ubicacion: string
  marca: string
  modelo: string
  serie: string
  potencia: string
  criticidad: string
  estado: string
  observaciones: string
  activo: string
}

const STORAGE_KEY = 'empresa_activa_id'

const initialForm: EquipoForm = {
  cliente_id: '',
  tag: '',
  nombre: '',
  descripcion: '',
  tipo_equipo: 'motor',
  planta: '',
  area: '',
  linea: '',
  ubicacion: '',
  marca: '',
  modelo: '',
  serie: '',
  potencia: '',
  criticidad: 'media',
  estado: 'activo',
  observaciones: '',
  activo: 'true',
}

const estadoLabels: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  fuera_servicio: 'Fuera de servicio',
  baja: 'Baja',
}

const criticidadLabels: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

function normalizarTexto(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function estadoBadgeClass(estado: string) {
  if (estado === 'activo') return 'bg-green-50 text-green-700 border-green-200'
  if (estado === 'fuera_servicio') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (estado === 'baja') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function criticidadBadgeClass(criticidad: string | null) {
  if (criticidad === 'critica') return 'bg-red-50 text-red-700 border-red-200'
  if (criticidad === 'alta') return 'bg-orange-50 text-orange-700 border-orange-200'
  if (criticidad === 'media') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

export default function OTEquiposPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])

  const [form, setForm] = useState<EquipoForm>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      setEmpresaActivaId(window.localStorage.getItem(STORAGE_KEY) || '')
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  const resetForm = () => {
    setForm(initialForm)
    setEditingId(null)
    setError('')
    setSuccess('')
  }

  const fetchData = async () => {
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

      const [clientesResp, equiposResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&activo=eq.true&deleted_at=is.null&select=id,nombre,rut&order=nombre.asc`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        ),
        fetch(
          `${baseUrl}/rest/v1/ot_vw_equipos?empresa_id=eq.${empresaActivaId}&deleted_at=is.null&select=*&order=tag.asc`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        ),
      ])

      const clientesJson = await clientesResp.json()
      const equiposJson = await equiposResp.json()

      if (!clientesResp.ok) {
        console.error(clientesJson)
        throw new Error('No se pudieron cargar los clientes.')
      }

      if (!equiposResp.ok) {
        console.error(equiposJson)
        throw new Error('No se pudieron cargar los equipos.')
      }

      setClientes(clientesJson ?? [])
      setEquipos(equiposJson ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [empresaActivaId, router])

  const equiposFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda)

    if (!q) return equipos

    return equipos.filter((equipo) => {
      const texto = [
        equipo.tag,
        equipo.nombre,
        equipo.descripcion,
        equipo.cliente_nombre,
        equipo.planta,
        equipo.area,
        equipo.linea,
        equipo.ubicacion,
        equipo.tipo_equipo,
        equipo.marca,
        equipo.modelo,
      ]
        .map(normalizarTexto)
        .join(' ')

      return texto.includes(q)
    })
  }, [equipos, busqueda])

  const totalActivos = equipos.filter((item) => item.activo && item.estado === 'activo').length
  const totalInactivos = equipos.filter((item) => !item.activo || item.estado !== 'activo').length

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const startEdit = (equipo: Equipo) => {
    setEditingId(equipo.id)
    setError('')
    setSuccess('')

    setForm({
      cliente_id: equipo.cliente_id || '',
      tag: equipo.tag || '',
      nombre: equipo.nombre || '',
      descripcion: equipo.descripcion || '',
      tipo_equipo: equipo.tipo_equipo || 'motor',
      planta: equipo.planta || '',
      area: equipo.area || '',
      linea: equipo.linea || '',
      ubicacion: equipo.ubicacion || '',
      marca: equipo.marca || '',
      modelo: equipo.modelo || '',
      serie: equipo.serie || '',
      potencia: equipo.potencia || '',
      criticidad: equipo.criticidad || 'media',
      estado: equipo.estado || 'activo',
      observaciones: equipo.observaciones || '',
      activo: equipo.activo ? 'true' : 'false',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!empresaActivaId) {
      setError('Debes seleccionar una empresa activa.')
      return
    }

    if (!form.tag.trim()) {
      setError('Debes ingresar el TAG del equipo.')
      return
    }

    try {
      setSaving(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const { data: userData } = await supabase.auth.getUser()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const userId = userData.user?.id || null

      const payload = {
        empresa_id: empresaActivaId,
        cliente_id: form.cliente_id || null,
        tag: form.tag.trim(),
        nombre: form.nombre.trim() || null,
        descripcion: form.descripcion.trim() || null,
        tipo_equipo: form.tipo_equipo.trim() || 'motor',
        planta: form.planta.trim() || null,
        area: form.area.trim() || null,
        linea: form.linea.trim() || null,
        ubicacion: form.ubicacion.trim() || null,
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        serie: form.serie.trim() || null,
        potencia: form.potencia.trim() || null,
        criticidad: form.criticidad || 'media',
        estado: form.estado || 'activo',
        observaciones: form.observaciones.trim() || null,
        activo: form.activo === 'true',
        updated_by: userId,
        ...(editingId ? {} : { created_by: userId }),
      }

      const url = editingId
        ? `${baseUrl}/rest/v1/ot_equipos?id=eq.${editingId}`
        : `${baseUrl}/rest/v1/ot_equipos`

      const method = editingId ? 'PATCH' : 'POST'

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

      const json = await resp.json().catch(() => null)

      if (!resp.ok) {
        console.error(json)

        const message = JSON.stringify(json || '').toLowerCase()

        if (message.includes('ot_equipos_empresa_tag_unique')) {
          throw new Error('Ya existe un equipo con ese TAG en esta empresa.')
        }

        throw new Error(editingId ? 'No se pudo actualizar el equipo.' : 'No se pudo crear el equipo.')
      }

      setSuccess(editingId ? 'Equipo actualizado correctamente.' : 'Equipo creado correctamente.')
      resetForm()
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el equipo.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (equipo: Equipo) => {
    const nuevoActivo = !equipo.activo
    const confirmar = window.confirm(
      nuevoActivo
        ? `¿Deseas activar el equipo ${equipo.tag}?`
        : `¿Deseas inactivar el equipo ${equipo.tag}?`
    )

    if (!confirmar) return

    try {
      setUpdatingId(equipo.id)
      setError('')
      setSuccess('')

      const { data: sessionData } = await supabase.auth.getSession()
      const { data: userData } = await supabase.auth.getUser()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const resp = await fetch(`${baseUrl}/rest/v1/ot_equipos?id=eq.${equipo.id}`, {
        method: 'PATCH',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          activo: nuevoActivo,
          estado: nuevoActivo ? 'activo' : 'inactivo',
          updated_by: userData.user?.id || null,
        }),
      })

      const json = await resp.json().catch(() => null)

      if (!resp.ok) {
        console.error(json)
        throw new Error('No se pudo actualizar el estado del equipo.')
      }

      setSuccess(nuevoActivo ? 'Equipo activado correctamente.' : 'Equipo inactivado correctamente.')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el equipo.')
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <main className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              OT / Mantenimiento
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-slate-900">
              Maestro de equipos
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Carga y administra motores, equipos o activos por TAG para generar órdenes de trabajo
              independientes por equipo.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Resumen
            </p>
            <div className="mt-2 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{equipos.length}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-green-700">{totalActivos}</p>
                <p className="text-xs text-slate-500">Activos</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-700">{totalInactivos}</p>
                <p className="text-xs text-slate-500">Otros</p>
              </div>
            </div>
          </div>
        </div>

        {!empresaActivaId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Debes seleccionar una empresa activa para administrar equipos.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Equipos registrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Busca por TAG, descripción, cliente, planta, área o ubicación.
                </p>
              </div>

              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar equipo..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm md:max-w-xs"
              />
            </div>

            <div className="mt-6 overflow-x-auto">
              {loading ? (
                <div className="text-sm text-slate-500">Cargando equipos...</div>
              ) : equiposFiltrados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No hay equipos registrados o no hay coincidencias para la búsqueda.
                </div>
              ) : (
                <table className="min-w-[1100px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">TAG</th>
                      <th className="py-3 pr-4">Equipo</th>
                      <th className="py-3 pr-4">Cliente</th>
                      <th className="py-3 pr-4">Ubicación</th>
                      <th className="py-3 pr-4">Tipo</th>
                      <th className="py-3 pr-4">Criticidad</th>
                      <th className="py-3 pr-4">Estado</th>
                      <th className="py-3 pr-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equiposFiltrados.map((equipo) => (
                      <tr key={equipo.id} className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-4 font-semibold text-slate-900">
                          {equipo.tag}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-900">
                            {equipo.nombre || equipo.descripcion || '-'}
                          </div>
                          {equipo.descripcion && equipo.nombre ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {equipo.descripcion}
                            </div>
                          ) : null}
                          {(equipo.marca || equipo.modelo || equipo.potencia) && (
                            <div className="mt-1 text-xs text-slate-500">
                              {[equipo.marca, equipo.modelo, equipo.potencia].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {equipo.cliente_nombre || '-'}
                          {equipo.cliente_rut ? (
                            <div className="text-xs text-slate-500">{equipo.cliente_rut}</div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          {[equipo.planta, equipo.area, equipo.linea, equipo.ubicacion]
                            .filter(Boolean)
                            .join(' / ') || '-'}
                        </td>
                        <td className="py-3 pr-4 capitalize">
                          {equipo.tipo_equipo || '-'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${criticidadBadgeClass(equipo.criticidad)}`}>
                            {criticidadLabels[equipo.criticidad || 'media'] || equipo.criticidad || 'Media'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadgeClass(equipo.estado)}`}>
                            {estadoLabels[equipo.estado] || equipo.estado}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(equipo)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === equipo.id}
                              onClick={() => toggleActivo(equipo)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {updatingId === equipo.id
                                ? 'Guardando...'
                                : equipo.activo
                                ? 'Inactivar'
                                : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
              {editingId ? 'Editar equipo' : 'Nuevo equipo'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Registra motores o activos con TAG para asociarlos a futuras OT.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cliente
                </label>
                <select
                  name="cliente_id"
                  value={form.cliente_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="">Sin cliente asignado</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                      {cliente.rut ? ` · ${cliente.rut}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    TAG
                  </label>
                  <input
                    name="tag"
                    value={form.tag}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="Ej: 352 MP 02"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo equipo
                  </label>
                  <input
                    name="tipo_equipo"
                    value={form.tipo_equipo}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="motor"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nombre corto
                </label>
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Motor ventilador"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder="Descripción técnica del equipo"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Planta
                  </label>
                  <input
                    name="planta"
                    value={form.planta}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="Talagante"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Área
                  </label>
                  <input
                    name="area"
                    value={form.area}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="Mantención"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Línea
                  </label>
                  <input
                    name="linea"
                    value={form.linea}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="Línea 352"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ubicación
                  </label>
                  <input
                    name="ubicacion"
                    value={form.ubicacion}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="Sector ventiladores"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Marca
                  </label>
                  <input
                    name="marca"
                    value={form.marca}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Modelo
                  </label>
                  <input
                    name="modelo"
                    value={form.modelo}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Serie
                  </label>
                  <input
                    name="serie"
                    value={form.serie}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Potencia
                  </label>
                  <input
                    name="potencia"
                    value={form.potencia}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    placeholder="Ej: 15 HP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Criticidad
                  </label>
                  <select
                    name="criticidad"
                    value={form.criticidad}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Estado
                  </label>
                  <select
                    name="estado"
                    value={form.estado}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="fuera_servicio">Fuera de servicio</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Activo en sistema
                </label>
                <select
                  name="activo"
                  value={form.activo}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Observaciones
                </label>
                <textarea
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !empresaActivaId}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving
                    ? 'Guardando...'
                    : editingId
                    ? 'Actualizar equipo'
                    : 'Crear equipo'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </main>
    </ProtectedModuleRoute>
  )
}



