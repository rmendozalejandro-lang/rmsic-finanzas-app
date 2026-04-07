'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'

type Cliente = {
  id: string
  empresa_id: string
  nombre: string
  rut: string | null
  contacto: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  activo: boolean
  created_at: string
}

const STORAGE_KEY = 'empresa_activa_id'

export default function ClientesPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    rut: '',
    contacto: '',
    email: '',
    telefono: '',
    direccion: '',
    activo: 'true',
  })

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

  const resetForm = () => {
    setForm({
      nombre: '',
      rut: '',
      contacto: '',
      email: '',
      telefono: '',
      direccion: '',
      activo: 'true',
    })
    setEditingId(null)
  }

  const fetchClientes = async () => {
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
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const resp = await fetch(
        `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&select=*&order=nombre.asc`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const json = await resp.json()

      if (!resp.ok) {
        console.error(json)
        setError('No se pudieron cargar los clientes.')
        return
      }

      setClientes(json ?? [])
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

  useEffect(() => {
    fetchClientes()
  }, [router, empresaActivaId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const startEdit = (cliente: Cliente) => {
    setEditingId(cliente.id)
    setError('')
    setSuccess('')
    setForm({
      nombre: cliente.nombre ?? '',
      rut: cliente.rut ?? '',
      contacto: cliente.contacto ?? '',
      email: cliente.email ?? '',
      telefono: cliente.telefono ?? '',
      direccion: cliente.direccion ?? '',
      activo: cliente.activo ? 'true' : 'false',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!empresaActivaId) {
      setError('Debes seleccionar una empresa activa.')
      return
    }

    if (!form.nombre.trim()) {
      setError('Debes ingresar el nombre del cliente.')
      return
    }

    try {
      setSaving(true)

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
        nombre: form.nombre.trim(),
        rut: form.rut.trim() || null,
        contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        activo: form.activo === 'true',
      }

      const url = editingId
        ? `${baseUrl}/rest/v1/clientes?id=eq.${editingId}`
        : `${baseUrl}/rest/v1/clientes`

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
        setError(
          editingId
            ? 'No se pudo actualizar el cliente.'
            : 'No se pudo guardar el cliente.'
        )
        return
      }

      setSuccess(
        editingId
          ? 'Cliente actualizado correctamente.'
          : 'Cliente registrado correctamente.'
      )
      resetForm()
      await fetchClientes()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al guardar.')
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (cliente: Cliente) => {
    const accion = cliente.activo ? 'inactivar' : 'activar'
    const confirmar = window.confirm(`¿Deseas ${accion} este cliente?`)

    if (!confirmar) return

    try {
      setUpdatingId(cliente.id)
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
        `${baseUrl}/rest/v1/clientes?id=eq.${cliente.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            activo: !cliente.activo,
          }),
        }
      )

      const json = await resp.json().catch(() => null)

      if (!resp.ok) {
        console.error(json)
        setError('No se pudo actualizar el estado del cliente.')
        return
      }

      setSuccess(
        !cliente.activo
          ? 'Cliente activado correctamente.'
          : 'Cliente inactivado correctamente.'
      )

      if (editingId === cliente.id) {
        setForm((prev) => ({
          ...prev,
          activo: !cliente.activo ? 'true' : 'false',
        }))
      }

      await fetchClientes()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al actualizar.')
      }
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Clientes</h1>
        <p className="text-slate-600 mt-2">
          Administración de clientes por empresa activa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listado de clientes
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Clientes registrados para la empresa activa.
          </p>

          {loading && <div className="text-slate-500">Cargando clientes...</div>}

          {!loading && !error && clientes.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay clientes registrados para esta empresa.
            </div>
          )}

          {!loading && !error && clientes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Nombre</th>
                    <th className="py-3 pr-4">RUT</th>
                    <th className="py-3 pr-4">Contacto</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Teléfono</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium">{item.nombre}</td>
                      <td className="py-3 pr-4">{item.rut ?? '-'}</td>
                      <td className="py-3 pr-4">{item.contacto ?? '-'}</td>
                      <td className="py-3 pr-4">{item.email ?? '-'}</td>
                      <td className="py-3 pr-4">{item.telefono ?? '-'}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={item.activo ? 'activo' : 'inactivo'} />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleActivo(item)}
                            disabled={updatingId === item.id}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {updatingId === item.id
                              ? 'Guardando...'
                              : item.activo
                              ? 'Inactivar'
                              : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            {editingId ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            {editingId
              ? 'Actualiza la información del cliente.'
              : 'Crea un cliente sin entrar a Supabase.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">RUT</label>
              <input
                type="text"
                name="rut"
                value={form.rut}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Contacto</label>
              <input
                type="text"
                name="contacto"
                value={form.contacto}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Teléfono</label>
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Dirección</label>
              <textarea
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Estado</label>
              <select
                name="activo"
                value={form.activo}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-slate-900 text-white py-3 font-medium disabled:opacity-60"
              >
                {saving
                  ? 'Guardando...'
                  : editingId
                  ? 'Actualizar cliente'
                  : 'Guardar cliente'}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 px-4 py-3 font-medium"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}