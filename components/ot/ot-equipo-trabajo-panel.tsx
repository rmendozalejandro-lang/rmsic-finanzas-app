'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type Participante = {
  id: string
  nombre: string | null
  rol_en_trabajo: string | null
  especialidad: string | null
}

type Props = {
  otId: string
  empresaId: string
  responsableNombre?: string
  canManage?: boolean
  onChanged?: () => void
}

export function OTEquipoTrabajoPanel({
  otId,
  empresaId,
  responsableNombre,
  canManage = false,
  onChanged,
}: Props) {
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('Técnico especialista')
  const [especialidad, setEspecialidad] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('ot_orden_equipo_trabajo')
      .select('id,nombre,rol_en_trabajo,especialidad')
      .eq('empresa_id', empresaId)
      .eq('ot_id', otId)
      .eq('activo', true)
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    setParticipantes((data ?? []) as Participante[])
  }, [empresaId, otId])

  useEffect(() => {
    void load()
  }, [load])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return

    setSaving(true)
    setError('')

    const { error } = await (supabase as any)
      .from('ot_orden_equipo_trabajo')
      .insert({
        empresa_id: empresaId,
        ot_id: otId,
        usuario_id: null,
        tecnico_externo_id: null,
        nombre: nombre.trim(),
        rol_en_trabajo: rol,
        especialidad: especialidad.trim() || null,
        es_principal: false,
        activo: true,
      })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setNombre('')
    setRol('Técnico especialista')
    setEspecialidad('')
    await load()
    onChanged?.()
    setSaving(false)
  }

  async function quitar(id: string) {
    const { error } = await (supabase as any)
      .from('ot_orden_equipo_trabajo')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .eq('ot_id', otId)

    if (error) {
      setError(error.message)
      return
    }

    await load()
    onChanged?.()
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Equipo de trabajo</h2>
      <p className="mt-1 text-sm text-slate-500">
        Profesionales participantes del servicio.
      </p>

      <div className="mt-4 space-y-2">
        {responsableNombre ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{responsableNombre}</p>
            <p className="text-xs font-medium text-blue-700">Técnico responsable</p>
          </div>
        ) : null}

        {participantes.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.nombre || 'Sin nombre'}</p>
              <p className="text-xs text-slate-600">
                {item.rol_en_trabajo || 'Técnico participante'}
                {item.especialidad ? ` · ${item.especialidad}` : ''}
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => void quitar(item.id)}
                className="text-xs font-semibold text-rose-700 hover:underline"
              >
                Quitar
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={agregar} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del técnico"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            />
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            >
              <option value="Técnico especialista">Técnico especialista</option>
              <option value="Ayudante">Ayudante</option>
            </select>
            <input
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Especialidad (opcional)"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !nombre.trim()}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Agregando...' : 'Agregar técnico'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
