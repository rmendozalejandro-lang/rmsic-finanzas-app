'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export type ClienteQuickCreated = {
  id: string
  nombre: string
}

type ClienteQuickCreateForm = {
  nombre: string
  rut: string
  contacto: string
  email: string
  telefono: string
  direccion: string
}

type ClienteQuickCreateModalProps = {
  open: boolean
  empresaId: string
  title?: string
  description?: string
  defaultEstadoComercial?: 'prospecto' | 'cliente_activo' | 'inactivo'
  onClose: () => void
  onCreated: (cliente: ClienteQuickCreated) => void
}

const EMPTY_FORM: ClienteQuickCreateForm = {
  nombre: '',
  rut: '',
  contacto: '',
  email: '',
  telefono: '',
  direccion: '',
}

export default function ClienteQuickCreateModal({
  open,
  empresaId,
  title = 'Nuevo cliente / mandante',
  description = 'Crea el cliente para la empresa activa y selecciónalo automáticamente.',
  defaultEstadoComercial = 'cliente_activo',
  onClose,
  onCreated,
}: ClienteQuickCreateModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<ClienteQuickCreateForm>(EMPTY_FORM)

  if (!open) return null

  const closeModal = () => {
    if (saving) return
    setError('')
    setForm(EMPTY_FORM)
    onClose()
  }

  const handleChange = <K extends keyof ClienteQuickCreateForm>(
    field: K,
    value: ClienteQuickCreateForm[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nombre = form.nombre.trim()

    if (!empresaId) {
      setError('No se detectó empresa activa para crear el cliente.')
      return
    }

    if (!nombre) {
      setError('Debes ingresar el nombre o razón social del cliente.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        empresa_id: empresaId,
        nombre,
        rut: form.rut.trim() || null,
        contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        estado_comercial: defaultEstadoComercial,
        condicion_pago: 'contado',
        activo: true,
      }

      const { data, error: insertError } = await supabase
        .from('clientes')
        .insert(payload)
        .select('id, nombre')
        .single()

      if (insertError) {
        throw new Error(`No se pudo crear el cliente: ${insertError.message}`)
      }

      if (!data?.id) {
        throw new Error('El cliente fue creado, pero no se pudo obtener su identificador.')
      }

      const nuevoCliente: ClienteQuickCreated = {
        id: data.id,
        nombre: data.nombre,
      }

      onCreated(nuevoCliente)
      setForm(EMPTY_FORM)
      setError('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nombre / razón social *
              </label>
              <input
                value={form.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Ej: Softys / CMPC Tissue"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">RUT</label>
              <input
                value={form.rut}
                onChange={(e) => handleChange('rut', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Opcional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Contacto</label>
              <input
                value={form.contacto}
                onChange={(e) => handleChange('contacto', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Responsable o contacto principal"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="correo@cliente.cl"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => handleChange('telefono', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="+56 9 ..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Dirección</label>
              <input
                value={form.direccion}
                onChange={(e) => handleChange('direccion', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Opcional"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Guardando cliente...' : 'Guardar y seleccionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
