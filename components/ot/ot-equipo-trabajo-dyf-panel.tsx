'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type TecnicoExternoDyF = {
  id: string
  empresa_id: string
  nombre_completo: string
  rut: string
  cargo: string
  especialidad: string | null
  activo: boolean
}

type ParticipanteDyF = {
  id: string
  empresa_id: string
  ot_id: string
  tecnico_externo_id: string | null
  nombre: string | null
  rut: string | null
  cargo: string | null
  especialidad: string | null
  rol_en_trabajo: string | null
  es_principal: boolean | null
  activo: boolean | null
  created_at: string | null
}

type Props = {
  otId: string
  empresaId: string
  canManage?: boolean
  onChanged?: () => void
}

function labelOrDash(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'
  return value
}

export function OTEquipoTrabajoDyFPanel({
  otId,
  empresaId,
  canManage = false,
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [tecnicos, setTecnicos] = useState<TecnicoExternoDyF[]>([])
  const [participantes, setParticipantes] = useState<ParticipanteDyF[]>([])

  const [tecnicoId, setTecnicoId] = useState('')
  const [rolEnTrabajo, setRolEnTrabajo] = useState('')
  const [esPrincipal, setEsPrincipal] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [tecnicosResp, participantesResp] = await Promise.all([
        (supabase as any)
          .from('ot_tecnicos_externos')
          .select('id, empresa_id, nombre_completo, rut, cargo, especialidad, activo')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .order('nombre_completo', { ascending: true }),

        (supabase as any)
          .from('ot_orden_equipo_trabajo')
          .select(
            'id, empresa_id, ot_id, tecnico_externo_id, nombre, rut, cargo, especialidad, rol_en_trabajo, es_principal, activo, created_at'
          )
          .eq('empresa_id', empresaId)
          .eq('ot_id', otId)
          .eq('activo', true)
          .order('es_principal', { ascending: false })
          .order('created_at', { ascending: true }),
      ])

      if (tecnicosResp.error) {
        throw new Error(`No se pudieron cargar los técnicos DyF: ${tecnicosResp.error.message}`)
      }

      if (participantesResp.error) {
        throw new Error(
          `No se pudieron cargar los técnicos participantes: ${participantesResp.error.message}`
        )
      }

      setTecnicos((tecnicosResp.data ?? []) as TecnicoExternoDyF[])
      setParticipantes((participantesResp.data ?? []) as ParticipanteDyF[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo de trabajo.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, otId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const tecnicosDisponibles = useMemo(() => {
    const idsAsignados = new Set(
      participantes
        .filter((item) => item.activo !== false)
        .map((item) => item.tecnico_externo_id)
        .filter(Boolean)
    )

    const rutsAsignados = new Set(
      participantes
        .filter((item) => item.activo !== false)
        .map((item) => item.rut)
        .filter(Boolean)
    )

    return tecnicos.filter((tecnico) => {
      if (idsAsignados.has(tecnico.id)) return false
      if (rutsAsignados.has(tecnico.rut)) return false
      return true
    })
  }, [tecnicos, participantes])

  async function handleAgregarTecnico(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      if (!tecnicoId) {
        throw new Error('Debes seleccionar un técnico DyF.')
      }

      const tecnico = tecnicos.find((item) => item.id === tecnicoId)

      if (!tecnico) {
        throw new Error('El técnico seleccionado no existe o no está activo.')
      }

      const yaAsignado = participantes.some((item) => {
        return (
          item.activo !== false &&
          (item.tecnico_externo_id === tecnico.id || item.rut === tecnico.rut)
        )
      })

      if (yaAsignado) {
        throw new Error('Este técnico ya está asignado a esta OT/OM.')
      }

      if (esPrincipal) {
        await (supabase as any)
          .from('ot_orden_equipo_trabajo')
          .update({
            es_principal: false,
            updated_at: new Date().toISOString(),
          })
          .eq('empresa_id', empresaId)
          .eq('ot_id', otId)
          .eq('activo', true)
      }

      const payload = {
        empresa_id: empresaId,
        ot_id: otId,
        tecnico_externo_id: tecnico.id,
        usuario_id: null,
        nombre: tecnico.nombre_completo,
        rut: tecnico.rut,
        cargo: tecnico.cargo,
        especialidad: tecnico.especialidad,
        rol_en_trabajo: rolEnTrabajo.trim() || null,
        es_principal: esPrincipal,
        activo: true,
      }

      const { error: insertError } = await (supabase as any)
        .from('ot_orden_equipo_trabajo')
        .insert(payload)

      if (insertError) {
        const message = String(insertError.message || '')

        if (message.includes('ot_orden_equipo_trabajo_ot_tecnico_externo_activo_uidx')) {
          throw new Error('Este técnico ya está asignado a esta OT/OM.')
        }

        throw new Error(`No se pudo asignar el técnico: ${insertError.message}`)
      }

      setTecnicoId('')
      setRolEnTrabajo('')
      setEsPrincipal(false)

      await loadData()
      onChanged?.()

      setSuccess('Técnico agregado correctamente a la OT/OM.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el técnico.')
    } finally {
      setSaving(false)
    }
  }

  async function handleQuitarTecnico(participante: ParticipanteDyF) {
    try {
      setError('')
      setSuccess('')

      const confirmar = window.confirm(
        `¿Deseas quitar a ${participante.nombre || 'este técnico'} de esta OT/OM? No se eliminará del maestro.`
      )

      if (!confirmar) return

      const { error: updateError } = await (supabase as any)
        .from('ot_orden_equipo_trabajo')
        .update({
          activo: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', participante.id)
        .eq('empresa_id', empresaId)
        .eq('ot_id', otId)

      if (updateError) {
        throw new Error(`No se pudo quitar el técnico: ${updateError.message}`)
      }

      await loadData()
      onChanged?.()

      setSuccess('Técnico quitado correctamente de la OT/OM.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el técnico.')
    }
  }

  async function handleMarcarPrincipal(participante: ParticipanteDyF) {
    try {
      setError('')
      setSuccess('')

      const nowIso = new Date().toISOString()

      const { error: clearError } = await (supabase as any)
        .from('ot_orden_equipo_trabajo')
        .update({
          es_principal: false,
          updated_at: nowIso,
        })
        .eq('empresa_id', empresaId)
        .eq('ot_id', otId)
        .eq('activo', true)

      if (clearError) {
        throw new Error(`No se pudo actualizar el técnico principal: ${clearError.message}`)
      }

      const { error: updateError } = await (supabase as any)
        .from('ot_orden_equipo_trabajo')
        .update({
          es_principal: true,
          updated_at: nowIso,
        })
        .eq('id', participante.id)
        .eq('empresa_id', empresaId)
        .eq('ot_id', otId)

      if (updateError) {
        throw new Error(`No se pudo marcar el técnico principal: ${updateError.message}`)
      }

      await loadData()
      onChanged?.()

      setSuccess('Técnico principal actualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el técnico principal.')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Técnicos participantes DyF / Softys
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Registra quiénes participaron en el trabajo para mantener trazabilidad ante Softys.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      {canManage ? (
        <form
          onSubmit={handleAgregarTecnico}
          className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Técnico DyF
              </label>
              <select
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">Seleccionar técnico...</option>
                {tecnicosDisponibles.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nombre_completo} / {tecnico.rut} / {tecnico.cargo}
                  </option>
                ))}
              </select>

              {tecnicosDisponibles.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  No hay técnicos disponibles para agregar. Revisa el maestro Técnicos DyF.
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Rol en el trabajo
              </label>
              <input
                value={rolEnTrabajo}
                onChange={(e) => setRolEnTrabajo(e.target.value)}
                placeholder="Ej: Ejecutor, apoyo, supervisor terreno"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div className="flex items-end">
              <label className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={esPrincipal}
                  onChange={(e) => setEsPrincipal(e.target.checked)}
                />
                Principal
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Esta asignación queda guardada como historial de participación en la OT/OM.
            </p>

            <button
              type="submit"
              disabled={saving || !tecnicoId}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving ? 'Agregando...' : 'Agregar técnico'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Cargando técnicos participantes...
          </div>
        ) : participantes.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Esta OT/OM aún no tiene técnicos DyF asignados.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">RUT</th>
                    <th className="px-4 py-3 font-semibold">Cargo</th>
                    <th className="px-4 py-3 font-semibold">Especialidad</th>
                    <th className="px-4 py-3 font-semibold">Rol</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    {canManage ? (
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {participantes.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {labelOrDash(item.nombre)}
                      </td>
                      <td className="px-4 py-3">{labelOrDash(item.rut)}</td>
                      <td className="px-4 py-3">{labelOrDash(item.cargo)}</td>
                      <td className="px-4 py-3">{labelOrDash(item.especialidad)}</td>
                      <td className="px-4 py-3">{labelOrDash(item.rol_en_trabajo)}</td>
                      <td className="px-4 py-3">
                        {item.es_principal ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                            Principal
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            Participante
                          </span>
                        )}
                      </td>

                      {canManage ? (
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col justify-end gap-2 sm:flex-row">
                            {!item.es_principal ? (
                              <button
                                type="button"
                                onClick={() => void handleMarcarPrincipal(item)}
                                className="inline-flex items-center justify-center rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Marcar principal
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => void handleQuitarTecnico(item)}
                              className="inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Quitar
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}