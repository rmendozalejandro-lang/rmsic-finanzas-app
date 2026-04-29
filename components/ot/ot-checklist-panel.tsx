'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type Plantilla = {
  id: string
  nombre: string
  tipo_activo: string | null
  descripcion: string | null
}

type ChecklistItem = {
  id: string
  plantilla_id: string
  zona: string
  categoria: string | null
  actividad: string
  frecuencia_horas: number | null
  indicaciones: string | null
  tipo_item: string
  tipo_respuesta: string
  requiere_observacion_si_no_ok: boolean
  requiere_evidencia: boolean
  orden: number
}

type RespuestaRow = {
  id: string
  plantilla_item_id: string
  respuesta_texto: string | null
  respuesta_boolean: boolean | null
  observacion: string | null
}

type RespuestaState = {
  respuesta_texto: '' | 'ok' | 'no_ok' | 'na'
  observacion: string
}

type ChecklistModo = 'horas' | 'completa' | 'lubricacion'

const HORAS_OPTIONS = [175, 520, 1040, 2080, 3120, 4160]

function estadoLabel(value: string) {
  if (value === 'ok') return 'OK'
  if (value === 'no_ok') return 'No OK'
  if (value === 'na') return 'N/A'
  return 'Sin responder'
}

function estadoClass(value: string) {
  if (value === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'no_ok') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (value === 'na') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function normalizeEstado(value: string | null | undefined): RespuestaState['respuesta_texto'] {
  if (value === 'ok' || value === 'no_ok' || value === 'na') return value
  return ''
}

export function OTChecklistPanel({
  otId,
  empresaId,
  currentUserId,
  initialPlantillaId,
  requiereChecklist,
  onChanged,
}: {
  otId: string
  empresaId: string
  currentUserId: string
  initialPlantillaId: string | null
  requiereChecklist: boolean
  onChanged?: () => void
}) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaState>>({})

  const [plantillaId, setPlantillaId] = useState(initialPlantillaId || '')
  const [modo, setModo] = useState<ChecklistModo>('horas')
  const [horas, setHoras] = useState(175)
  const [incluirMenores, setIncluirMenores] = useState(true)

  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingResponses, setSavingResponses] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setPlantillaId(initialPlantillaId || '')
  }, [initialPlantillaId])

  const loadPlantillas = async () => {
    try {
      setLoading(true)
      setError('')

      const { data, error: plantillasError } = await supabase
        .from('ot_plantillas_checklist')
        .select('id, nombre, tipo_activo, descripcion')
        .eq('empresa_id', empresaId)
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (plantillasError) {
        throw new Error(plantillasError.message)
      }

      const nextPlantillas = (data || []) as Plantilla[]
      setPlantillas(nextPlantillas)

      if (!plantillaId && nextPlantillas.length > 0) {
        const mespack =
          nextPlantillas.find((item) =>
            item.nombre.toLowerCase().includes('mespack')
          ) || nextPlantillas[0]

        setPlantillaId(mespack.id)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las plantillas de checklist.'
      )
    } finally {
      setLoading(false)
    }
  }

  const loadItemsAndResponses = async (selectedPlantillaId: string) => {
    if (!selectedPlantillaId) {
      setItems([])
      setRespuestas({})
      return
    }

    try {
      setError('')

      const [itemsResp, respuestasResp] = await Promise.all([
        supabase
          .from('ot_plantillas_checklist_items')
          .select(
            'id, plantilla_id, zona, categoria, actividad, frecuencia_horas, indicaciones, tipo_item, tipo_respuesta, requiere_observacion_si_no_ok, requiere_evidencia, orden'
          )
          .eq('plantilla_id', selectedPlantillaId)
          .eq('activa', true)
          .order('orden', { ascending: true }),

        supabase
          .from('ot_respuestas_checklist')
          .select('id, plantilla_item_id, respuesta_texto, respuesta_boolean, observacion')
          .eq('ot_id', otId),
      ])

      if (itemsResp.error) {
        throw new Error(itemsResp.error.message)
      }

      if (respuestasResp.error) {
        throw new Error(respuestasResp.error.message)
      }

      const loadedItems = (itemsResp.data || []) as ChecklistItem[]
      const loadedResponses = (respuestasResp.data || []) as RespuestaRow[]

      const nextResponses = loadedResponses.reduce<Record<string, RespuestaState>>(
        (acc, item) => {
          acc[item.plantilla_item_id] = {
            respuesta_texto: normalizeEstado(item.respuesta_texto),
            observacion: item.observacion || '',
          }
          return acc
        },
        {}
      )

      setItems(loadedItems)
      setRespuestas(nextResponses)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los ítems del checklist.'
      )
    }
  }

  useEffect(() => {
    if (!empresaId) return
    void loadPlantillas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  useEffect(() => {
    void loadItemsAndResponses(plantillaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaId, otId])

  const itemsFiltrados = useMemo(() => {
    if (!plantillaId) return []

    if (modo === 'completa') return items

    if (modo === 'lubricacion') {
      return items.filter((item) => item.tipo_item === 'lubricacion')
    }

    return items.filter((item) => {
      if (!item.frecuencia_horas) return true
      if (incluirMenores) return item.frecuencia_horas <= horas
      return item.frecuencia_horas === horas
    })
  }, [items, plantillaId, modo, horas, incluirMenores])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ChecklistItem[]>()

    itemsFiltrados.forEach((item) => {
      const key = item.zona || 'General'
      const current = groups.get(key) || []
      current.push(item)
      groups.set(key, current)
    })

    return Array.from(groups.entries())
  }, [itemsFiltrados])

  const totalRespondidas = itemsFiltrados.filter((item) => {
    const respuesta = respuestas[item.id]
    return Boolean(respuesta?.respuesta_texto)
  }).length

  const totalItems = itemsFiltrados.length
  const pendientes = Math.max(0, totalItems - totalRespondidas)

  const setRespuesta = (
    itemId: string,
    field: keyof RespuestaState,
    value: string
  ) => {
    setRespuestas((prev) => ({
      ...prev,
      [itemId]: {
        respuesta_texto: prev[itemId]?.respuesta_texto || '',
        observacion: prev[itemId]?.observacion || '',
        [field]: value,
      },
    }))
  }

  const guardarConfiguracion = async () => {
    if (!plantillaId) {
      setError('Debes seleccionar una plantilla de checklist.')
      setSuccess('')
      return
    }

    try {
      setSavingConfig(true)
      setError('')
      setSuccess('')

      const payload = {
        plantilla_checklist_id: plantillaId,
        requiere_checklist: true,
        checklist_modo: modo,
        checklist_horas: modo === 'horas' ? horas : null,
        checklist_incluir_frecuencias_menores: incluirMenores,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('ot_ordenes_trabajo')
        .update(payload)
        .eq('id', otId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess('Configuración de checklist guardada correctamente.')
      onChanged?.()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la configuración del checklist.'
      )
    } finally {
      setSavingConfig(false)
    }
  }

  const guardarRespuestas = async () => {
    if (!plantillaId) {
      setError('Debes seleccionar una plantilla antes de responder.')
      setSuccess('')
      return
    }

    const payload = itemsFiltrados
      .map((item) => {
        const respuesta = respuestas[item.id]

        if (!respuesta?.respuesta_texto) return null

        return {
          ot_id: otId,
          plantilla_item_id: item.id,
          respuesta_texto: respuesta.respuesta_texto,
          respuesta_boolean:
            respuesta.respuesta_texto === 'ok'
              ? true
              : respuesta.respuesta_texto === 'no_ok'
                ? false
                : null,
          observacion: respuesta.observacion.trim() || null,
          usuario_id: currentUserId || null,
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (payload.length === 0) {
      setError('Debes responder al menos un ítem del checklist.')
      setSuccess('')
      return
    }

    try {
      setSavingResponses(true)
      setError('')
      setSuccess('')

      const { error: upsertError } = await supabase
        .from('ot_respuestas_checklist')
        .upsert(payload, {
          onConflict: 'ot_id,plantilla_item_id',
        })

      if (upsertError) {
        throw new Error(upsertError.message)
      }

      setSuccess('Respuestas de checklist guardadas correctamente.')
      await loadItemsAndResponses(plantillaId)
      onChanged?.()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar las respuestas del checklist.'
      )
    } finally {
      setSavingResponses(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando checklist...</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Checklist preventivo</p>
          <h2 className="text-lg font-semibold text-slate-900">
            Checklist de mantenimiento
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona una plantilla, define el modo de mantención y registra las
            respuestas del técnico.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Respondidos:{' '}
          <span className="font-semibold text-slate-900">
            {totalRespondidas}/{totalItems}
          </span>
          {pendientes > 0 ? (
            <span className="ml-2 text-amber-700">Pendientes: {pendientes}</span>
          ) : totalItems > 0 ? (
            <span className="ml-2 text-emerald-700">Completo</span>
          ) : null}
        </div>
      </div>

      {!requiereChecklist ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta OT no tiene marcado checklist obligatorio. Puedes usar esta sección
          como respaldo técnico si deseas registrar una revisión preventiva.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Plantilla
          </label>
          <select
            value={plantillaId}
            onChange={(event) => setPlantillaId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="">Selecciona plantilla</option>
            {plantillas.map((plantilla) => (
              <option key={plantilla.id} value={plantilla.id}>
                {plantilla.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Modo
          </label>
          <select
            value={modo}
            onChange={(event) => setModo(event.target.value as ChecklistModo)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="horas">Por horas</option>
            <option value="completa">Mantención completa</option>
            <option value="lubricacion">Solo lubricación</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Horas
          </label>
          <select
            value={horas}
            onChange={(event) => setHoras(Number(event.target.value))}
            disabled={modo !== 'horas'}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {HORAS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item} hrs
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={incluirMenores}
            onChange={(event) => setIncluirMenores(event.target.checked)}
            disabled={modo !== 'horas'}
          />
          Incluir frecuencias menores
        </label>

        <button
          type="button"
          onClick={guardarConfiguracion}
          disabled={savingConfig || !plantillaId}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingConfig ? 'Guardando configuración...' : 'Guardar configuración'}
        </button>
      </div>

      {plantillaId && totalItems === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No hay ítems para el modo seleccionado.
        </div>
      ) : null}

      {groupedItems.length > 0 ? (
        <div className="mt-6 space-y-5">
          {groupedItems.map(([zona, zonaItems]) => (
            <div key={zona} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-slate-900">{zona}</h3>
              </div>

              <div className="divide-y divide-slate-100">
                {zonaItems.map((item) => {
                  const respuesta = respuestas[item.id] || {
                    respuesta_texto: '',
                    observacion: '',
                  }

                  return (
                    <div key={item.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_220px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {item.actividad}
                          </p>

                          {item.frecuencia_horas ? (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {item.frecuencia_horas} hrs
                            </span>
                          ) : null}

                          {item.tipo_item ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.tipo_item}
                            </span>
                          ) : null}

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClass(
                              respuesta.respuesta_texto
                            )}`}
                          >
                            {estadoLabel(respuesta.respuesta_texto)}
                          </span>
                        </div>

                        {item.categoria ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                            {item.categoria}
                          </p>
                        ) : null}

                        {item.indicaciones ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {item.indicaciones}
                          </p>
                        ) : null}

                        <textarea
                          value={respuesta.observacion}
                          onChange={(event) =>
                            setRespuesta(item.id, 'observacion', event.target.value)
                          }
                          rows={2}
                          placeholder="Observación del técnico"
                          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Respuesta
                        </label>
                        <select
                          value={respuesta.respuesta_texto}
                          onChange={(event) =>
                            setRespuesta(
                              item.id,
                              'respuesta_texto',
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                        >
                          <option value="">Sin responder</option>
                          <option value="ok">OK</option>
                          <option value="no_ok">No OK</option>
                          <option value="na">No aplica</option>
                        </select>

                        {item.requiere_observacion_si_no_ok &&
                        respuesta.respuesta_texto === 'no_ok' &&
                        !respuesta.observacion.trim() ? (
                          <p className="mt-2 text-xs text-amber-700">
                            Se recomienda agregar observación cuando el resultado es No OK.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={guardarRespuestas}
              disabled={savingResponses}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingResponses ? 'Guardando respuestas...' : 'Guardar respuestas checklist'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}