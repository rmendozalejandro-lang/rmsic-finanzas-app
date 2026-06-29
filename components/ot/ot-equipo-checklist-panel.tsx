'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type PlantillaChecklist = {
  id: string
  nombre: string
  tipo_activo: string | null
  descripcion: string | null
}

type ChecklistItem = {
  id: string
  plantilla_id: string
  zona: string | null
  categoria: string | null
  actividad: string
  frecuencia_horas: number | null
  indicaciones: string | null
  tipo_item: string | null
  tipo_respuesta: string | null
  requiere_observacion_si_no_ok: boolean | null
  requiere_evidencia: boolean | null
  orden: number | null
}

type EquipoChecklistInfo = {
  id: string
  equipo_id: string
  orden: number | null
  descripcion_trabajo: string | null
  observacion: string | null
  tag: string | null
  nombre: string | null
  descripcion: string | null
  tipo_equipo: string | null
  planta: string | null
  area: string | null
  linea: string | null
  ubicacion: string | null
  marca: string | null
  modelo: string | null
  potencia: string | null
  criticidad: string | null
}

type RespuestaRow = {
  id: string
  ot_orden_equipo_id: string
  plantilla_item_id: string
  respuesta_texto: string | null
  respuesta_boolean: boolean | null
  observacion_antes: string | null
  observacion_despues: string | null
  accion_realizada: string | null
  recomendacion_tecnica: string | null
  condicion_equipo: string | null
  accion_checklist: string | null
  evidencia_antes_url: string | null
  evidencia_despues_url: string | null
  datos: Record<string, any> | null
}

type RespuestaState = {
  respuesta_texto: '' | 'ok' | 'no_ok' | 'na'
  observacion_antes: string
  observacion_despues: string
  accion_realizada: string
  recomendacion_tecnica: string
  condicion_equipo: string
  accion_checklist: string
  evidencia_antes_url: string
  evidencia_despues_url: string
  datos: Record<string, any>
}

const EMPTY_RESPUESTA: RespuestaState = {
  respuesta_texto: '',
  observacion_antes: '',
  observacion_despues: '',
  accion_realizada: '',
  recomendacion_tecnica: '',
  condicion_equipo: '',
  accion_checklist: '',
  evidencia_antes_url: '',
  evidencia_despues_url: '',
  datos: {},
}

function normalizeEstado(value: string | null | undefined): RespuestaState['respuesta_texto'] {
  if (value === 'ok' || value === 'no_ok' || value === 'na') return value
  return ''
}

function estadoLabel(value: string) {
  if (value === 'ok') return 'OK'
  if (value === 'no_ok') return 'No OK'
  if (value === 'na') return 'N/A'
  return 'Pendiente'
}

function estadoClass(value: string) {
  if (value === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'no_ok') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (value === 'na') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function condicionEquipoLabel(value: string | null | undefined) {
  if (value === 'muy_bueno') return 'Muy bueno'
  if (value === 'bueno') return 'Bueno'
  if (value === 'regular') return 'Regular'
  if (value === 'malo') return 'Malo'
  if (value === 'muy_malo') return 'Muy malo'
  if (value === 'no_aplica') return 'No aplica'
  return ''
}

function accionChecklistLabel(value: string | null | undefined) {
  if (value === 'check') return 'Check'
  if (value === 'limpieza') return 'Limpieza'
  if (value === 'reparacion') return 'Reparación'
  if (value === 'cambio') return 'Cambio'
  if (value === 'aviso_sap') return 'Aviso SAP'
  if (value === 'no_aplica') return 'No aplica'
  return ''
}


type MedicionMotorTipo = 'resistencia_bobinas' | 'aislacion'

type MedicionField = {
  key: string
  label: string
  unidad: string
}

const RESISTENCIA_BOBINAS_FIELDS: MedicionField[] = [
  { key: 'u1_u2', label: 'U1 - U2', unidad: 'Ω' },
  { key: 'v1_v2', label: 'V1 - V2', unidad: 'Ω' },
  { key: 'w1_w2', label: 'W1 - W2', unidad: 'Ω' },
]

const AISLACION_MOTOR_FIELDS: MedicionField[] = [
  { key: 'u_tierra', label: 'U - Tierra', unidad: 'MΩ' },
  { key: 'v_tierra', label: 'V - Tierra', unidad: 'MΩ' },
  { key: 'w_tierra', label: 'W - Tierra', unidad: 'MΩ' },
  { key: 'u_v', label: 'U - V', unidad: 'MΩ' },
  { key: 'v_w', label: 'V - W', unidad: 'MΩ' },
  { key: 'w_u', label: 'W - U', unidad: 'MΩ' },
]

function getMedicionesMotor(datos: Record<string, any> | null | undefined) {
  const mediciones = datos?.mediciones_motor
  return mediciones && typeof mediciones === 'object' ? mediciones : {}
}

function getMedicionMotorValue(
  datos: Record<string, any> | null | undefined,
  tipo: MedicionMotorTipo,
  field: string
) {
  const mediciones = getMedicionesMotor(datos)
  const grupo = mediciones[tipo]
  const value = grupo && typeof grupo === 'object' ? grupo[field] : ''
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function hasMedicionesMotor(datos: Record<string, any> | null | undefined) {
  const mediciones = getMedicionesMotor(datos)
  return Object.values(mediciones).some((grupo) => {
    if (!grupo || typeof grupo !== 'object') return false
    return Object.values(grupo as Record<string, unknown>).some((value) => String(value ?? '').trim())
  })
}

function limpiarDatosChecklist(datos: Record<string, any> | null | undefined) {
  const mediciones = getMedicionesMotor(datos)
  const nextMediciones: Record<string, Record<string, string>> = {}

  ;(['resistencia_bobinas', 'aislacion'] as MedicionMotorTipo[]).forEach((tipo) => {
    const grupo = mediciones[tipo]
    if (!grupo || typeof grupo !== 'object') return

    const nextGrupo = Object.entries(grupo as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const text = String(value ?? '').trim()
        if (text) acc[key] = text
        return acc
      },
      {}
    )

    if (Object.keys(nextGrupo).length > 0) {
      nextMediciones[tipo] = nextGrupo
    }
  })

  return Object.keys(nextMediciones).length > 0
    ? { mediciones_motor: nextMediciones }
    : {}
}

function medicionMotorTipo(item: ChecklistItem): MedicionMotorTipo | null {
  const text = normalizeText([item.actividad, item.categoria, item.zona].filter(Boolean).join(' '))

  if (text.includes('resistencia') && (text.includes('bobina') || text.includes('bobinas'))) {
    return 'resistencia_bobinas'
  }

  if (text.includes('aislacion') && (text.includes('bobina') || text.includes('tierra'))) {
    return 'aislacion'
  }

  return null
}

function calculoDiferenciaBobinas(datos: Record<string, any> | null | undefined) {
  const values = RESISTENCIA_BOBINAS_FIELDS
    .map((field) => Number(String(getMedicionMotorValue(datos, 'resistencia_bobinas', field.key)).replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (values.length < 2) return ''

  const max = Math.max(...values)
  const min = Math.min(...values)
  const promedio = values.reduce((sum, value) => sum + value, 0) / values.length

  if (!promedio) return ''

  return `${(((max - min) / promedio) * 100).toFixed(2)} %`
}

function MedicionesMotorPanel({
  tipo,
  datos,
  onChange,
}: {
  tipo: MedicionMotorTipo
  datos: Record<string, any>
  onChange: (field: string, value: string) => void
}) {
  const esResistencia = tipo === 'resistencia_bobinas'
  const fields = esResistencia ? RESISTENCIA_BOBINAS_FIELDS : AISLACION_MOTOR_FIELDS
  const unidadPrincipal = esResistencia ? 'Ω' : 'MΩ'
  const title = esResistencia
    ? 'Medición de resistencia de bobinas'
    : 'Medición de aislación del motor'
  const subtitle = esResistencia
    ? 'Registra la impedancia/resistencia medida en cada bobina del motor.'
    : 'Registra la aislación respecto a tierra y entre bobinas. Normalmente se expresa en MΩ.'

  return (
    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-950">{title}</p>
          <p className="mt-1 text-xs text-blue-800">{subtitle}</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800">
          Unidad: {unidadPrincipal}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {fields.map((field) => (
          <label key={field.key} className="block rounded-xl border border-blue-100 bg-white p-3">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              {field.label}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={getMedicionMotorValue(datos, tipo, field.key)}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder="0.00"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
              <span className="w-9 text-sm font-semibold text-slate-600">{field.unidad}</span>
            </div>
          </label>
        ))}
      </div>

      {esResistencia ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
          Diferencia máxima calculada entre bobinas:{' '}
          <span className="font-semibold text-slate-900">
            {calculoDiferenciaBobinas(datos) || 'Pendiente'}
          </span>
        </div>
      ) : (
        <label className="mt-3 block rounded-xl border border-blue-100 bg-white p-3">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Voltaje de prueba
          </span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              step="1"
              value={getMedicionMotorValue(datos, tipo, 'voltaje_prueba_v')}
              onChange={(event) => onChange('voltaje_prueba_v', event.target.value)}
              placeholder="500"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            <span className="w-9 text-sm font-semibold text-slate-600">V</span>
          </div>
        </label>
      )}
    </div>
  )
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function esItemGeneralOm(item: ChecklistItem) {
  const text = normalizeText(
    [item.zona, item.categoria, item.actividad, item.indicaciones]
      .filter(Boolean)
      .join(' ')
  )

  const patronesGenerales = [
    'seguridad',
    'epp',
    'bloqueo',
    'permiso',
    'herramienta',
    'material',
    'orden y limpieza',
    'limpieza y orden',
    'charla',
    'riesgo',
    'area de trabajo',
  ]

  return patronesGenerales.some((patron) => text.includes(patron))
}

function equipoDisplayName(equipo: EquipoChecklistInfo) {
  return [equipo.tag, equipo.nombre].filter(Boolean).join(' · ') || equipo.equipo_id
}

function equipoUbicacionDisplay(equipo: EquipoChecklistInfo) {
  const partes = [equipo.planta, equipo.area, equipo.linea, equipo.ubicacion].filter(Boolean)
  return partes.length > 0 ? partes.join(' / ') : '-'
}

function equipoCaracteristicasDisplay(equipo: EquipoChecklistInfo) {
  const partes = [equipo.tipo_equipo, equipo.marca, equipo.modelo, equipo.potencia].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : '-'
}

function keyFor(otOrdenEquipoId: string, itemId: string) {
  return `${otOrdenEquipoId}:${itemId}`
}

function evidenciaUploadKey(otOrdenEquipoId: string, itemId: string, tipo: 'antes' | 'despues') {
  return `${otOrdenEquipoId}:${itemId}:${tipo}`
}

function cleanExtension(fileName: string) {
  const extension = fileName.split('.').pop() || 'jpg'
  const cleaned = extension.toLowerCase().replace(/[^a-z0-9]/g, '')
  return cleaned || 'jpg'
}

export function OTEquipoChecklistPanel({
  otId,
  empresaId,
  currentUserId,
  plantillaId,
  requiereChecklist,
  equipos,
  onChanged,
}: {
  otId: string
  empresaId: string
  currentUserId: string
  plantillaId: string | null
  requiereChecklist: boolean
  equipos: EquipoChecklistInfo[]
  onChanged?: () => void
}) {
  const db = supabase as any

  const [selectedPlantillaId, setSelectedPlantillaId] = useState(plantillaId || '')
  const [selectedPlantillaNombre, setSelectedPlantillaNombre] = useState('')
  const [plantillaAutoAsignada, setPlantillaAutoAsignada] = useState(false)

  const [items, setItems] = useState<ChecklistItem[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaState>>({})
  const [mostrarGenerales, setMostrarGenerales] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingEquipoId, setSavingEquipoId] = useState('')
  const [uploadingKey, setUploadingKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (plantillaId) {
      setSelectedPlantillaId(plantillaId)
      setPlantillaAutoAsignada(false)
    }
  }, [plantillaId])

  const equiposOrdenados = useMemo(() => {
    return [...equipos].sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999))
  }, [equipos])

  const itemsTecnicos = useMemo(() => {
    if (mostrarGenerales) return items
    return items.filter((item) => !esItemGeneralOm(item))
  }, [items, mostrarGenerales])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ChecklistItem[]>()

    itemsTecnicos.forEach((item) => {
      const key = item.zona || 'General'
      const current = groups.get(key) || []
      current.push(item)
      groups.set(key, current)
    })

    return Array.from(groups.entries())
  }, [itemsTecnicos])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      let plantillaParaUsar = selectedPlantillaId || plantillaId || ''

      if (!plantillaParaUsar) {
        const { data: plantillasData, error: plantillasError } = await supabase
          .from('ot_plantillas_checklist')
          .select('id, nombre, tipo_activo, descripcion')
          .eq('empresa_id', empresaId)
          .eq('activa', true)
          .order('nombre', { ascending: true })

        if (plantillasError) throw new Error(plantillasError.message)

        const plantillas = (plantillasData || []) as PlantillaChecklist[]
        const plantillaElegida =
          plantillas.find((item) => normalizeText(item.nombre).includes('motor')) ||
          plantillas.find((item) => normalizeText(item.nombre).includes('mespack')) ||
          plantillas.find((item) => normalizeText(item.tipo_activo || '').includes('motor')) ||
          plantillas[0]

        if (!plantillaElegida) {
          setItems([])
          setRespuestas({})
          setSelectedPlantillaNombre('')
          setLoading(false)
          return
        }

        plantillaParaUsar = plantillaElegida.id
        setSelectedPlantillaId(plantillaElegida.id)
        setSelectedPlantillaNombre(plantillaElegida.nombre)
        setPlantillaAutoAsignada(true)

        const { error: updatePlantillaError } = await db
          .from('ot_ordenes_trabajo')
          .update({
            plantilla_checklist_id: plantillaElegida.id,
            requiere_checklist: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', otId)

        if (updatePlantillaError) {
          throw new Error(updatePlantillaError.message)
        }

        onChanged?.()
      }

      const [itemsResp, respuestasResp] = await Promise.all([
        supabase
          .from('ot_plantillas_checklist_items')
          .select(
            'id, plantilla_id, zona, categoria, actividad, frecuencia_horas, indicaciones, tipo_item, tipo_respuesta, requiere_observacion_si_no_ok, requiere_evidencia, orden'
          )
          .eq('plantilla_id', plantillaParaUsar)
          .eq('activa', true)
          .order('orden', { ascending: true }),
        db
          .from('ot_equipo_checklist_resultados')
          .select(
            'id, ot_orden_equipo_id, plantilla_item_id, respuesta_texto, respuesta_boolean, observacion_antes, observacion_despues, accion_realizada, recomendacion_tecnica, condicion_equipo, accion_checklist, evidencia_antes_url, evidencia_despues_url, datos'
          )
          .eq('ot_id', otId),
      ])

      if (itemsResp.error) throw new Error(itemsResp.error.message)
      if (respuestasResp.error) throw new Error(respuestasResp.error.message)

      const nextItems = (itemsResp.data || []) as ChecklistItem[]
      const loadedResponses = (respuestasResp.data || []) as RespuestaRow[]

      const nextResponses = loadedResponses.reduce<Record<string, RespuestaState>>(
        (acc, row) => {
          acc[keyFor(row.ot_orden_equipo_id, row.plantilla_item_id)] = {
            respuesta_texto: normalizeEstado(row.respuesta_texto),
            observacion_antes: row.observacion_antes || '',
            observacion_despues: row.observacion_despues || '',
            accion_realizada: row.accion_realizada || '',
            recomendacion_tecnica: row.recomendacion_tecnica || '',
            condicion_equipo: row.condicion_equipo || '',
            accion_checklist: row.accion_checklist || '',
            evidencia_antes_url: row.evidencia_antes_url || '',
            evidencia_despues_url: row.evidencia_despues_url || '',
            datos: row.datos && typeof row.datos === 'object' ? row.datos : {},
          }
          return acc
        },
        {}
      )

      setItems(nextItems)
      setRespuestas(nextResponses)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el checklist técnico por equipo.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otId, empresaId, plantillaId, selectedPlantillaId])

  const setRespuesta = (
    equipoAsociadoId: string,
    itemId: string,
    field: Exclude<keyof RespuestaState, 'datos'>,
    value: string
  ) => {
    const key = keyFor(equipoAsociadoId, itemId)

    setRespuestas((prev) => ({
      ...prev,
      [key]: {
        ...EMPTY_RESPUESTA,
        ...(prev[key] || {}),
        [field]: value,
      },
    }))
  }

  const setMedicionMotor = (
    equipoAsociadoId: string,
    itemId: string,
    tipo: MedicionMotorTipo,
    field: string,
    value: string
  ) => {
    const key = keyFor(equipoAsociadoId, itemId)

    setRespuestas((prev) => {
      const current = {
        ...EMPTY_RESPUESTA,
        ...(prev[key] || {}),
      }
      const currentMediciones = getMedicionesMotor(current.datos)
      const currentGrupo = currentMediciones[tipo] && typeof currentMediciones[tipo] === 'object'
        ? currentMediciones[tipo]
        : {}

      return {
        ...prev,
        [key]: {
          ...current,
          datos: {
            ...current.datos,
            mediciones_motor: {
              ...currentMediciones,
              [tipo]: {
                ...currentGrupo,
                [field]: value,
              },
            },
          },
        },
      }
    })
  }

  const resumenEquipo = (equipoAsociadoId: string) => {
    const total = itemsTecnicos.length
    const respondidos = itemsTecnicos.filter((item) => {
      const respuesta = respuestas[keyFor(equipoAsociadoId, item.id)]
      return Boolean(respuesta?.respuesta_texto)
    }).length

    return {
      total,
      respondidos,
      pendientes: Math.max(0, total - respondidos),
    }
  }

  const uploadEvidencia = async (
    equipo: EquipoChecklistInfo,
    item: ChecklistItem,
    tipo: 'antes' | 'despues',
    file: File | null
  ) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen para la evidencia fotográfica.')
      setSuccess('')
      return
    }

    const maxSizeMb = 8
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`La imagen supera el máximo permitido de ${maxSizeMb} MB.`)
      setSuccess('')
      return
    }

    const uploadKey = evidenciaUploadKey(equipo.id, item.id, tipo)
    const field: Exclude<keyof RespuestaState, 'datos'> =
      tipo === 'antes' ? 'evidencia_antes_url' : 'evidencia_despues_url'

    try {
      setUploadingKey(uploadKey)
      setError('')
      setSuccess('')

      const extension = cleanExtension(file.name)
      const storagePath = `${empresaId}/${otId}/${equipo.id}/${item.id}/${tipo}-${Date.now()}.${extension}`

      const { error: uploadError } = await db.storage
        .from('ot-evidencias')
        .upload(storagePath, file, {
          cacheControl: '3600',
          contentType: file.type || 'image/jpeg',
          upsert: false,
        })

      if (uploadError) throw new Error(uploadError.message)

      const { data: publicData } = db.storage
        .from('ot-evidencias')
        .getPublicUrl(storagePath)

      const publicUrl = publicData?.publicUrl || ''
      if (!publicUrl) throw new Error('No se pudo obtener la URL pública de la evidencia.')

      setRespuesta(equipo.id, item.id, field, publicUrl)
      setSuccess(`Foto ${tipo === 'antes' ? 'antes' : 'después'} cargada para ${equipoDisplayName(equipo)}. Recuerda guardar el checklist del equipo.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la evidencia fotográfica.'
      )
      setSuccess('')
    } finally {
      setUploadingKey('')
    }
  }

  const guardarEquipo = async (equipo: EquipoChecklistInfo) => {
    const plantillaParaUsar = selectedPlantillaId || plantillaId || ''

    if (!plantillaParaUsar) {
      setError('La OM no tiene plantilla de checklist asociada.')
      setSuccess('')
      return
    }

    const payload = itemsTecnicos
      .map((item) => {
        const respuesta = respuestas[keyFor(equipo.id, item.id)] || EMPTY_RESPUESTA
        const datosChecklist = limpiarDatosChecklist(respuesta.datos)
        const tieneDatos =
          respuesta.respuesta_texto ||
          respuesta.observacion_antes.trim() ||
          respuesta.observacion_despues.trim() ||
          respuesta.accion_realizada.trim() ||
          respuesta.recomendacion_tecnica.trim() ||
          respuesta.condicion_equipo.trim() ||
          respuesta.accion_checklist.trim() ||
          Object.keys(datosChecklist).length > 0 ||
          respuesta.evidencia_antes_url.trim() ||
          respuesta.evidencia_despues_url.trim()

        if (!tieneDatos) return null

        return {
          empresa_id: empresaId,
          ot_id: otId,
          ot_orden_equipo_id: equipo.id,
          equipo_id: equipo.equipo_id,
          plantilla_id: plantillaParaUsar,
          plantilla_item_id: item.id,
          respuesta_texto: respuesta.respuesta_texto || null,
          respuesta_boolean:
            respuesta.respuesta_texto === 'ok'
              ? true
              : respuesta.respuesta_texto === 'no_ok'
                ? false
                : null,
          observacion_antes: respuesta.observacion_antes.trim() || null,
          observacion_despues: respuesta.observacion_despues.trim() || null,
          accion_realizada: respuesta.accion_realizada.trim() || null,
          recomendacion_tecnica: respuesta.recomendacion_tecnica.trim() || null,
          condicion_equipo: respuesta.condicion_equipo.trim() || null,
          accion_checklist: respuesta.accion_checklist.trim() || null,
          evidencia_antes_url: respuesta.evidencia_antes_url.trim() || null,
          evidencia_despues_url: respuesta.evidencia_despues_url.trim() || null,
          datos: datosChecklist,
          usuario_id: currentUserId || null,
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (payload.length === 0) {
      setError('Debes responder o completar al menos un ítem para este equipo.')
      setSuccess('')
      return
    }

    try {
      setSavingEquipoId(equipo.id)
      setError('')
      setSuccess('')

      const { error: upsertError } = await db
        .from('ot_equipo_checklist_resultados')
        .upsert(payload, {
          onConflict: 'ot_orden_equipo_id,plantilla_item_id',
        })

      if (upsertError) throw new Error(upsertError.message)

      setSuccess(`Checklist guardado para ${equipoDisplayName(equipo)}.`)
      await loadData()
      onChanged?.()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el checklist técnico del equipo.'
      )
    } finally {
      setSavingEquipoId('')
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando checklist técnico por equipo...</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Checklist técnico por equipo</p>
          <h2 className="text-lg font-semibold text-slate-900">
            Revisión por motor / equipo asociado
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cada equipo de la OM tiene su propio checklist técnico. Los ítems generales de seguridad y herramientas se mantienen fuera de esta revisión para no repetirlos por motor.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={mostrarGenerales}
            onChange={(event) => setMostrarGenerales(event.target.checked)}
          />
          Mostrar ítems generales
        </label>
      </div>

      {!requiereChecklist ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta OM no tiene marcado checklist obligatorio. Puedes usar esta sección como respaldo técnico si corresponde.
        </div>
      ) : null}

      {!selectedPlantillaId ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta OM no tiene plantilla de checklist asociada. El sistema intentará usar una plantilla activa de checklist técnico de la empresa.
        </div>
      ) : null}

      {selectedPlantillaId && plantillaAutoAsignada ? (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Plantilla de checklist asignada automáticamente: <span className="font-semibold">{selectedPlantillaNombre || 'Checklist técnico'}</span>.
        </div>
      ) : null}

      {equiposOrdenados.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Primero asocia uno o más equipos / motores a la OM. Luego podrás completar el checklist técnico de cada uno.
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

      {selectedPlantillaId && itemsTecnicos.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No hay ítems técnicos para mostrar con el filtro actual. Activa “Mostrar ítems generales” si necesitas ver la plantilla completa.
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {equiposOrdenados.map((equipo, equipoIndex) => {
          const resumen = resumenEquipo(equipo.id)
          const completo = resumen.total > 0 && resumen.pendientes === 0

          return (
            <details
              key={equipo.id}
              open={equipoIndex === 0}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <summary className="cursor-pointer bg-slate-50 px-4 py-4 marker:text-slate-500">
                <div className="inline-flex w-[calc(100%-1.5rem)] flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                        Equipo {equipoIndex + 1}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${completo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        {completo ? 'Checklist completo' : `${resumen.pendientes} pendiente(s)`}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">
                      {equipoDisplayName(equipo)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {equipoCaracteristicasDisplay(equipo)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Ubicación: {equipoUbicacionDisplay(equipo)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Respondidos:{' '}
                    <span className="font-semibold text-slate-900">
                      {resumen.respondidos}/{resumen.total}
                    </span>
                  </div>
                </div>
              </summary>

              <div className="space-y-5 p-4">
                {equipo.descripcion_trabajo ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <span className="font-semibold">Trabajo solicitado:</span> {equipo.descripcion_trabajo}
                  </div>
                ) : null}

                {groupedItems.map(([zona, zonaItems]) => (
                  <div key={`${equipo.id}-${zona}`} className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="bg-slate-50 px-4 py-3">
                      <h4 className="font-semibold text-slate-900">{zona}</h4>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {zonaItems.map((item) => {
                        const respuesta = respuestas[keyFor(equipo.id, item.id)] || EMPTY_RESPUESTA
                        const tipoMedicionMotor = medicionMotorTipo(item)

                        return (
                          <div key={`${equipo.id}-${item.id}`} className="grid gap-4 p-4 xl:grid-cols-[1fr_220px]">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{item.actividad}</p>
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
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClass(respuesta.respuesta_texto)}`}>
                                  {estadoLabel(respuesta.respuesta_texto)}
                                </span>
                                {respuesta.condicion_equipo ? (
                                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                    Condición: {condicionEquipoLabel(respuesta.condicion_equipo)}
                                  </span>
                                ) : null}
                                {respuesta.accion_checklist ? (
                                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                                    Acción: {accionChecklistLabel(respuesta.accion_checklist)}
                                  </span>
                                ) : null}
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

                              {tipoMedicionMotor ? (
                                <MedicionesMotorPanel
                                  tipo={tipoMedicionMotor}
                                  datos={respuesta.datos}
                                  onChange={(field, value) => setMedicionMotor(equipo.id, item.id, tipoMedicionMotor, field, value)}
                                />
                              ) : null}

                              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                <textarea
                                  value={respuesta.observacion_antes}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'observacion_antes', event.target.value)}
                                  rows={2}
                                  placeholder="Observación antes / condición encontrada"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                />
                                <textarea
                                  value={respuesta.observacion_despues}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'observacion_despues', event.target.value)}
                                  rows={2}
                                  placeholder="Observación después / resultado"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                />
                                <textarea
                                  value={respuesta.accion_realizada}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'accion_realizada', event.target.value)}
                                  rows={2}
                                  placeholder="Detalle adicional de la acción, si corresponde"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                />
                                <textarea
                                  value={respuesta.recomendacion_tecnica}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'recomendacion_tecnica', event.target.value)}
                                  rows={2}
                                  placeholder="Recomendación técnica"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                />
                              </div>

                              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm font-semibold text-slate-800">
                                    Evidencia fotográfica por ítem
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Sube una foto antes y una foto después si corresponde.
                                  </p>
                                </div>

                                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <p className="text-sm font-semibold text-slate-700">Foto antes</p>
                                      {respuesta.evidencia_antes_url ? (
                                        <button
                                          type="button"
                                          onClick={() => setRespuesta(equipo.id, item.id, 'evidencia_antes_url', '')}
                                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                        >
                                          Quitar
                                        </button>
                                      ) : null}
                                    </div>

                                    {respuesta.evidencia_antes_url ? (
                                      <a
                                        href={respuesta.evidencia_antes_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                                      >
                                        <img
                                          src={respuesta.evidencia_antes_url}
                                          alt={`Evidencia antes - ${item.actividad}`}
                                          className="h-44 w-full object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-400">
                                        Sin foto antes
                                      </div>
                                    )}

                                    <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                      {uploadingKey === evidenciaUploadKey(equipo.id, item.id, 'antes')
                                        ? 'Subiendo foto...'
                                        : respuesta.evidencia_antes_url
                                          ? 'Reemplazar foto antes'
                                          : 'Subir foto antes'}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        disabled={uploadingKey === evidenciaUploadKey(equipo.id, item.id, 'antes')}
                                        onChange={(event) => {
                                          const file = event.target.files?.[0] || null
                                          void uploadEvidencia(equipo, item, 'antes', file)
                                          event.currentTarget.value = ''
                                        }}
                                      />
                                    </label>
                                  </div>

                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <p className="text-sm font-semibold text-slate-700">Foto después</p>
                                      {respuesta.evidencia_despues_url ? (
                                        <button
                                          type="button"
                                          onClick={() => setRespuesta(equipo.id, item.id, 'evidencia_despues_url', '')}
                                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                        >
                                          Quitar
                                        </button>
                                      ) : null}
                                    </div>

                                    {respuesta.evidencia_despues_url ? (
                                      <a
                                        href={respuesta.evidencia_despues_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                                      >
                                        <img
                                          src={respuesta.evidencia_despues_url}
                                          alt={`Evidencia después - ${item.actividad}`}
                                          className="h-44 w-full object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-400">
                                        Sin foto después
                                      </div>
                                    )}

                                    <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                      {uploadingKey === evidenciaUploadKey(equipo.id, item.id, 'despues')
                                        ? 'Subiendo foto...'
                                        : respuesta.evidencia_despues_url
                                          ? 'Reemplazar foto después'
                                          : 'Subir foto después'}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        disabled={uploadingKey === evidenciaUploadKey(equipo.id, item.id, 'despues')}
                                        onChange={(event) => {
                                          const file = event.target.files?.[0] || null
                                          void uploadEvidencia(equipo, item, 'despues', file)
                                          event.currentTarget.value = ''
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  Resultado checklist
                                </label>
                                <select
                                  value={respuesta.respuesta_texto}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'respuesta_texto', event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                >
                                  <option value="">Sin responder</option>
                                  <option value="ok">OK</option>
                                  <option value="no_ok">No OK</option>
                                  <option value="na">No aplica</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  Condición encontrada
                                </label>
                                <select
                                  value={respuesta.condicion_equipo}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'condicion_equipo', event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                >
                                  <option value="">Sin clasificar</option>
                                  <option value="muy_bueno">Muy bueno</option>
                                  <option value="bueno">Bueno</option>
                                  <option value="regular">Regular</option>
                                  <option value="malo">Malo</option>
                                  <option value="muy_malo">Muy malo</option>
                                  <option value="no_aplica">No aplica</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  Acción / gestión
                                </label>
                                <select
                                  value={respuesta.accion_checklist}
                                  onChange={(event) => setRespuesta(equipo.id, item.id, 'accion_checklist', event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                                >
                                  <option value="">Sin acción</option>
                                  <option value="check">Check</option>
                                  <option value="limpieza">Limpieza</option>
                                  <option value="reparacion">Reparación</option>
                                  <option value="cambio">Cambio</option>
                                  <option value="aviso_sap">Aviso SAP</option>
                                  <option value="no_aplica">No aplica</option>
                                </select>
                              </div>

                              {item.requiere_observacion_si_no_ok && respuesta.respuesta_texto === 'no_ok' && !respuesta.observacion_antes.trim() ? (
                                <p className="text-xs text-amber-700">
                                  Agrega observación cuando el resultado sea No OK.
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
                    onClick={() => void guardarEquipo(equipo)}
                    disabled={savingEquipoId === equipo.id || !selectedPlantillaId || itemsTecnicos.length === 0}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                  >
                    {savingEquipoId === equipo.id ? 'Guardando checklist...' : 'Guardar checklist de este equipo'}
                  </button>
                </div>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
