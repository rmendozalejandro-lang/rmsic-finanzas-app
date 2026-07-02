'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import { OTEvidenciasPanel } from '../../../../components/ot/ot-evidencias-panel'
import { OTFirmasPanel } from '../../../../components/ot/ot-firmas-panel'
import { OTChecklistPanel } from '../../../../components/ot/ot-checklist-panel'
import { OTEquipoChecklistPanel } from '../../../../components/ot/ot-equipo-checklist-panel'
import { OTEquipoTrabajoDyFPanel } from '../../../../components/ot/ot-equipo-trabajo-dyf-panel'
import { supabase } from '../../../../lib/supabase/client'
import type { OTResumen } from '../../../../lib/ot/types'

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  cliente_id: string
  ubicacion_id: string | null
  activo_id: string | null
  cotizacion_id: string | null
  tipo_servicio_id: string
  plantilla_id: string | null
  estado_id: string
  fecha_ot: string
  fecha_programada: string | null
  fecha_cierre: string | null
  finalizado_tecnico_at: string | null
  finalizado_tecnico_by: string | null
  permitir_edicion_tecnico: boolean | null
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
  numero_om_cliente: string | null
  cantidad_tecnicos: number | null
  horas_hombre_utilizadas: number | null
  supervisor_contratista_nombre: string | null
  supervisor_contratista_rut: string | null
  supervisor_contratista_cargo: string | null
  herramientas_materiales_utilizados: string | null
  recomendaciones_seguridad: string | null
  seguridad_permiso_trabajo: boolean | null
  seguridad_uso_epp: boolean | null
  seguridad_bloqueo_tarjeta: boolean | null
  seguridad_observacion: string | null
  seguridad_validada_at: string | null
  seguridad_validada_by: string | null
  alcance_trabajo_ejecutado: boolean | null
  alcance_trabajo_observacion: string | null
  ejecutado_segun_programa: boolean | null
  ejecutado_segun_programa_observacion: string | null
  diagnostico: string | null
  causa_probable: string | null
  trabajo_realizado: string | null
  recomendaciones: string | null
  tecnico_responsable_id: string | null
  supervisor_id: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  requiere_checklist: boolean
  plantilla_checklist_id: string | null
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  cliente_nombre_firma: string | null
  cliente_cargo_firma: string | null
  observaciones_cierre: string | null
  mostrar_firma_cliente: boolean
  mostrar_firma_tecnico: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  contacto_cliente_id: string | null
  contacto_cliente_email: string | null
  contacto_cliente_nombre: string | null
  contacto_cliente_cargo: string | null
  area_trabajo: string | null
  resultado_servicio: string | null
  hallazgos: string | null
  conclusiones_tecnicas: string | null
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: number | null
}

type OTResumenConEquipo = OTResumen & {
  equipo_id: string | null
  equipo_tag: string | null
  equipo_nombre: string | null
  equipo_descripcion: string | null
  equipo_tipo: string | null
  equipo_planta: string | null
  equipo_area: string | null
  equipo_linea: string | null
  equipo_ubicacion: string | null
  equipo_marca: string | null
  equipo_modelo: string | null
  equipo_serie: string | null
  equipo_potencia: string | null
}

type ClienteContactoOption = {
  id: string
  cliente_id: string
  nombre: string
  cargo: string | null
  area: string | null
  linea: string | null
  email: string | null
  telefono: string | null
  tipo_contacto: string | null
  recibe_informes_ot: boolean | null
}

type EnvioEmail = {
  id: string
  contacto_cliente_id: string | null
  destinatario_nombre: string | null
  destinatario_cargo: string | null
  destinatario_email: string
  asunto: string
  estado: 'pendiente' | 'enviado' | 'error'
  proveedor_message_id: string | null
  error_mensaje: string | null
  enviado_at: string | null
  enviado_por: string | null
  created_at: string
}

type EquipoDisponible = {
  id: string
  empresa_id: string
  cliente_id: string | null
  cliente_nombre: string | null
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
  estado: string | null
  activo: boolean | null
  deleted_at: string | null
}

type EquipoAsociado = {
  id: string
  empresa_id: string
  ot_id: string
  equipo_id: string
  descripcion_trabajo: string | null
  observacion: string | null
  orden: number | null
  activo: boolean
  created_at: string
}

type EquipoAsociadoFormState = {
  equipo_id: string
  descripcion_trabajo: string
  observacion: string
}

type PlantillaChecklistInfo = {
  id: string
  nombre: string | null
  tipo_activo: string | null
}

type PlantillaOtConfig = {
  id: string
  codigo: string | null
  nombre: string | null
  flujo_ot: string | null
  formato_ot: string | null
  requiere_equipo_encabezado: boolean | null
  usa_equipos_multiples: boolean | null
  usa_checklist_por_equipo: boolean | null
  usa_checklist_por_horas: boolean | null
  usa_tecnicos_participantes: boolean | null
  requiere_rut_responsable_cliente: boolean | null
  tipo_equipo_permitido: string | null
}

type EstadoOption = {
  id: string
  codigo: string
  nombre: string
  orden: number
}

type TipoServicioOption = {
  id: string
  codigo: string
  nombre: string
}

type PerfilOption = {
  id: string
  label: string
  cargo?: string | null
  puedeCerrarOt?: boolean | null
  rolOt?: string | null
}


type OtTecnicoRow = {
  user_id: string | null
  nombre_completo: string | null
  cargo: string | null
  activo: boolean | null
  puede_crear_ot: boolean | null
  puede_cerrar_ot: boolean | null
  rol_ot?: string | null
}

type TiempoTrabajo = {
  id: string
  ot_id: string
  usuario_id: string
  fecha: string
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  tipo_tiempo: 'trabajo' | 'traslado' | 'espera' | 'supervision'
  observacion: string | null
  created_at: string
  updated_at: string
}

type FirmaMini = {
  id: string
  tipo_firma: 'tecnico' | 'cliente' | 'supervisor'
  fecha_firma: string
}


type RecepcionSoftysCheckKey =
  | 'alcance_ejecutado'
  | 'area_limpia'
  | 'seguridad_cumplida'
  | 'plazo_cumplido'
  | 'pruebas_realizadas'

type RecepcionSoftysEvaluacion = '' | 'Deficiente' | 'Malo' | 'Regular' | 'Bueno' | 'Excelente'

type RecepcionSoftysState = {
  checklist_recepcion: Record<RecepcionSoftysCheckKey, '' | 'si' | 'no'>
  evaluacion_general: RecepcionSoftysEvaluacion
  observaciones_recepcion: string
}

type InformeSoftysMini = {
  id: string
  datos: Record<string, any> | null
}

const RECEPCION_SOFTYS_ITEMS: Array<{ key: RecepcionSoftysCheckKey; label: string }> = [
  {
    key: 'alcance_ejecutado',
    label: 'Alcance del trabajo: ¿Se ejecutó todo lo solicitado?',
  },
  {
    key: 'area_limpia',
    label: 'Limpieza y orden: ¿Se retiraron residuos y herramientas, dejando la zona limpia?',
  },
  {
    key: 'seguridad_cumplida',
    label: 'Seguridad: ¿Se respetan las normas de seguridad y protocolos?',
  },
  {
    key: 'plazo_cumplido',
    label: 'Tiempo de ejecución: ¿Se completó dentro del plazo acordado?',
  },
  {
    key: 'pruebas_realizadas',
    label: 'Funcionamiento y pruebas: ¿Se verificó el correcto funcionamiento de lo ejecutado dentro de lo posible?',
  },
]

const RECEPCION_SOFTYS_EVALUACIONES: RecepcionSoftysEvaluacion[] = [
  'Deficiente',
  'Malo',
  'Regular',
  'Bueno',
  'Excelente',
]

const RECEPCION_SOFTYS_DEFAULT: RecepcionSoftysState = {
  checklist_recepcion: {
    alcance_ejecutado: '',
    area_limpia: '',
    seguridad_cumplida: '',
    plazo_cumplido: '',
    pruebas_realizadas: '',
  },
  evaluacion_general: '',
  observaciones_recepcion: '',
}

const DYF_EMPRESA_ID = '73dd5543-2bf7-4d44-9982-4a641c8658f5'

const SOFTYS_SEGURIDAD_ITEMS = [
  {
    key: 'seguridad_permiso_trabajo',
    codigo: '1.1',
    label: 'Permiso de trabajo seguro debidamente completado y autorizado',
  },
  {
    key: 'seguridad_uso_epp',
    codigo: '1.2',
    label: 'Uso de elementos de protección personal',
    helper: 'Caso de seguridad + protectores auditivos + lentes de seguridad + guantes',
  },
  {
    key: 'seguridad_bloqueo_tarjeta',
    codigo: '1.3',
    label: 'Uso de candado de bloqueo + tarjeta NO OPERAR',
  },
] as const

type FormState = {
  tipo_servicio_id: string
  estado_id: string
  fecha_ot: string
  fecha_programada: string
  titulo: string
  descripcion_solicitud: string
  problema_reportado: string
  numero_om_cliente: string
  hora_inicio: string
  hora_termino: string
  cantidad_tecnicos: string
  horas_hombre_utilizadas: string
  supervisor_contratista_nombre: string
  supervisor_contratista_rut: string
  supervisor_contratista_cargo: string
  herramientas_materiales_utilizados: string
  recomendaciones_seguridad: string
  seguridad_permiso_trabajo: boolean
  seguridad_uso_epp: boolean
  seguridad_bloqueo_tarjeta: boolean
  seguridad_observacion: string
  alcance_trabajo_ejecutado: '' | 'si' | 'no'
  alcance_trabajo_observacion: string
  ejecutado_segun_programa: '' | 'si' | 'no'
  ejecutado_segun_programa_observacion: string
  diagnostico: string
  causa_probable: string
  trabajo_realizado: string
  recomendaciones: string
  tecnico_responsable_id: string
  supervisor_id: string
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  requiere_checklist: boolean
  observaciones_cierre: string
  contacto_cliente_id: string
  contacto_cliente_email: string
  contacto_cliente_nombre: string
  contacto_cliente_cargo: string
  area_trabajo: string
  resultado_servicio: string
  hallazgos: string
  conclusiones_tecnicas: string
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: string
}

type TiempoFormState = {
  usuario_id: string
  fecha: string
  hora_inicio: string
  hora_termino: string
  termina_dia_siguiente: boolean
  tipo_tiempo: 'trabajo' | 'traslado' | 'espera' | 'supervision'
  observacion: string
}

function todayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const CHILE_TIME_ZONE = 'America/Santiago'

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return null

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function parseDateValue(value: string | null) {
  if (!value) return null

  const trimmed = value.trim()
  const dateOnly = parseDateOnly(trimmed)

  if (dateOnly) return dateOnly

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null

  return date
}

function formatDate(value: string | null) {
  const date = parseDateValue(value)
  if (!date) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeZone: CHILE_TIME_ZONE,
  }).format(date)
}

function formatDateTime(value: string | null) {
  const date = parseDateValue(value)
  if (!date) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: CHILE_TIME_ZONE,
  }).format(date)
}

function formatTimeOnly(value: string | null) {
  const date = parseDateValue(value)
  if (!date) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    timeStyle: 'short',
    timeZone: CHILE_TIME_ZONE,
  }).format(date)
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '-'

  const horas = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (horas === 0) return `${mins} min`
  if (mins === 0) return `${horas} h`

  return `${horas} h ${mins} min`
}

function labelOrDash(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'
  return value
}

function toTitleCase(text: string) {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function humanizePerson(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'

  const raw = value.trim()
  const lower = raw.toLowerCase()

  const knownMap: Record<string, string> = {
    'rmendoza@rmsic.cl': 'Raúl Mendoza',
    'dallendes@rmsic.cl': 'David Allendes',
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raúl mendoza c.': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
    'rmendoza': 'Raúl Mendoza',
    'dallendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raÃºl') && lower.includes('mendoza'))
  ) {
    return 'RaÃºl Mendoza'
  }

  if (
    lower.includes('dallendes') ||
    (lower.includes('david') && lower.includes('allendes'))
  ) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0].toLowerCase().trim()

    if (knownMap[localPart]) return knownMap[localPart]

    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

function toTimeInputValue(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${hour}:${minute}`
}

function dateAndTimeToISOString(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null

  const date = new Date(`${dateValue}T${timeValue}`)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function normalizeDateTimeForDuration(value: string, dateValue: string) {
  if (!value) return null
  if (/^\d{2}:\d{2}$/.test(value)) return new Date(`${dateValue}T${value}`)
  return new Date(value)
}

function calculateDurationMinutes(startValue: string, endValue: string, dateValue = todayLocalDate()) {
  if (!startValue || !endValue) return null

  const start = normalizeDateTimeForDuration(startValue, dateValue)
  const end = normalizeDateTimeForDuration(endValue, dateValue)

  if (!start || !end) return null
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end <= start) return null

  return Math.round((end.getTime() - start.getTime()) / 60000)
}

function parsePositiveNumber(value: string) {
  if (!value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function booleanFromSiNo(value: '' | 'si' | 'no') {
  if (value === 'si') return true
  if (value === 'no') return false
  return null
}

function siNoFromBoolean(value: boolean | null | undefined): '' | 'si' | 'no' {
  if (value === true) return 'si'
  if (value === false) return 'no'
  return ''
}


function recepcionSiNoFromBoolean(value: unknown): '' | 'si' | 'no' {
  if (value === true) return 'si'
  if (value === false) return 'no'
  return ''
}

function recepcionBooleanFromSiNo(value: '' | 'si' | 'no') {
  if (value === 'si') return true
  if (value === 'no') return false
  return undefined
}

function normalizarRecepcionSoftys(datos: Record<string, any> | null | undefined): RecepcionSoftysState {
  const checklist = (datos?.checklist_recepcion ?? {}) as Record<string, unknown>
  const evaluacion = typeof datos?.evaluacion_general === 'string'
    ? datos.evaluacion_general
    : ''

  return {
    checklist_recepcion: {
      alcance_ejecutado: recepcionSiNoFromBoolean(checklist.alcance_ejecutado),
      area_limpia: recepcionSiNoFromBoolean(checklist.area_limpia),
      seguridad_cumplida: recepcionSiNoFromBoolean(checklist.seguridad_cumplida),
      plazo_cumplido: recepcionSiNoFromBoolean(checklist.plazo_cumplido),
      pruebas_realizadas: recepcionSiNoFromBoolean(checklist.pruebas_realizadas),
    },
    evaluacion_general: RECEPCION_SOFTYS_EVALUACIONES.includes(evaluacion as RecepcionSoftysEvaluacion)
      ? (evaluacion as RecepcionSoftysEvaluacion)
      : '',
    observaciones_recepcion:
      typeof datos?.observaciones_recepcion === 'string' ? datos.observaciones_recepcion : '',
  }
}

function combineDateAndTimeToISOString(
  dateValue: string,
  timeValue: string,
  addDays = 0
) {
  if (!dateValue || !timeValue) return null

  const composed = new Date(`${dateValue}T${timeValue}`)
  if (Number.isNaN(composed.getTime())) return null

  if (addDays > 0) {
    composed.setDate(composed.getDate() + addDays)
  }

  return composed.toISOString()
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value ?? '-'}</p>
    </div>
  )
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  )
}

function CierreStatusItem({
  label,
  ok,
  detail,
}: {
  label: string
  ok: boolean
  detail: string
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        ok ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {ok ? 'OK' : 'Pendiente'}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{detail}</p>
    </div>
  )
}


function equipoDisplayName(equipo: EquipoDisponible | null | undefined) {
  if (!equipo) return '-'
  return [equipo.tag, equipo.nombre].filter(Boolean).join(' · ') || equipo.id
}

function equipoUbicacionDisplay(equipo: EquipoDisponible | null | undefined) {
  if (!equipo) return '-'
  const partes = [equipo.planta, equipo.area, equipo.linea, equipo.ubicacion].filter(Boolean)
  return partes.length > 0 ? partes.join(' / ') : '-'
}

function equipoCaracteristicasDisplay(equipo: EquipoDisponible | null | undefined) {
  if (!equipo) return '-'
  const partes = [equipo.tipo_equipo, equipo.marca, equipo.modelo, equipo.potencia].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : '-'
}

function normalizeChecklistText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getTiposEquipoPermitidos(info: PlantillaChecklistInfo | null) {
  const raw = normalizeChecklistText([info?.tipo_activo, info?.nombre].filter(Boolean).join(' '))

  if (!raw) return []

  if (raw.includes('valvula control') || raw.includes('valvula_control') || raw.includes('control')) {
    return ['valvula_control']
  }

  if (raw.includes('valvula') || raw.includes('valvulas')) {
    return ['valvula', 'valvula_control']
  }

  if (raw.includes('motor') || raw.includes('motores')) {
    return ['motor']
  }

  if (raw.includes('bomba') || raw.includes('bombas')) {
    return ['bomba']
  }

  if (raw.includes('variador') || raw.includes('vdf')) {
    return ['vdf']
  }

  if (raw.includes('flujo')) {
    return ['transmisor_flujo']
  }

  if (raw.includes('presion') || raw.includes('presión')) {
    return ['transmisor_presion']
  }

  return []
}


function getTiposEquipoPermitidosDesdeValor(value: string | null | undefined) {
  const raw = normalizeChecklistText(value)

  if (!raw) return []

  if (raw.includes('valvula control') || raw.includes('valvula_control') || raw.includes('control')) {
    return ['valvula_control', 'valvula']
  }

  if (raw.includes('valvula') || raw.includes('valvulas')) {
    return ['valvula', 'valvula_control']
  }

  if (raw.includes('motor') || raw.includes('motores')) {
    return ['motor']
  }

  if (raw.includes('bomba') || raw.includes('bombas')) {
    return ['bomba']
  }

  if (raw.includes('variador') || raw.includes('vdf')) {
    return ['vdf']
  }

  if (raw.includes('flujo')) {
    return ['transmisor_flujo']
  }

  if (raw.includes('presion')) {
    return ['transmisor_presion']
  }

  return [raw]
}

function normalizeTipoEquipoParaFiltro(value: string | null | undefined) {
  const raw = normalizeChecklistText(value)

  if (!raw) return ''
  if (raw.includes('valvula control') || raw.includes('valvula_control') || raw.includes('control')) return 'valvula_control'
  if (raw.includes('valvula')) return 'valvula'
  if (raw.includes('motor')) return 'motor'
  if (raw.includes('bomba')) return 'bomba'
  if (raw.includes('variador') || raw.includes('vdf')) return 'vdf'
  if (raw.includes('flujo')) return 'transmisor_flujo'
  if (raw.includes('presion')) return 'transmisor_presion'
  return raw
}

function tipoEquipoSingularLabel(value: string | null | undefined) {
  const raw = normalizeChecklistText(value)
  if (raw.includes('valvula')) return 'válvula'
  if (raw.includes('motor')) return 'motor'
  if (raw.includes('bomba')) return 'bomba'
  if (raw.includes('variador') || raw.includes('vdf')) return 'variador'
  return 'equipo'
}

function tiposEquipoPermitidosLabel(tipos: string[]) {
  if (tipos.length === 0) return ''

  const labels: Record<string, string> = {
    motor: 'motores',
    valvula: 'válvulas',
    valvula_control: 'válvulas de control',
    bomba: 'bombas',
    vdf: 'variadores de frecuencia',
    transmisor_flujo: 'transmisores de flujo',
    transmisor_presion: 'transmisores de presión',
  }

  return tipos.map((tipo) => labels[tipo] || tipo).join(' / ')
}

function prioridadEquipoClass(criticidad: string | null | undefined) {
  if (criticidad === 'critica') return 'border-red-200 bg-red-50 text-red-800'
  if (criticidad === 'alta') return 'border-orange-200 bg-orange-50 text-orange-800'
  if (criticidad === 'media') return 'border-blue-200 bg-blue-50 text-blue-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function OTDetalleContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const otId = useMemo(() => {
    const raw = params?.id
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return raw[0] ?? ''
    return ''
  }, [params])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTiempo, setSavingTiempo] = useState(false)
  const [closingOt, setClosingOt] = useState(false)
  const [autorizandoEdicionTecnica, setAutorizandoEdicionTecnica] = useState(false)
  const [sendingInforme, setSendingInforme] = useState(false)
  const [deletingOt, setDeletingOt] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [warning, setWarning] = useState('')
  const [tiempoError, setTiempoError] = useState('')
  const [tiempoSuccess, setTiempoSuccess] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [cierreError, setCierreError] = useState('')
  const [cierreSuccess, setCierreSuccess] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteMotivo, setDeleteMotivo] = useState('')

  const [resumen, setResumen] = useState<OTResumenConEquipo | null>(null)
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [tiempos, setTiempos] = useState<TiempoTrabajo[]>([])
  const [firmas, setFirmas] = useState<FirmaMini[]>([])
  const [contactosCliente, setContactosCliente] = useState<ClienteContactoOption[]>([])
  const [enviosEmail, setEnviosEmail] = useState<EnvioEmail[]>([])
  const [equiposDisponibles, setEquiposDisponibles] = useState<EquipoDisponible[]>([])
  const [equiposAsociados, setEquiposAsociados] = useState<EquipoAsociado[]>([])
  const [plantillaChecklistInfo, setPlantillaChecklistInfo] = useState<PlantillaChecklistInfo | null>(null)
  const [plantillaOtConfig, setPlantillaOtConfig] = useState<PlantillaOtConfig | null>(null)
  const [equipoForm, setEquipoForm] = useState<EquipoAsociadoFormState>({
    equipo_id: '',
    descripcion_trabajo: '',
    observacion: '',
  })
  const [savingEquipoAsociado, setSavingEquipoAsociado] = useState(false)
  const [equipoAsociadoError, setEquipoAsociadoError] = useState('')
  const [equipoAsociadoSuccess, setEquipoAsociadoSuccess] = useState('')
  const [checklistResponsesCount, setChecklistResponsesCount] = useState(0)
  const [informeSoftysId, setInformeSoftysId] = useState('')
  const [informeSoftysDatosBase, setInformeSoftysDatosBase] = useState<Record<string, any>>({})
  const [recepcionSoftys, setRecepcionSoftys] = useState<RecepcionSoftysState>(RECEPCION_SOFTYS_DEFAULT)
  const [recepcionSoftysError, setRecepcionSoftysError] = useState('')
  const [recepcionSoftysSuccess, setRecepcionSoftysSuccess] = useState('')
  const [savingRecepcionSoftys, setSavingRecepcionSoftys] = useState(false)
  const [perfilesMap, setPerfilesMap] = useState<Record<string, string>>({})

  const [estados, setEstados] = useState<EstadoOption[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicioOption[]>([])
  const [perfiles, setPerfiles] = useState<PerfilOption[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentRole, setCurrentRole] = useState('')

  const [form, setForm] = useState<FormState>({
    tipo_servicio_id: '',
    estado_id: '',
    fecha_ot: '',
    fecha_programada: '',
    titulo: '',
    descripcion_solicitud: '',
    problema_reportado: '',
    numero_om_cliente: '',
    hora_inicio: '',
    hora_termino: '',
    cantidad_tecnicos: '',
    horas_hombre_utilizadas: '',
    supervisor_contratista_nombre: '',
    supervisor_contratista_rut: '',
    supervisor_contratista_cargo: '',
    herramientas_materiales_utilizados: '',
    recomendaciones_seguridad: '',
    seguridad_permiso_trabajo: false,
    seguridad_uso_epp: false,
    seguridad_bloqueo_tarjeta: false,
    seguridad_observacion: '',
    alcance_trabajo_ejecutado: '',
    alcance_trabajo_observacion: '',
    ejecutado_segun_programa: '',
    ejecutado_segun_programa_observacion: '',
    diagnostico: '',
    causa_probable: '',
    trabajo_realizado: '',
    recomendaciones: '',
    tecnico_responsable_id: '',
    supervisor_id: '',
    prioridad: 'media',
    requiere_checklist: false,
    observaciones_cierre: '',
    contacto_cliente_id: '',
    contacto_cliente_email: '',
    contacto_cliente_nombre: '',
    contacto_cliente_cargo: '',
    area_trabajo: '',
    resultado_servicio: '',
    hallazgos: '',
    conclusiones_tecnicas: '',
    mostrar_nota_valor_hora: false,
    valor_hora_uf: '2.10',
  })

  const [tiempoForm, setTiempoForm] = useState<TiempoFormState>({
    usuario_id: '',
    fecha: todayLocalDate(),
    hora_inicio: '',
    hora_termino: '',
    termina_dia_siguiente: false,
    tipo_tiempo: 'trabajo',
    observacion: '',
  })

  const tipoPreventivaId = useMemo(() => {
    return tiposServicio.find((item) => item.codigo === 'preventiva')?.id ?? ''
  }, [tiposServicio])

  const selectedTipo = useMemo(() => {
    return tiposServicio.find((item) => item.id === form.tipo_servicio_id) ?? null
  }, [tiposServicio, form.tipo_servicio_id])

  const tipoCodigo = selectedTipo?.codigo ?? ''
  const tipoCodigoNormalizado = tipoCodigo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const isPreventivaMespack =
    tipoCodigoNormalizado === 'preventiva' ||
    tipoCodigoNormalizado.includes('mantencion_mespack') ||
    tipoCodigoNormalizado.includes('mantenimiento_mespack')
  const isPreventivaGeneral =
    tipoCodigoNormalizado === 'preventiva_general' ||
    tipoCodigoNormalizado.includes('mantencion_general') ||
    tipoCodigoNormalizado.includes('mantenimiento_general')
  const isPreventiva = isPreventivaMespack || isPreventivaGeneral
  const checklistTipoActivoNormalizado = (plantillaChecklistInfo?.tipo_activo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const esChecklistSoftysPorEquipo =
    checklistTipoActivoNormalizado.includes('motor') ||
    checklistTipoActivoNormalizado.includes('valvula')

  const esFlujoDyfSoftys =
    plantillaOtConfig?.flujo_ot === 'dyf_softys' ||
    plantillaOtConfig?.formato_ot === 'softys_checklist_equipo' ||
    plantillaOtConfig?.codigo === 'softys_om' ||
    plantillaOtConfig?.codigo === 'softys_valvulas' ||
    plantillaOtConfig?.codigo === 'softys_motores' ||
    esChecklistSoftysPorEquipo
  const usaEquiposMultiples = Boolean(plantillaOtConfig?.usa_equipos_multiples)
  const usaTecnicosParticipantes = Boolean(plantillaOtConfig?.usa_tecnicos_participantes)
  const usaChecklistPorEquipo = esFlujoDyfSoftys && Boolean(plantillaOtConfig?.usa_checklist_por_equipo)
  const usaChecklistRmsicMespack =
    !esFlujoDyfSoftys &&
    (isPreventivaMespack || Boolean(plantillaOtConfig?.usa_checklist_por_horas))
  const documentoTrabajoLabel = esFlujoDyfSoftys ? 'OM' : 'OT'
  const isUrgencia = tipoCodigoNormalizado.includes('urgencia')
  const isAsistencia = tipoCodigoNormalizado.includes('asistencia')
  const isMantenimientoGeneral =
    tipoCodigoNormalizado.includes('mantencion_general') ||
    tipoCodigoNormalizado.includes('mantenimiento_general')
  const isUrgenciaOAsistencia = isUrgencia || isAsistencia
  const isAsesoria = tipoCodigoNormalizado.includes('asesoria') || tipoCodigoNormalizado.includes('consultoria')
  const isServicioTecnicoSimple =
    !usaChecklistPorEquipo &&
    (esFlujoDyfSoftys || isAsistencia || isUrgencia || isMantenimientoGeneral || isAsesoria)
  const informePrincipalLabel = esFlujoDyfSoftys
    ? usaChecklistPorEquipo
      ? 'Informe OM'
      : 'Informe técnico'
    : 'PDF OT'
  const ejecucionTecnicaIntro = usaChecklistPorEquipo
    ? 'Completa checklist, evidencias, término y firma de recepción.'
    : 'Registra el desarrollo técnico del servicio, término y firma de recepción.'

  const perfilesBitacora = useMemo(() => {
    if (!esFlujoDyfSoftys) return perfiles

    const idsAsociados = new Set(
      [form.tecnico_responsable_id, form.supervisor_id]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )

    return perfiles.filter((perfil) => idsAsociados.has(perfil.id))
  }, [esFlujoDyfSoftys, perfiles, form.tecnico_responsable_id, form.supervisor_id])

  const estadoCerrada = useMemo(() => {
    return estados.find((item) => item.codigo === 'cerrada') ?? null
  }, [estados])

  const isClosed = useMemo(() => {
    return resumen?.estado_nombre?.toLowerCase() === 'cerrada'
  }, [resumen])

  const duracionOmMinutos = useMemo(() => {
    return calculateDurationMinutes(form.hora_inicio, form.hora_termino, form.fecha_ot || todayLocalDate())
  }, [form.hora_inicio, form.hora_termino, form.fecha_ot])

  const horasHombreSugeridas = useMemo(() => {
    const cantidadTecnicos = parsePositiveNumber(form.cantidad_tecnicos)

    if (duracionOmMinutos == null || cantidadTecnicos == null || cantidadTecnicos <= 0) {
      return null
    }

    return Number(((duracionOmMinutos / 60) * cantidadTecnicos).toFixed(2))
  }, [duracionOmMinutos, form.cantidad_tecnicos])

  const totalTiempoRegistrado = useMemo(() => {
    return tiempos.reduce((acc, item) => acc + (item.duracion_minutos ?? 0), 0)
  }, [tiempos])

  const requiresChecklistForClose = useMemo(() => {
    return Boolean(
      usaChecklistPorEquipo &&
      form.requiere_checklist &&
      detalle?.plantilla_checklist_id
    )
  }, [usaChecklistPorEquipo, form.requiere_checklist, detalle?.plantilla_checklist_id])

  const hasTrabajoRealizado = useMemo(() => {
    if (isUrgencia) {
      return (
        !!form.problema_reportado.trim() ||
        !!form.causa_probable.trim() ||
        !!form.trabajo_realizado.trim() ||
        !!form.recomendaciones.trim()
      )
    }

    if (isAsistencia || isMantenimientoGeneral) {
      return (
        !!form.trabajo_realizado.trim() ||
        !!form.resultado_servicio.trim() ||
        !!form.hallazgos.trim() ||
        !!form.recomendaciones.trim()
      )
    }

    if (isAsesoria) {
      return !!form.diagnostico.trim() || !!form.conclusiones_tecnicas.trim()
    }

    return !!form.trabajo_realizado.trim()
  }, [
    form.problema_reportado,
    form.causa_probable,
    form.trabajo_realizado,
    form.recomendaciones,
    form.resultado_servicio,
    form.hallazgos,
    form.diagnostico,
    form.conclusiones_tecnicas,
    isUrgencia,
    isAsistencia,
    isMantenimientoGeneral,
    isAsesoria,
  ])

  const hasChecklistResponses = useMemo(() => {
    if (!requiresChecklistForClose) return true
    return checklistResponsesCount > 0
  }, [requiresChecklistForClose, checklistResponsesCount])

  const hasContenidoPrincipalParaCierre = useMemo(() => {
    if (usaChecklistPorEquipo) return hasChecklistResponses
    return hasTrabajoRealizado
  }, [usaChecklistPorEquipo, hasChecklistResponses, hasTrabajoRealizado])

  const hasTiempos = useMemo(() => tiempos.length > 0, [tiempos])
  const hasAnyFirma = useMemo(() => firmas.length > 0, [firmas])

  const hasFirmaTecnico = useMemo(
    () => firmas.some((item) => item.tipo_firma === 'tecnico'),
    [firmas]
  )

  const hasFirmaCliente = useMemo(
    () => firmas.some((item) => item.tipo_firma === 'cliente'),
    [firmas]
  )

  const selectedContactoCliente = useMemo(() => {
    return contactosCliente.find((item) => item.id === form.contacto_cliente_id) ?? null
  }, [contactosCliente, form.contacto_cliente_id])

  const contactoEmailParaEnvio = useMemo(() => {
    return selectedContactoCliente?.email || form.contacto_cliente_email || ''
  }, [selectedContactoCliente, form.contacto_cliente_email])

  const equiposAsociadosIds = useMemo(() => {
    return new Set(equiposAsociados.filter((item) => item.activo).map((item) => item.equipo_id))
  }, [equiposAsociados])

  const tiposEquipoPermitidos = useMemo(() => {
    const desdePlantillaOt = getTiposEquipoPermitidosDesdeValor(plantillaOtConfig?.tipo_equipo_permitido)
    if (desdePlantillaOt.length > 0) return desdePlantillaOt
    return getTiposEquipoPermitidos(plantillaChecklistInfo)
  }, [plantillaOtConfig?.tipo_equipo_permitido, plantillaChecklistInfo])

  const tipoEquipoSingular = useMemo(() => {
    return tipoEquipoSingularLabel(plantillaOtConfig?.tipo_equipo_permitido)
  }, [plantillaOtConfig?.tipo_equipo_permitido])

  const filtroTipoEquipoLabel = useMemo(() => {
    return tiposEquipoPermitidosLabel(tiposEquipoPermitidos)
  }, [tiposEquipoPermitidos])

  const equiposDisponiblesParaAgregar = useMemo(() => {
    return equiposDisponibles
      .filter((equipo) => equipo.activo !== false && equipo.estado !== 'baja')
      .filter((equipo) => !equiposAsociadosIds.has(equipo.id))
      .filter((equipo) => !detalle?.cliente_id || !equipo.cliente_id || equipo.cliente_id === detalle.cliente_id)
      .filter((equipo) => {
        if (tiposEquipoPermitidos.length === 0) return true
        return tiposEquipoPermitidos.includes(normalizeTipoEquipoParaFiltro(equipo.tipo_equipo))
      })
      .sort((a, b) => (a.tag || '').localeCompare(b.tag || '', 'es'))
  }, [equiposDisponibles, equiposAsociadosIds, detalle?.cliente_id, tiposEquipoPermitidos])

  const equiposDisponiblesMap = useMemo(() => {
    return equiposDisponibles.reduce<Record<string, EquipoDisponible>>((acc, item) => {
      acc[item.id] = item
      return acc
    }, {})
  }, [equiposDisponibles])

  const getUserLabel = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return '-'
      return perfilesMap[userId] || userId
    },
    [perfilesMap]
  )

  const perfilesSupervisores = useMemo(() => {
    const supervisorRolesOt = new Set(['supervisor', 'jefe', 'admin_ot', 'administrador_ot'])

    return perfiles.filter((perfil) => {
      const rolOt = (perfil.rolOt || '').trim().toLowerCase()
      const cargo = (perfil.cargo || '').trim().toLowerCase()

      return (
        supervisorRolesOt.has(rolOt) ||
        cargo.includes('supervisor') ||
        cargo.includes('jefe')
      )
    })
  }, [perfiles])

  const loadData = useCallback(
    async (withLoader = true) => {
      try {
        if (withLoader) setLoading(true)

        setError('')
        setWarning('')
        setDeleteError('')

        if (!otId) {
          throw new Error('No se recibiÃ³ el identificador de la OT.')
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(`No se pudo validar el usuario actual: ${userError.message}`)
        }

        if (!user) {
          throw new Error('No hay usuario autenticado.')
        }

        setCurrentUserId(user.id)

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('empresa_activa_id') || ''
            : ''

        let rolActual = ''

        if (empresaActivaId) {
          const rolResp = await supabase
            .from('usuario_empresas')
            .select('rol')
            .eq('usuario_id', user.id)
            .eq('empresa_id', empresaActivaId)
            .eq('activo', true)
            .maybeSingle()

          if (!rolResp.error && rolResp.data?.rol) {
            rolActual = rolResp.data.rol
          }
        }

        setCurrentRole(rolActual)

        const [
          resumenResp,
          detalleResp,
          estadosResp,
          tiposResp,
          tiemposResp,
          firmasResp,
          checklistResp,
        ] = await Promise.all([
          supabase.from('ot_vw_resumen').select('*').eq('id', otId).maybeSingle(),
          supabase
            .from('ot_ordenes_trabajo')
            .select(
              `
                id,
                folio,
                empresa_id,
                cliente_id,
                ubicacion_id,
                activo_id,
                cotizacion_id,
                tipo_servicio_id,
                plantilla_id,
                estado_id,
                fecha_ot,
                fecha_programada,
                fecha_cierre,
                finalizado_tecnico_at,
                finalizado_tecnico_by,
                permitir_edicion_tecnico,
                titulo,
                descripcion_solicitud,
                problema_reportado,
                numero_om_cliente,
                cantidad_tecnicos,
                horas_hombre_utilizadas,
                supervisor_contratista_nombre,
                supervisor_contratista_rut,
                supervisor_contratista_cargo,
                herramientas_materiales_utilizados,
                recomendaciones_seguridad,
                seguridad_permiso_trabajo,
                seguridad_uso_epp,
                seguridad_bloqueo_tarjeta,
                seguridad_observacion,
                seguridad_validada_at,
                seguridad_validada_by,
                alcance_trabajo_ejecutado,
                alcance_trabajo_observacion,
                ejecutado_segun_programa,
                ejecutado_segun_programa_observacion,
                diagnostico,
                causa_probable,
                trabajo_realizado,
                recomendaciones,
                tecnico_responsable_id,
                supervisor_id,
                prioridad,
                requiere_checklist,
                plantilla_checklist_id,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                cliente_nombre_firma,
                cliente_cargo_firma,
                observaciones_cierre,
                mostrar_firma_cliente,
                mostrar_firma_tecnico,
                created_by,
                created_at,
                updated_at,
                contacto_cliente_id,
                contacto_cliente_email,
                contacto_cliente_nombre,
                contacto_cliente_cargo,
                area_trabajo,
                resultado_servicio,
                hallazgos,
                conclusiones_tecnicas,
                mostrar_nota_valor_hora,
                valor_hora_uf
              `
            )
            .eq('id', otId)
            .eq('activo', true)
            .is('deleted_at', null)
            .maybeSingle(),
          supabase
            .from('ot_estados')
            .select('id, codigo, nombre, orden')
            .eq('activo', true)
            .order('orden', { ascending: true }),
          supabase
            .from('ot_tipos_servicio')
            .select('id, codigo, nombre')
            .eq('activo', true)
            .order('nombre', { ascending: true }),
          supabase
            .from('ot_tiempos_trabajo')
            .select(
              `
                id,
                ot_id,
                usuario_id,
                fecha,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                tipo_tiempo,
                observacion,
                created_at,
                updated_at
              `
            )
            .eq('ot_id', otId)
            .eq('activo', true)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('ot_firmas')
            .select('id, tipo_firma, fecha_firma')
            .eq('ot_id', otId)
            .order('fecha_firma', { ascending: false }),
          (supabase as any)
            .from('ot_equipo_checklist_resultados')
            .select('id')
            .eq('ot_id', otId),
        ])

        if (resumenResp.error) {
          throw new Error(`No se pudo cargar el resumen OT: ${resumenResp.error.message}`)
        }
        if (detalleResp.error) {
          throw new Error(`No se pudo cargar el detalle OT: ${detalleResp.error.message}`)
        }
        if (!resumenResp.data || !detalleResp.data) {
          throw new Error(
            'No se encontró la OT solicitada o fue archivada. Vuelve al listado y selecciona una OT activa.'
          )
        }
        if (estadosResp.error) {
          throw new Error(`No se pudieron cargar los estados: ${estadosResp.error.message}`)
        }
        if (tiposResp.error) {
          throw new Error(
            `No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`
          )
        }
        if (tiemposResp.error) {
          throw new Error(`No se pudieron cargar los tiempos: ${tiemposResp.error.message}`)
        }
        if (firmasResp.error) {
          throw new Error(`No se pudieron cargar las firmas: ${firmasResp.error.message}`)
        }
        if (checklistResp.error) {
          throw new Error(`No se pudo validar checklist: ${checklistResp.error.message}`)
        }

        const resumenData = resumenResp.data as OTResumenConEquipo
        const detalleData = detalleResp.data as OTDetalle
        const estadosData = (estadosResp.data ?? []) as EstadoOption[]
        const tiposData = (tiposResp.data ?? []) as TipoServicioOption[]
        const tiemposData = (tiemposResp.data ?? []) as TiempoTrabajo[]
        const firmasData = (firmasResp.data ?? []) as FirmaMini[]
        const checklistData = checklistResp.data ?? []

        const informeSoftysResp = await supabase
          .from('ot_informes_tecnicos')
          .select('id, datos')
          .eq('ot_id', otId)
          .eq('plantilla_codigo', 'softys_om')
          .maybeSingle()

        if (informeSoftysResp.error) {
          throw new Error(`No se pudo cargar el checklist de recepción: ${informeSoftysResp.error.message}`)
        }

        const informeSoftysData = (informeSoftysResp.data ?? null) as InformeSoftysMini | null

        const plantillaChecklistPromise = detalleData.plantilla_checklist_id
          ? (supabase as any)
              .from('ot_plantillas_checklist')
              .select('id, nombre, tipo_activo')
              .eq('id', detalleData.plantilla_checklist_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })

        const plantillaOtConfigPromise = detalleData.plantilla_id
          ? (supabase as any)
              .from('ot_plantillas')
              .select('id, codigo, nombre, flujo_ot, formato_ot, requiere_equipo_encabezado, usa_equipos_multiples, usa_checklist_por_equipo, usa_checklist_por_horas, usa_tecnicos_participantes, requiere_rut_responsable_cliente, tipo_equipo_permitido')
              .eq('id', detalleData.plantilla_id)
              .eq('empresa_id', detalleData.empresa_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })

        const [plantillaChecklistResp, plantillaOtConfigResp, contactosResp, enviosEmailResp, equiposAsociadosResp, equiposDisponiblesResp] = await Promise.all([
          plantillaChecklistPromise,
          plantillaOtConfigPromise,
          supabase
            .from('cliente_contactos')
            .select('id, cliente_id, nombre, cargo, area, linea, email, telefono, tipo_contacto, recibe_informes_ot')
            .eq('empresa_id', detalleData.empresa_id)
            .eq('cliente_id', detalleData.cliente_id)
            .eq('activo', true)
            .order('nombre', { ascending: true }),
          supabase
            .from('ot_envios_email')
            .select('id, contacto_cliente_id, destinatario_nombre, destinatario_cargo, destinatario_email, asunto, estado, proveedor_message_id, error_mensaje, enviado_at, enviado_por, created_at')
            .eq('empresa_id', detalleData.empresa_id)
            .eq('ot_id', otId)
            .order('created_at', { ascending: false }),
          (supabase as any)
            .from('ot_orden_equipos')
            .select('id, empresa_id, ot_id, equipo_id, descripcion_trabajo, observacion, orden, activo, created_at')
            .eq('empresa_id', detalleData.empresa_id)
            .eq('ot_id', otId)
            .eq('activo', true)
            .is('deleted_at', null)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('ot_vw_equipos')
            .select('id, empresa_id, cliente_id, cliente_nombre, tag, nombre, descripcion, tipo_equipo, planta, area, linea, ubicacion, marca, modelo, serie, potencia, criticidad, estado, activo, deleted_at')
            .eq('empresa_id', detalleData.empresa_id)
            .is('deleted_at', null)
            .order('tag', { ascending: true }),
        ])

        if (plantillaChecklistResp.error) {
          throw new Error(`No se pudo cargar la plantilla de checklist: ${plantillaChecklistResp.error.message}`)
        }

        if (plantillaOtConfigResp.error) {
          throw new Error(`No se pudo cargar la configuración de plantilla OT: ${plantillaOtConfigResp.error.message}`)
        }

        if (contactosResp.error) {
          throw new Error(`No se pudieron cargar los contactos del cliente: ${contactosResp.error.message}`)
        }

        if (enviosEmailResp.error) {
          throw new Error(`No se pudo cargar el historial de envíos: ${enviosEmailResp.error.message}`)
        }

        if (equiposAsociadosResp.error) {
          throw new Error(`No se pudieron cargar los equipos asociados a la OM: ${equiposAsociadosResp.error.message}`)
        }

        if (equiposDisponiblesResp.error) {
          throw new Error(`No se pudieron cargar los equipos disponibles: ${equiposDisponiblesResp.error.message}`)
        }

        const plantillaChecklistData = (plantillaChecklistResp.data ?? null) as PlantillaChecklistInfo | null
        const plantillaOtConfigData = (plantillaOtConfigResp.data ?? null) as PlantillaOtConfig | null
        const contactosData = (contactosResp.data ?? []) as ClienteContactoOption[]
        const enviosEmailData = (enviosEmailResp.data ?? []) as EnvioEmail[]
        const equiposAsociadosData = (equiposAsociadosResp.data ?? []) as EquipoAsociado[]
        const equiposDisponiblesData = (equiposDisponiblesResp.data ?? []) as EquipoDisponible[]

        if (
          rolActual === 'tecnico_ot' &&
          detalleData.tecnico_responsable_id !== user.id &&
          detalleData.created_by !== user.id
        ) {
          throw new Error('No tienes permisos para acceder a esta OT.')
        }

        let perfilesSelectData: PerfilOption[] = []
        let perfilesWarning = ''
        let nextMap: Record<string, string> = {}

        const tecnicosResp = await supabase
          .from('ot_tecnicos')
          .select('user_id, nombre_completo, cargo, activo, puede_crear_ot, puede_cerrar_ot, rol_ot')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (tecnicosResp.error) {
          perfilesWarning = 'No se pudo cargar la lista de técnicos OT de la empresa.'
        } else {
          const tecnicosOt = ((tecnicosResp.data ?? []) as OtTecnicoRow[]).filter((item) =>
            Boolean(item.user_id)
          )

          const userIds = Array.from(
            new Set(
              tecnicosOt
                .map((item) => item.user_id)
                .filter((value): value is string => Boolean(value))
            )
          )

          const perfilesEmpresaResp =
            userIds.length > 0
              ? await supabase
                  .from('perfiles')
                  .select('id, nombre_completo, email')
                  .in('id', userIds)
              : { data: [], error: null }

          if (perfilesEmpresaResp.error) {
            perfilesWarning = 'No se pudieron cargar los perfiles asociados a los técnicos OT.'
          } else {
            const perfilesEmpresa =
              (perfilesEmpresaResp.data ?? []) as Array<{
                id: string
                nombre_completo: string | null
                email: string | null
              }>

            const perfilesById = perfilesEmpresa.reduce<
              Record<string, { id: string; nombre_completo: string | null; email: string | null }>
            >((acc, item) => {
              acc[item.id] = item
              return acc
            }, {})

            perfilesSelectData = tecnicosOt
              .map((tecnico) => {
                const userId = tecnico.user_id || ''
                const perfil = perfilesById[userId]
                const nombre =
                  tecnico.nombre_completo?.trim() ||
                  perfil?.nombre_completo?.trim() ||
                  perfil?.email?.trim() ||
                  'Técnico OT'
                const cargo = tecnico.cargo?.trim()
                const email = perfil?.email?.trim()
                const labelParts = [nombre]

                if (cargo) labelParts.push(cargo)
                if (email) labelParts.push(email)

                return {
                  id: userId,
                  label: labelParts.join(' - '),
                  cargo,
                  puedeCerrarOt: tecnico.puede_cerrar_ot,
                  rolOt: tecnico.rol_ot,
                }
              })
              .filter((item) => Boolean(item.id))
              .sort((a, b) => a.label.localeCompare(b.label, 'es'))

            nextMap = perfilesSelectData.reduce<Record<string, string>>(
              (acc, item) => {
                acc[item.id] = item.label
                return acc
              },
              {}
            )
          }
        }

        const allowedPerfilIds = new Set(perfilesSelectData.map((item) => item.id))
        const tecnicoResponsableId = detalleData.tecnico_responsable_id || ''
        const supervisorId = detalleData.supervisor_id || ''
        const tecnicoAsignadoValido =
          !!tecnicoResponsableId && allowedPerfilIds.has(tecnicoResponsableId)
        const supervisorAsignadoValido =
          !!supervisorId && allowedPerfilIds.has(supervisorId)

        if (tecnicoResponsableId && !tecnicoAsignadoValido) {
          perfilesWarning = perfilesWarning
            ? `${perfilesWarning} Además, el técnico asignado no pertenece a la empresa de esta OT.`
            : 'El técnico asignado no pertenece a la empresa de esta OT. Debes reasignarlo antes de guardar.'
        }

        if (supervisorId && !supervisorAsignadoValido) {
          perfilesWarning = perfilesWarning
            ? `${perfilesWarning} Además, el supervisor asignado no pertenece a la empresa de esta OT.`
            : 'El supervisor asignado no pertenece a la empresa de esta OT. Debes reasignarlo antes de guardar.'
        }

        setResumen(resumenData)
        setDetalle(detalleData)
        setEstados(estadosData)
        setTiposServicio(tiposData)
        setTiempos(tiemposData)
        setFirmas(firmasData)
        setContactosCliente(contactosData)
        setEnviosEmail(enviosEmailData)
        setEquiposAsociados(equiposAsociadosData)
        setEquiposDisponibles(equiposDisponiblesData)
        setPlantillaChecklistInfo(plantillaChecklistData)
        setPlantillaOtConfig(plantillaOtConfigData)
        setChecklistResponsesCount(checklistData.length)
        setInformeSoftysId(informeSoftysData?.id ?? '')
        setInformeSoftysDatosBase((informeSoftysData?.datos ?? {}) as Record<string, any>)
        setRecepcionSoftys(normalizarRecepcionSoftys(informeSoftysData?.datos))
        setRecepcionSoftysError('')
        setRecepcionSoftysSuccess('')
        setPerfiles(perfilesSelectData)
        setPerfilesMap(nextMap)
        setWarning(perfilesWarning)

        setForm({
          tipo_servicio_id: detalleData.tipo_servicio_id,
          estado_id: detalleData.estado_id,
          fecha_ot: toDateInputValue(detalleData.fecha_ot),
          fecha_programada: toDateInputValue(detalleData.fecha_programada),
          titulo: detalleData.titulo || '',
          descripcion_solicitud: detalleData.descripcion_solicitud || '',
          problema_reportado: detalleData.problema_reportado || '',
          numero_om_cliente: detalleData.numero_om_cliente || '',
          hora_inicio: toTimeInputValue(detalleData.hora_inicio),
          hora_termino: toTimeInputValue(detalleData.hora_termino),
          cantidad_tecnicos:
            detalleData.cantidad_tecnicos != null ? String(detalleData.cantidad_tecnicos) : '',
          horas_hombre_utilizadas:
            detalleData.horas_hombre_utilizadas != null ? String(detalleData.horas_hombre_utilizadas) : '',
          supervisor_contratista_nombre: detalleData.supervisor_contratista_nombre || '',
          supervisor_contratista_rut: detalleData.supervisor_contratista_rut || '',
          supervisor_contratista_cargo: detalleData.supervisor_contratista_cargo || '',
          herramientas_materiales_utilizados: detalleData.herramientas_materiales_utilizados || '',
          recomendaciones_seguridad: detalleData.recomendaciones_seguridad || '',
          seguridad_permiso_trabajo: Boolean(detalleData.seguridad_permiso_trabajo),
          seguridad_uso_epp: Boolean(detalleData.seguridad_uso_epp),
          seguridad_bloqueo_tarjeta: Boolean(detalleData.seguridad_bloqueo_tarjeta),
          seguridad_observacion: detalleData.seguridad_observacion || '',
          alcance_trabajo_ejecutado: siNoFromBoolean(detalleData.alcance_trabajo_ejecutado),
          alcance_trabajo_observacion: detalleData.alcance_trabajo_observacion || '',
          ejecutado_segun_programa: siNoFromBoolean(detalleData.ejecutado_segun_programa),
          ejecutado_segun_programa_observacion: detalleData.ejecutado_segun_programa_observacion || '',
          diagnostico: detalleData.diagnostico || '',
          causa_probable: detalleData.causa_probable || '',
          trabajo_realizado: detalleData.trabajo_realizado || '',
          recomendaciones: detalleData.recomendaciones || '',
          tecnico_responsable_id: tecnicoAsignadoValido ? tecnicoResponsableId : '',
          supervisor_id: supervisorAsignadoValido ? supervisorId : '',
          prioridad: detalleData.prioridad,
          requiere_checklist: detalleData.requiere_checklist,
          observaciones_cierre: detalleData.observaciones_cierre || '',
          contacto_cliente_id: detalleData.contacto_cliente_id || '',
          contacto_cliente_email: detalleData.contacto_cliente_email || '',
          contacto_cliente_nombre: detalleData.contacto_cliente_nombre || '',
          contacto_cliente_cargo: detalleData.contacto_cliente_cargo || '',
          area_trabajo: detalleData.area_trabajo || '',
          resultado_servicio: detalleData.resultado_servicio || '',
          hallazgos: detalleData.hallazgos || '',
          conclusiones_tecnicas: detalleData.conclusiones_tecnicas || '',
          mostrar_nota_valor_hora: detalleData.mostrar_nota_valor_hora,
          valor_hora_uf:
            detalleData.valor_hora_uf != null
              ? String(detalleData.valor_hora_uf)
              : '2.10',
        })

       setTiempoForm((prev) => ({
  usuario_id:
    prev.usuario_id || (tecnicoAsignadoValido ? tecnicoResponsableId : '') || (allowedPerfilIds.has(user.id) ? user.id : '') || '',
  fecha: prev.fecha || toDateInputValue(detalleData.fecha_ot) || todayLocalDate(),
  hora_inicio: prev.hora_inicio,
  hora_termino: prev.hora_termino,
  termina_dia_siguiente: prev.termina_dia_siguiente ?? false,
  tipo_tiempo: prev.tipo_tiempo,
  observacion: prev.observacion,
}))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la OT.')
      } finally {
        if (withLoader) setLoading(false)
      }
    },
    [otId]
  )

  useEffect(() => {
    void loadData(true)
  }, [loadData])

  useEffect(() => {
    const tipoSeleccionado = tiposServicio.find(
  (item) => item.id === form.tipo_servicio_id
)

if (tipoSeleccionado?.codigo === 'preventiva') {
  setForm((prev) => ({
    ...prev,
    requiere_checklist: true,
  }))
}

if (tipoSeleccionado?.codigo === 'preventiva_general') {
  setForm((prev) => ({
    ...prev,
    requiere_checklist: false,
  }))
}
  }, [form.tipo_servicio_id, tipoPreventivaId])

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    if (field === 'contacto_cliente_id') {
      const contactoId = String(value || '')
      const contacto = contactosCliente.find((item) => item.id === contactoId)

      setForm((prev) => ({
        ...prev,
        contacto_cliente_id: contactoId,
        contacto_cliente_email: contacto?.email || '',
        contacto_cliente_nombre: contacto?.nombre || '',
        contacto_cliente_cargo: contacto?.cargo || '',
        area_trabajo: contacto?.area || prev.area_trabajo,
      }))

      return
    }

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleTiempoChange = <K extends keyof TiempoFormState>(
    field: K,
    value: TiempoFormState[K]
  ) => {
    setTiempoForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleEquipoAsociadoChange = <K extends keyof EquipoAsociadoFormState>(
    field: K,
    value: EquipoAsociadoFormState[K]
  ) => {
    setEquipoForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = () => {
    if (!form.tipo_servicio_id) return 'Debes seleccionar un tipo de servicio.'
    if (!form.estado_id) return 'Debes seleccionar un estado.'
    if (!form.titulo.trim()) return 'Debes ingresar un tÃ­tulo.'
    if (!form.fecha_ot) return 'Debes indicar la fecha OT.'

    if (isUrgenciaOAsistencia && form.mostrar_nota_valor_hora) {
      const valor = Number(form.valor_hora_uf)
      if (Number.isNaN(valor) || valor <= 0) {
        return 'Debes ingresar un valor hora UF vÃ¡lido.'
      }
    }

    if (form.hora_inicio && form.hora_termino) {
      const duracion = calculateDurationMinutes(form.hora_inicio, form.hora_termino, form.fecha_ot || todayLocalDate())

      if (duracion == null) {
        return 'La fecha y hora de término de la OM debe ser mayor que la fecha y hora de inicio.'
      }
    }

    return ''
  }

  const validateTiempoForm = () => {
    if (!tiempoForm.usuario_id) return 'Debes seleccionar un usuario para el tiempo.'
    if (!tiempoForm.fecha) return 'Debes indicar la fecha del registro.'
    if (!tiempoForm.hora_inicio) return 'Debes indicar la hora de inicio.'
    if (!tiempoForm.hora_termino) return 'Debes indicar la hora de tÃ©rmino.'

    const inicio = new Date(`${tiempoForm.fecha}T${tiempoForm.hora_inicio}`)
    const termino = new Date(`${tiempoForm.fecha}T${tiempoForm.hora_termino}`)

    if (tiempoForm.termina_dia_siguiente) {
      termino.setDate(termino.getDate() + 1)
    }

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(termino.getTime())) {
      return 'Las horas ingresadas no son vÃ¡lidas.'
    }

    if (termino <= inicio) {
      return 'La hora de tÃ©rmino debe ser mayor que la hora de inicio. Si el servicio terminÃ³ al dÃ­a siguiente, marca "Termina al dÃ­a siguiente".'
    }

    return ''
  }

  const buildOtDraftPayload = () => ({
    tipo_servicio_id: form.tipo_servicio_id,
    estado_id: form.estado_id,
    fecha_ot: form.fecha_ot,
    fecha_programada: form.fecha_programada || null,
    titulo: form.titulo.trim(),
    descripcion_solicitud: form.descripcion_solicitud.trim() || null,

    problema_reportado: form.problema_reportado.trim() || null,
    numero_om_cliente: form.numero_om_cliente.trim() || null,
    hora_inicio: dateAndTimeToISOString(form.fecha_ot || todayLocalDate(), form.hora_inicio),
    hora_termino: dateAndTimeToISOString(form.fecha_ot || todayLocalDate(), form.hora_termino),
    duracion_minutos: duracionOmMinutos ?? detalle?.duracion_minutos ?? null,
    cantidad_tecnicos: parsePositiveNumber(form.cantidad_tecnicos),
    horas_hombre_utilizadas:
      parsePositiveNumber(form.horas_hombre_utilizadas) ?? horasHombreSugeridas,
    supervisor_contratista_nombre: form.supervisor_contratista_nombre.trim() || null,
    supervisor_contratista_rut: form.supervisor_contratista_rut.trim() || null,
    supervisor_contratista_cargo: form.supervisor_contratista_cargo.trim() || null,
    herramientas_materiales_utilizados:
      form.herramientas_materiales_utilizados.trim() || null,
    recomendaciones_seguridad: form.recomendaciones_seguridad.trim() || null,
    seguridad_permiso_trabajo: form.seguridad_permiso_trabajo,
    seguridad_uso_epp: form.seguridad_uso_epp,
    seguridad_bloqueo_tarjeta: form.seguridad_bloqueo_tarjeta,
    seguridad_observacion: form.seguridad_observacion.trim() || null,
    seguridad_validada_at:
      form.seguridad_permiso_trabajo || form.seguridad_uso_epp || form.seguridad_bloqueo_tarjeta
        ? new Date().toISOString()
        : detalle?.seguridad_validada_at ?? null,
    seguridad_validada_by:
      form.seguridad_permiso_trabajo || form.seguridad_uso_epp || form.seguridad_bloqueo_tarjeta
        ? (currentUserId || detalle?.seguridad_validada_by || null)
        : detalle?.seguridad_validada_by ?? null,
    alcance_trabajo_ejecutado: booleanFromSiNo(form.alcance_trabajo_ejecutado),
    alcance_trabajo_observacion: form.alcance_trabajo_observacion.trim() || null,
    ejecutado_segun_programa: booleanFromSiNo(form.ejecutado_segun_programa),
    ejecutado_segun_programa_observacion:
      form.ejecutado_segun_programa_observacion.trim() || null,
    diagnostico: form.diagnostico.trim() || null,
    causa_probable: form.causa_probable.trim() || null,
    trabajo_realizado: form.trabajo_realizado.trim() || null,
    recomendaciones: form.recomendaciones.trim() || null,
    tecnico_responsable_id: form.tecnico_responsable_id || null,
    supervisor_id: form.supervisor_id || null,
    prioridad: form.prioridad,
    requiere_checklist: form.requiere_checklist,
    observaciones_cierre: form.observaciones_cierre.trim() || null,
    contacto_cliente_id: form.contacto_cliente_id || null,
    contacto_cliente_email: form.contacto_cliente_email.trim() || selectedContactoCliente?.email || null,
    contacto_cliente_nombre: form.contacto_cliente_nombre.trim() || selectedContactoCliente?.nombre || null,
    contacto_cliente_cargo: form.contacto_cliente_cargo.trim() || selectedContactoCliente?.cargo || null,
    area_trabajo: form.area_trabajo.trim() || null,

    resultado_servicio: form.resultado_servicio.trim() || null,
    hallazgos: form.hallazgos.trim() || null,
    conclusiones_tecnicas: form.conclusiones_tecnicas.trim() || null,
    mostrar_nota_valor_hora: form.mostrar_nota_valor_hora,
    valor_hora_uf: form.mostrar_nota_valor_hora
      ? Number(form.valor_hora_uf)
      : detalle?.valor_hora_uf ?? Number(form.valor_hora_uf || '2.10'),
  })

  const saveOtDraft = async () => {
    const payload = buildOtDraftPayload()

    const { error: updateError } = await supabase
      .from('ot_ordenes_trabajo')
      .update(payload)
      .eq('id', otId)
      .eq('activo', true)
      .is('deleted_at', null)

    if (updateError) {
      throw new Error(`No se pudo guardar el avance de la OT: ${updateError.message}`)
    }

    return payload
  }

  const handleRecepcionSoftysChecklistChange = (
    field: RecepcionSoftysCheckKey,
    value: '' | 'si' | 'no'
  ) => {
    setRecepcionSoftys((prev) => ({
      ...prev,
      checklist_recepcion: {
        ...prev.checklist_recepcion,
        [field]: value,
      },
    }))
  }

  const buildRecepcionSoftysDatos = () => {
    const checklistActual = (informeSoftysDatosBase.checklist_recepcion ?? {}) as Record<string, any>

    return {
      ...informeSoftysDatosBase,
      numero_orden_cliente:
        informeSoftysDatosBase.numero_orden_cliente || form.numero_om_cliente || '',
      responsable_softys:
        informeSoftysDatosBase.responsable_softys || form.contacto_cliente_nombre || '',
      cargo_responsable_softys:
        informeSoftysDatosBase.cargo_responsable_softys || form.contacto_cliente_cargo || '',
      supervisor_contratista:
        informeSoftysDatosBase.supervisor_contratista || form.supervisor_contratista_nombre || '',
      cargo_supervisor_contratista:
        informeSoftysDatosBase.cargo_supervisor_contratista || form.supervisor_contratista_cargo || '',
      herramientas_materiales:
        informeSoftysDatosBase.herramientas_materiales || form.herramientas_materiales_utilizados || '',
      recomendaciones_seguridad:
        informeSoftysDatosBase.recomendaciones_seguridad || form.recomendaciones_seguridad || '',
      observaciones_recepcion: recepcionSoftys.observaciones_recepcion.trim(),
      evaluacion_general: recepcionSoftys.evaluacion_general,
      checklist_recepcion: {
        ...checklistActual,
        alcance_ejecutado: recepcionBooleanFromSiNo(
          recepcionSoftys.checklist_recepcion.alcance_ejecutado
        ),
        area_limpia: recepcionBooleanFromSiNo(recepcionSoftys.checklist_recepcion.area_limpia),
        seguridad_cumplida: recepcionBooleanFromSiNo(
          recepcionSoftys.checklist_recepcion.seguridad_cumplida
        ),
        plazo_cumplido: recepcionBooleanFromSiNo(recepcionSoftys.checklist_recepcion.plazo_cumplido),
        pruebas_realizadas: recepcionBooleanFromSiNo(
          recepcionSoftys.checklist_recepcion.pruebas_realizadas
        ),
      },
    }
  }

  const validateRecepcionSoftys = () => {
    if (!esFlujoDyfSoftys) return ''

    const itemPendiente = RECEPCION_SOFTYS_ITEMS.find(
      (item) => !recepcionSoftys.checklist_recepcion[item.key]
    )

    if (itemPendiente) {
      return 'Debes completar el checklist de recepción antes de finalizar el trabajo.'
    }

    if (!recepcionSoftys.evaluacion_general) {
      return 'Debes seleccionar la evaluación general antes de finalizar el trabajo.'
    }

    return ''
  }

  const saveRecepcionSoftysDraft = async () => {
    if (!detalle || !esFlujoDyfSoftys) return null

    const datos = buildRecepcionSoftysDatos()

    const informePayload: Record<string, any> = {
      empresa_id: detalle.empresa_id,
      ot_id: otId,
      plantilla_codigo: 'softys_om',
      estado: 'borrador',
      datos,
    }

    if (informeSoftysId) {
      informePayload.id = informeSoftysId
    }

    const { data, error: upsertError } = await supabase
      .from('ot_informes_tecnicos')
      .upsert(informePayload, { onConflict: 'ot_id,plantilla_codigo' })
      .select('id, datos')
      .single()

    if (upsertError) {
      throw new Error(`No se pudo guardar el checklist de recepción: ${upsertError.message}`)
    }

    const informeGuardado = data as InformeSoftysMini
    setInformeSoftysId(informeGuardado.id)
    setInformeSoftysDatosBase((informeGuardado.datos ?? {}) as Record<string, any>)
    setRecepcionSoftys(normalizarRecepcionSoftys(informeGuardado.datos))

    return informeGuardado
  }

  const handleSaveRecepcionSoftys = async () => {
    try {
      setSavingRecepcionSoftys(true)
      setRecepcionSoftysError('')
      setRecepcionSoftysSuccess('')

      await saveRecepcionSoftysDraft()

      setRecepcionSoftysSuccess('Recepción del trabajo guardada correctamente.')
      router.refresh()
    } catch (err) {
      setRecepcionSoftysError(
        err instanceof Error ? err.message : 'No se pudo guardar el checklist de recepción Softys.'
      )
    } finally {
      setSavingRecepcionSoftys(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      await saveOtDraft()

      await loadData(false)
      setSuccess('OT actualizada correctamente.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la OT.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTiempo = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateTiempoForm()
    if (validationError) {
      setTiempoError(validationError)
      return
    }

    try {
      setSavingTiempo(true)
      setTiempoError('')
      setTiempoSuccess('')

      const horaInicioIso = combineDateAndTimeToISOString(
        tiempoForm.fecha,
        tiempoForm.hora_inicio
      )
      const horaTerminoIso = combineDateAndTimeToISOString(
        tiempoForm.fecha,
        tiempoForm.hora_termino,
        tiempoForm.termina_dia_siguiente ? 1 : 0
      )

      const inicioMs = horaInicioIso ? new Date(horaInicioIso).getTime() : NaN
      const terminoMs = horaTerminoIso ? new Date(horaTerminoIso).getTime() : NaN
      const duracionMinutos =
        Number.isFinite(inicioMs) && Number.isFinite(terminoMs)
          ? Math.max(0, Math.round((terminoMs - inicioMs) / 60000))
          : null

      const payload = {
        ot_id: otId,
        usuario_id: tiempoForm.usuario_id,
        fecha: tiempoForm.fecha,
        hora_inicio: horaInicioIso,
        hora_termino: horaTerminoIso,
        duracion_minutos: duracionMinutos,
        tipo_tiempo: tiempoForm.tipo_tiempo,
        observacion: tiempoForm.observacion.trim() || null,
      }

      const { error: insertError } = await supabase
        .from('ot_tiempos_trabajo')
        .insert(payload)

      if (insertError) {
        throw new Error(`No se pudo registrar el tiempo: ${insertError.message}`)
      }

      await loadData(false)

      setTiempoForm((prev) => ({
        usuario_id: prev.usuario_id || form.tecnico_responsable_id || currentUserId || '',
        fecha: prev.fecha || todayLocalDate(),
        hora_inicio: '',
        hora_termino: '',
        termina_dia_siguiente: false,
        tipo_tiempo: prev.tipo_tiempo,
        observacion: '',
      }))

      setTiempoSuccess('Tiempo registrado correctamente.')
      router.refresh()
    } catch (err) {
      setTiempoError(
        err instanceof Error ? err.message : 'No se pudo registrar el tiempo.'
      )
    } finally {
      setSavingTiempo(false)
    }
  }

  const handleDeleteTiempo = async (tiempoId: string) => {
    try {
      setTiempoError('')
      setTiempoSuccess('')

      const confirmar = window.confirm('Â¿Deseas archivar este registro de tiempo? No se borrarÃ¡ de la base.')
      if (!confirmar) return

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      const deletedAt = new Date().toISOString()

      const { error } = await supabase
        .from('ot_tiempos_trabajo')
        .update({
          activo: false,
          deleted_at: deletedAt,
          deleted_by: currentUser?.id ?? null,
          updated_by: currentUser?.id ?? null,
          updated_at: deletedAt,
        })
        .eq('id', tiempoId)
        .eq('ot_id', otId)

      if (error) {
        throw new Error(`No se pudo archivar el tiempo: ${error.message}`)
      }

      await loadData(false)
      setTiempoSuccess('Tiempo archivado correctamente.')
      router.refresh()
    } catch (err) {
      setTiempoError(
        err instanceof Error ? err.message : 'No se pudo archivar el tiempo.'
      )
    }
  }


  const handleAddEquipoAsociado = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSavingEquipoAsociado(true)
      setEquipoAsociadoError('')
      setEquipoAsociadoSuccess('')

      if (!detalle) {
        throw new Error('No se ha cargado el detalle de la OM.')
      }

      if (!equipoForm.equipo_id) {
        throw new Error('Debes seleccionar un equipo para asociar a la OM.')
      }

      const equipoSeleccionado = equiposDisponibles.find((item) => item.id === equipoForm.equipo_id)

      if (!equipoSeleccionado) {
        throw new Error('El equipo seleccionado no existe o no está disponible.')
      }

      if (detalle.cliente_id && equipoSeleccionado.cliente_id && equipoSeleccionado.cliente_id !== detalle.cliente_id) {
        throw new Error('El equipo seleccionado pertenece a otro cliente.')
      }

      const yaAsociado = equiposAsociados.some(
        (item) => item.activo && item.equipo_id === equipoForm.equipo_id
      )

      if (yaAsociado) {
        throw new Error('Este equipo ya está asociado a la OM.')
      }

      const payload = {
        empresa_id: detalle.empresa_id,
        ot_id: otId,
        equipo_id: equipoForm.equipo_id,
        descripcion_trabajo: equipoForm.descripcion_trabajo.trim() || null,
        observacion: equipoForm.observacion.trim() || null,
        orden: equiposAsociados.length + 1,
        created_by: currentUserId || null,
        updated_by: currentUserId || null,
      }

      const { error: insertError } = await (supabase as any)
        .from('ot_orden_equipos')
        .insert(payload)

      if (insertError) {
        const message = String(insertError.message || '')
        if (message.includes('ot_orden_equipos_ot_equipo_unique')) {
          throw new Error('Este equipo ya está asociado a la OM.')
        }
        throw new Error(`No se pudo asociar el equipo a la OM: ${insertError.message}`)
      }

      setEquipoForm({ equipo_id: '', descripcion_trabajo: '', observacion: '' })
      await loadData(false)
      setEquipoAsociadoSuccess('Equipo asociado correctamente a la OM.')
      router.refresh()
    } catch (err) {
      setEquipoAsociadoError(
        err instanceof Error ? err.message : 'No se pudo asociar el equipo a la OM.'
      )
    } finally {
      setSavingEquipoAsociado(false)
    }
  }

  const handleRemoveEquipoAsociado = async (item: EquipoAsociado) => {
    try {
      setEquipoAsociadoError('')
      setEquipoAsociadoSuccess('')

      const equipo = equiposDisponiblesMap[item.equipo_id]
      const confirmar = window.confirm(
        `¿Deseas quitar ${equipoDisplayName(equipo)} de esta OM? No se eliminará el equipo maestro.`
      )

      if (!confirmar) return

      const nowIso = new Date().toISOString()

      const { error: updateError } = await (supabase as any)
        .from('ot_orden_equipos')
        .update({
          activo: false,
          deleted_at: nowIso,
          deleted_by: currentUserId || null,
          updated_by: currentUserId || null,
          updated_at: nowIso,
        })
        .eq('id', item.id)
        .eq('ot_id', otId)

      if (updateError) {
        throw new Error(`No se pudo quitar el equipo de la OM: ${updateError.message}`)
      }

      await loadData(false)
      setEquipoAsociadoSuccess('Equipo quitado de la OM correctamente.')
      router.refresh()
    } catch (err) {
      setEquipoAsociadoError(
        err instanceof Error ? err.message : 'No se pudo quitar el equipo de la OM.'
      )
    }
  }


  const handleFinalizarTrabajoTecnico = async () => {
    try {
      setClosingOt(true)
      setCierreError('')
      setCierreSuccess('')
      setError('')
      setSuccess('')

      if (!form.hora_inicio) {
        throw new Error('Debes ingresar la hora oficial de inicio antes de finalizar el trabajo.')
      }

      if (!form.hora_termino) {
        throw new Error('Debes ingresar la hora oficial de termino antes de finalizar el trabajo.')
      }

      const duracion = calculateDurationMinutes(
        form.hora_inicio,
        form.hora_termino,
        form.fecha_ot || todayLocalDate()
      )

      if (duracion == null) {
        throw new Error('La hora oficial de termino debe ser mayor que la hora oficial de inicio.')
      }

      const recepcionError = validateRecepcionSoftys()
      if (recepcionError) {
        throw new Error(recepcionError)
      }

      await saveOtDraft()
      await saveRecepcionSoftysDraft()

      const { error: finalizadoError } = await supabase
        .from('ot_ordenes_trabajo')
        .update({
          finalizado_tecnico_at: new Date().toISOString(),
          finalizado_tecnico_by: currentUserId || null,
          permitir_edicion_tecnico: false,
          updated_by: currentUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', otId)

      if (finalizadoError) {
        throw new Error(`No se pudo marcar el trabajo como finalizado: ${finalizadoError.message}`)
      }

      await loadData(false)
      setCierreSuccess('Trabajo finalizado por el técnico. La OM queda bloqueada para edición técnica y pendiente de revisión/cierre por supervisor.')
      router.refresh()
    } catch (err) {
      setCierreError(err instanceof Error ? err.message : 'No se pudo finalizar el trabajo.')
    } finally {
      setClosingOt(false)
    }
  }


  const handleToggleEdicionTecnica = async (permitir: boolean) => {
    try {
      setAutorizandoEdicionTecnica(true)
      setCierreError('')
      setCierreSuccess('')
      setError('')
      setSuccess('')

      if (!canManageOt) {
        throw new Error('No tienes permisos para autorizar edición técnica.')
      }

      const { error: updateError } = await supabase
        .from('ot_ordenes_trabajo')
        .update({
          permitir_edicion_tecnico: permitir,
          updated_by: currentUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', otId)

      if (updateError) {
        throw new Error(`No se pudo actualizar la autorización técnica: ${updateError.message}`)
      }

      await loadData(false)
      setCierreSuccess(
        permitir
          ? 'Edición técnica autorizada. El técnico podrá corregir la ejecución y finalizar nuevamente.'
          : 'Edición técnica bloqueada. La OT queda pendiente de revisión/cierre por supervisor.'
      )
      router.refresh()
    } catch (err) {
      setCierreError(
        err instanceof Error ? err.message : 'No se pudo actualizar la autorización técnica.'
      )
    } finally {
      setAutorizandoEdicionTecnica(false)
    }
  }

  const enviarInformeEmail = async (showStandaloneMessages = true) => {
    if (!form.contacto_cliente_id) {
      throw new Error('Debes seleccionar un contacto de cliente desde la base de datos antes de enviar el informe.')
    }

    if (!contactoEmailParaEnvio.trim()) {
      throw new Error('El contacto seleccionado no tiene email registrado.')
    }

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      throw new Error('La sesión expiró. Vuelve a iniciar sesión para enviar el informe.')
    }

    if (showStandaloneMessages) {
      setSendingInforme(true)
      setEmailError('')
      setEmailSuccess('')
    }

    try {
      await saveOtDraft()

      const response = await fetch(`/api/ot/${otId}/enviar-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const json = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(json?.error || 'No se pudo enviar el informe OM por email.')
      }

      await loadData(false)

      if (showStandaloneMessages) {
        setEmailSuccess(`Informe enviado a ${json?.contacto || form.contacto_cliente_nombre} <${json?.destinatario || contactoEmailParaEnvio}>.`)
      }

      return true
    } finally {
      if (showStandaloneMessages) {
        setSendingInforme(false)
      }
    }
  }

  const handleEnviarInformeEmail = async () => {
    try {
      await enviarInformeEmail(true)
      router.refresh()
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'No se pudo enviar el informe OM.')
    } finally {
      setSendingInforme(false)
    }
  }

  const handleCerrarOT = async (enviarEmail = false) => {
    try {
      setClosingOt(true)
      setCierreError('')
      setCierreSuccess('')
      setEmailError('')
      setEmailSuccess('')
      setError('')
      setSuccess('')

      const validationError = validateForm()
      if (validationError) {
        throw new Error(validationError)
      }

      if (enviarEmail && !form.contacto_cliente_id) {
        throw new Error('Debes seleccionar un contacto de cliente antes de cerrar y enviar el informe.')
      }

      if (enviarEmail && !contactoEmailParaEnvio.trim()) {
        throw new Error('El contacto seleccionado no tiene email registrado.')
      }

      if (!form.hora_inicio) {
        throw new Error('Debes ingresar la hora inicio OM antes de cerrar.')
      }

      if (!form.hora_termino) {
        throw new Error('Debes ingresar la hora término OM para cerrar o entregar el trabajo.')
      }

      const duracionCierreMinutos = calculateDurationMinutes(
        form.hora_inicio,
        form.hora_termino,
        form.fecha_ot || todayLocalDate()
      )

      if (duracionCierreMinutos == null) {
        throw new Error('La hora término OM debe ser mayor que la hora inicio OM.')
      }

      const payloadBorrador = await saveOtDraft()

      if (!estadoCerrada) {
        throw new Error(
          'El avance quedó guardado, pero no se pudo cerrar: no se encontró el estado "cerrada" en la base.'
        )
      }

      const trabajoPrincipal = form.trabajo_realizado.trim()
      const analisisAsesoria = form.diagnostico.trim()
      const conclusionesAsesoria = form.conclusiones_tecnicas.trim()

      if (isAsesoria) {
        if (!analisisAsesoria && !conclusionesAsesoria) {
          throw new Error(
            'El avance quedó guardado, pero no se pudo cerrar: debes completar al menos el anÃ¡lisis técnico o las conclusiones tÃ©cnicas.'
          )
        }
      } else if (!trabajoPrincipal) {
        throw new Error(
          'El avance quedó guardado, pero no se pudo cerrar: debes completar "Trabajo realizado".'
        )
      }

      if (requiresChecklistForClose) {
        const { data: checklistActual, error: checklistError } = await (supabase as any)
          .from('ot_equipo_checklist_resultados')
          .select('id')
          .eq('ot_id', otId)

        if (checklistError) {
          throw new Error(
            `El avance quedó guardado, pero no se pudo validar el checklist: ${checklistError.message}`
          )
        }

        if ((checklistActual ?? []).length === 0) {
          throw new Error(
            'El avance quedó guardado, pero no se pudo cerrar: esta OT requiere checklist técnico por equipo y aún no tiene respuestas registradas.'
          )
        }
      }

      const nowIso = new Date().toISOString()

      const payload = {
        ...payloadBorrador,
        estado_id: estadoCerrada.id,
        fecha_cierre: nowIso,
        hora_inicio: payloadBorrador.hora_inicio,
        hora_termino: payloadBorrador.hora_termino,
        duracion_minutos: duracionCierreMinutos,
        horas_hombre_utilizadas:
          parsePositiveNumber(form.horas_hombre_utilizadas) ?? horasHombreSugeridas,
      }

      const { error: updateError } = await supabase
        .from('ot_ordenes_trabajo')
        .update(payload)
        .eq('id', otId)
        .eq('activo', true)
        .is('deleted_at', null)

      if (updateError) {
        throw new Error(
          `El avance quedó guardado, pero no se pudo cerrar la OT: ${updateError.message}`
        )
      }

      await loadData(false)

      if (enviarEmail) {
        try {
          await enviarInformeEmail(false)
          setCierreSuccess('OT guardada, cerrada e informe enviado correctamente.')
        } catch (emailErr) {
          setCierreSuccess('OT guardada y cerrada correctamente, pero el informe no pudo enviarse.')
          setEmailError(emailErr instanceof Error ? emailErr.message : 'No se pudo enviar el informe OM.')
        }
      } else {
        setCierreSuccess('OT guardada y cerrada correctamente.')
      }

      router.refresh()
    } catch (err) {
      setCierreError(err instanceof Error ? err.message : 'No se pudo cerrar la OT.')
    } finally {
      setClosingOt(false)
    }
  }

  const handleOpenDeleteModal = () => {
    setDeleteError('')
    setCierreError('')
    setCierreSuccess('')

    if (currentRole !== 'admin') {
      setDeleteError('Solo un administrador puede eliminar la OT.')
      return
    }

    setDeleteMotivo('')
    setShowDeleteModal(true)
  }

  const handleConfirmDeleteOt = async () => {
    try {
      setDeletingOt(true)
      setDeleteError('')
      setCierreError('')
      setCierreSuccess('')

      if (currentRole !== 'admin') {
        throw new Error('Solo un administrador puede eliminar la OT.')
      }

      const motivo = deleteMotivo.trim()

      if (!motivo) {
        throw new Error('Debes indicar un motivo para eliminar la OT.')
      }

      const { error } = await supabase.rpc('eliminar_ot_admin', {
        p_ot_id: otId,
        p_motivo: motivo,
      })

      if (error) {
        throw new Error(`No se pudo eliminar la OT: ${error.message}`)
      }

      setShowDeleteModal(false)
      setDeleteMotivo('')
      router.push('/ot')
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar la OT.')
    } finally {
      setDeletingOt(false)
    }
  }

  const supervisorLabel = detalle?.supervisor_id
    ? getUserLabel(detalle.supervisor_id)
    : '-'

  const createdByLabel = detalle?.created_by
    ? getUserLabel(detalle.created_by)
    : '-'

  const equipoUbicacionLabel = resumen
    ? [
        resumen.equipo_planta,
        resumen.equipo_area,
        resumen.equipo_linea,
        resumen.equipo_ubicacion,
      ]
        .filter(Boolean)
        .join(' / ')
    : ''

  const equipoCaracteristicasLabel = resumen
    ? [
        resumen.equipo_tipo,
        resumen.equipo_marca,
        resumen.equipo_modelo,
        resumen.equipo_potencia,
      ]
        .filter(Boolean)
        .join(' Â· ')
    : ''

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        Cargando detalle de la OT...
      </div>
    )
  }

  if (error && !detalle && !resumen) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>

        <Link
          href="/ot"
          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a OT
        </Link>
      </div>
    )
  }

  if (!detalle || !resumen) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          No se encontró la orden de trabajo.
        </div>

        <Link
          href="/ot"
          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a OT
        </Link>
      </div>
    )
  }

  const adminRoles = new Set([
    'super_admin',
    'admin',
    'admin_empresa',
    'admin_operacional',
    'administrador',
  ])
  const supervisorRoles = new Set([
    'supervisor_ot',
    'jefe_ot',
    'jefe_mantenimiento',
    'responsable_ot',
  ])
  const technicianRoles = new Set([
    'tecnico_ot',
    'tecnico',
    'técnico',
    'tecnico_mantencion',
    'mantenedor',
    'operador_ot',
  ])
  const isAssignedTechnician = Boolean(currentUserId && form.tecnico_responsable_id === currentUserId)
  const isAssignedSupervisor = Boolean(currentUserId && form.supervisor_id === currentUserId)
  const canManageOt = adminRoles.has(currentRole) || supervisorRoles.has(currentRole) || isAssignedSupervisor
  const isTechnicianOnly = !canManageOt && (isAssignedTechnician || technicianRoles.has(currentRole))
  const hasTechnicalExecutionFlow = Boolean(
    usaChecklistPorEquipo || isServicioTecnicoSimple || usaChecklistRmsicMespack
  )
  const vistaTecnicaSolicitada =
    searchParams.get('vista') === 'tecnica' ||
    searchParams.get('vista') === 'tecnico' ||
    searchParams.get('modo') === 'tecnico'
  const mostrarVistaTecnica = hasTechnicalExecutionFlow && (isTechnicianOnly || vistaTecnicaSolicitada)
  const mostrarBloquesTecnicosEnDetalle = !hasTechnicalExecutionFlow
  const trabajoFueFinalizadoPorTecnico = Boolean(detalle.finalizado_tecnico_at)
  const edicionTecnicaAutorizada = Boolean(
    trabajoFueFinalizadoPorTecnico && detalle.permitir_edicion_tecnico && !isClosed
  )
  const trabajoFinalizadoPorTecnico = Boolean(
    trabajoFueFinalizadoPorTecnico && !detalle.permitir_edicion_tecnico
  )
  const tecnicoBloqueado = isClosed || trabajoFinalizadoPorTecnico
  const canManageEquipoTrabajo = Boolean(!tecnicoBloqueado && !isClosed && (canManageOt || isAssignedTechnician))
  const mostrarEquipoTrabajoDyF = Boolean(esFlujoDyfSoftys || usaTecnicosParticipantes || detalle.empresa_id === DYF_EMPRESA_ID)
  const mostrarSeguridadSoftys = Boolean(esFlujoDyfSoftys || detalle.empresa_id === DYF_EMPRESA_ID)

  const renderSeguridadSoftysChecklist = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionTitle
        title="1.0 Requerimientos de seguridad Softys"
        subtitle="Checklist de seguridad aplicable a servicios DyF / Softys antes de ejecutar o cerrar el trabajo."
      />

      <div className="mt-5 space-y-3">
        {SOFTYS_SEGURIDAD_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
          >
            <input
              type="checkbox"
              checked={Boolean(form[item.key])}
              onChange={(e) => handleChange(item.key, e.target.checked)}
              disabled={isClosed}
              className="mt-1 h-4 w-4 rounded border-slate-300 accent-slate-900"
            />

            <span>
              <span className="font-semibold">{item.codigo}</span>{' '}
              {item.label}
              {'helper' in item && item.helper ? (
                <span className="mt-1 block text-xs text-slate-500">
                  {item.helper}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Observación de seguridad
        </label>
        <textarea
          value={form.seguridad_observacion}
          onChange={(e) => handleChange('seguridad_observacion', e.target.value)}
          rows={3}
          disabled={isClosed}
          placeholder="Observaciones adicionales sobre permisos, EPP, bloqueo, tarjeta NO OPERAR u otra condición de seguridad."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
        />
      </div>
    </div>
  )

  if (mostrarVistaTecnica && tecnicoBloqueado) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-700">
                {isClosed ? 'OT cerrada' : 'Trabajo finalizado'}
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {resumen.folio || 'Sin folio'} · {detalle.titulo}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-700">
                {isClosed
                  ? 'La OT ya fue cerrada. La vista del técnico queda bloqueada para evitar cambios posteriores al informe oficial.'
                  : 'El trabajo fue finalizado por el técnico. La OT queda bloqueada para edición técnica y pendiente de revisión/cierre por supervisor.'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Link
                href={`/ot/${otId}/informe-softys?oficial=1`}
                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 sm:w-auto"
              >
                Ver informe oficial
              </Link>
              {usaChecklistPorEquipo ? (
                <Link
                  href={`/ot/${otId}/checklists`}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 sm:w-auto"
                >
                  Checklists individuales
                </Link>
              ) : null}
              <Link
                href="/ot"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto"
              >
                Volver a OT
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Resumen del trabajo"
            subtitle="Información bloqueada para el técnico. Cualquier corrección debe ser autorizada por supervisor o administrador."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Cliente" value={resumen.cliente_nombre} />
            <DetailField label="N° OM / Orden cliente" value={form.numero_om_cliente} />
            <DetailField label="Servicio" value={resumen.tipo_servicio_nombre} />
            <DetailField label="Fecha OT" value={formatDate(detalle.fecha_ot)} />
            <DetailField label="Inicio" value={formatTimeOnly(detalle.hora_inicio)} />
            <DetailField label="Término" value={formatTimeOnly(detalle.hora_termino)} />
            <DetailField label="Técnico asignado" value={getUserLabel(form.tecnico_responsable_id)} />
            <DetailField label="Supervisor" value={supervisorLabel} />
            <DetailField label="Equipos asociados" value={equiposAsociados.length || 0} />
          </div>
        </div>
      </div>
    )
  }

  if (mostrarVistaTecnica) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">
                {resumen.folio || 'Sin folio'}
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {detalle.titulo}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Trabajo técnico asignado. {ejecucionTecnicaIntro}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Link
                href="/ot"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto sm:py-2"
              >
                Volver a OT
              </Link>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        {edicionTecnicaAutorizada ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <span className="font-semibold">Edición autorizada por supervisor.</span>{' '}
            Corrige los datos necesarios y finaliza nuevamente el trabajo para devolverlo a revisión administrativa.
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Resumen del trabajo"
            subtitle="Información principal para ejecutar la OT en terreno."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Cliente" value={resumen.cliente_nombre} />
            <DetailField label="N° OM / Orden cliente" value={form.numero_om_cliente} />
            <DetailField label="Servicio" value={resumen.tipo_servicio_nombre} />
            <DetailField label="Área / sector" value={form.area_trabajo} />
            <DetailField label="Fecha programada" value={formatDate(detalle.fecha_programada)} />
            <DetailField label="Técnico asignado" value={getUserLabel(form.tecnico_responsable_id)} />
            <DetailField label="Supervisor" value={supervisorLabel} />
            <DetailField label="Contacto cliente" value={form.contacto_cliente_nombre} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Seguridad, herramientas y alcance"
            subtitle="Datos de apoyo para realizar el trabajo."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DetailField
              label="Herramientas y materiales"
              value={form.herramientas_materiales_utilizados}
            />
            {!mostrarSeguridadSoftys ? (
              <DetailField
                label="Recomendaciones de seguridad"
                value={form.recomendaciones_seguridad}
              />
            ) : null}
            <DetailField
              label="Solicitud / objetivo"
              value={form.descripcion_solicitud || form.problema_reportado || form.titulo}
            />
            <DetailField label="Equipos asociados" value={equiposAsociados.length || 0} />
          </div>
        </div>

        {mostrarSeguridadSoftys ? renderSeguridadSoftysChecklist() : null}

        <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Inicio del trabajo"
            subtitle="Registra la hora oficial de inicio antes de completar el checklist. Esta es la misma hora que aparecerá en el informe OM."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {`Hora oficial de inicio ${documentoTrabajoLabel} *`}
              </label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={(e) => handleChange('hora_inicio', e.target.value)}
                disabled={isClosed}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Usa esta hora como inicio oficial del trabajo. No se mostrará otra hora de inicio en la vista técnica.
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Completa el checklist técnico por equipo después de registrar el inicio. La hora de término se ingresa al finalizar el trabajo, antes de la firma de recepción.
            </div>
          </div>

          {success ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving || isClosed}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Guardando...' : 'Guardar inicio'}
            </button>
          </div>
        </form>

        {usaChecklistPorEquipo ? (
      <OTEquipoChecklistPanel
          otId={otId}
          empresaId={detalle.empresa_id}
          currentUserId={currentUserId}
          plantillaId={detalle.plantilla_checklist_id}
          requiereChecklist={form.requiere_checklist || usaChecklistPorEquipo || isPreventivaMespack}
          tipoEquipoPermitido={plantillaOtConfig?.tipo_equipo_permitido}
          tipoEquipoLabel={filtroTipoEquipoLabel}
          equipos={equiposAsociados.map((item, index) => {
            const equipo = equiposDisponiblesMap[item.equipo_id]
            return {
              id: item.id,
              equipo_id: item.equipo_id,
              orden: item.orden ?? index + 1,
              descripcion_trabajo: item.descripcion_trabajo,
              observacion: item.observacion,
              tag: equipo?.tag ?? null,
              nombre: equipo?.nombre ?? null,
              descripcion: equipo?.descripcion ?? null,
              tipo_equipo: equipo?.tipo_equipo ?? null,
              planta: equipo?.planta ?? null,
              area: equipo?.area ?? null,
              linea: equipo?.linea ?? null,
              ubicacion: equipo?.ubicacion ?? null,
              marca: equipo?.marca ?? null,
              modelo: equipo?.modelo ?? null,
              potencia: equipo?.potencia ?? null,
              criticidad: equipo?.criticidad ?? null,
            }
          })}
          onChanged={() => void loadData(false)}
        />
      ) : null}

        {usaChecklistRmsicMespack ? (
          <OTChecklistPanel
            otId={otId}
            empresaId={detalle.empresa_id}
            currentUserId={currentUserId}
            initialPlantillaId={detalle.plantilla_checklist_id}
            requiereChecklist={form.requiere_checklist || usaChecklistPorEquipo || isPreventivaMespack}
            onChanged={() => void loadData(false)}
          />
        ) : null}

        {!usaChecklistPorEquipo && isServicioTecnicoSimple ? (
          <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle
              title={
                isUrgencia
                  ? 'Desarrollo de urgencia'
                  : isAsistencia
                    ? 'Desarrollo de asistencia técnica'
                    : isMantenimientoGeneral
                      ? 'Desarrollo de mantenimiento general'
                      : 'Desarrollo técnico del servicio'
              }
              subtitle="Completa el desarrollo técnico del servicio. Esta información se reflejará en el informe."
            />

            {isUrgencia ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Problema reportado</label>
                  <textarea
                    value={form.problema_reportado}
                    onChange={(e) => handleChange('problema_reportado', e.target.value)}
                    rows={4}
                    placeholder="Describe el problema informado o detectado en terreno."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Causa detectada</label>
                  <textarea
                    value={form.causa_probable}
                    onChange={(e) => handleChange('causa_probable', e.target.value)}
                    rows={4}
                    placeholder="Indica la causa probable o confirmada de la falla."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Solución aplicada</label>
                  <textarea
                    value={form.trabajo_realizado}
                    onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                    rows={4}
                    placeholder="Describe la intervención realizada para resolver la urgencia."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Recomendaciones técnicas</label>
                  <textarea
                    value={form.recomendaciones}
                    onChange={(e) => handleChange('recomendaciones', e.target.value)}
                    rows={4}
                    placeholder="Recomendaciones, pendientes o medidas preventivas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            ) : isAsistencia ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Desarrollo de asistencia técnica</label>
                  <textarea
                    value={form.trabajo_realizado}
                    onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                    rows={6}
                    placeholder="Describe el desarrollo realizado durante la asistencia técnica."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Resultado / observación técnica</label>
                  <textarea
                    value={form.resultado_servicio}
                    onChange={(e) => handleChange('resultado_servicio', e.target.value)}
                    rows={6}
                    placeholder="Resultado final, condición de entrega o comentarios relevantes."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Trabajo realizado</label>
                  <textarea
                    value={form.trabajo_realizado}
                    onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                    rows={4}
                    placeholder="Describe las actividades realizadas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Hallazgos detectados</label>
                  <textarea
                    value={form.hallazgos}
                    onChange={(e) => handleChange('hallazgos', e.target.value)}
                    rows={4}
                    placeholder="Registra hallazgos, anomalías o condiciones encontradas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Resultado del servicio</label>
                  <textarea
                    value={form.resultado_servicio}
                    onChange={(e) => handleChange('resultado_servicio', e.target.value)}
                    rows={4}
                    placeholder="Indica el resultado final del mantenimiento general."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Recomendaciones técnicas</label>
                  <textarea
                    value={form.recomendaciones}
                    onChange={(e) => handleChange('recomendaciones', e.target.value)}
                    rows={4}
                    placeholder="Recomendaciones, pendientes o acciones sugeridas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving || isClosed}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Guardando...' : 'Guardar desarrollo técnico'}
              </button>
            </div>
          </form>
        ) : null}

        {mostrarEquipoTrabajoDyF ? (
          <OTEquipoTrabajoDyFPanel
            otId={otId}
            empresaId={detalle.empresa_id}
            canManage={canManageEquipoTrabajo}
            onChanged={() => void loadData(false)}
          />
        ) : null}

        {esFlujoDyfSoftys ? (
          <section id="recepcion-softys" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Checklist de recepción del trabajo"
              subtitle="Completa esta validación solo al finalizar el trabajo. Estos datos se reflejan en el informe OM oficial."
            />

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-14 px-3 py-3 text-left font-semibold">Ítem</th>
                    <th className="px-3 py-3 text-left font-semibold">Descripción</th>
                    <th className="w-24 px-3 py-3 text-center font-semibold">Sí</th>
                    <th className="w-24 px-3 py-3 text-center font-semibold">No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {RECEPCION_SOFTYS_ITEMS.map((item, index) => (
                    <tr key={item.key}>
                      <td className="px-3 py-3 font-medium text-slate-700">{index + 1}</td>
                      <td className="px-3 py-3 text-slate-700">{item.label}</td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name={`recepcion-${item.key}`}
                          checked={recepcionSoftys.checklist_recepcion[item.key] === 'si'}
                          onChange={() => handleRecepcionSoftysChecklistChange(item.key, 'si')}
                          className="h-4 w-4 accent-slate-900"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name={`recepcion-${item.key}`}
                          checked={recepcionSoftys.checklist_recepcion[item.key] === 'no'}
                          onChange={() => handleRecepcionSoftysChecklistChange(item.key, 'no')}
                          className="h-4 w-4 accent-slate-900"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Evaluación general
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {RECEPCION_SOFTYS_EVALUACIONES.filter(Boolean).map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="radio"
                        name="evaluacion-general-softys"
                        checked={recepcionSoftys.evaluacion_general === item}
                        onChange={() =>
                          setRecepcionSoftys((prev) => ({
                            ...prev,
                            evaluacion_general: item,
                          }))
                        }
                        className="h-4 w-4 accent-slate-900"
                      />
                      {item}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Observaciones de recepción
                </label>
                <textarea
                  value={recepcionSoftys.observaciones_recepcion}
                  onChange={(e) =>
                    setRecepcionSoftys((prev) => ({
                      ...prev,
                      observaciones_recepcion: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Opcional: comentarios finales antes de firma/recepción."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            {recepcionSoftysError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {recepcionSoftysError}
              </div>
            ) : null}

            {recepcionSoftysSuccess ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {recepcionSoftysSuccess}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void handleSaveRecepcionSoftys()}
                disabled={savingRecepcionSoftys || isClosed}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingRecepcionSoftys ? 'Guardando...' : 'Guardar recepción'}
              </button>
              <p className="text-xs text-slate-500">
                Al finalizar el trabajo, esta sección debe estar completa para que el informe muestre los checks de recepción.
              </p>
            </div>
          </section>
        ) : null}

        <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Término del trabajo"
            subtitle="Registra la hora oficial de término y una observación final antes de solicitar la firma de recepción."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {`Hora oficial de término ${documentoTrabajoLabel} *`}
              </label>
              <input
                type="time"
                value={form.hora_termino}
                onChange={(e) => handleChange('hora_termino', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Esta hora aparecerá en el informe OM.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Observación final del técnico
              </label>
              <textarea
                value={form.observaciones_cierre}
                onChange={(e) => handleChange('observaciones_cierre', e.target.value)}
                rows={3}
                placeholder="Opcional: pendientes, condición final o comentarios de entrega."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {cierreError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {cierreError}
            </div>
          ) : null}

          {cierreSuccess ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {cierreSuccess}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving || closingOt}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Guardando...' : 'Guardar termino'}
            </button>
            <button
              type="button"
              onClick={() => void handleFinalizarTrabajoTecnico()}
              disabled={saving || closingOt || isClosed}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {closingOt ? 'Finalizando...' : 'Finalizar trabajo'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Finalizar trabajo no envia el informe al cliente. Deja la OM lista para revision y cierre por supervisor.
          </p>
        </form>

        <OTEvidenciasPanel
          otId={otId}
          empresaId={detalle.empresa_id}
          currentUserId={currentUserId}
        />

        <OTFirmasPanel
          otId={otId}
          empresaId={detalle.empresa_id}
          currentUserId={currentUserId}
        />
      </div>
    )
  }


  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">
              {resumen.folio || 'Sin folio'}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {detalle.titulo}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Cliente:{' '}
              <span className="font-medium text-slate-700">
                {labelOrDash(resumen.cliente_nombre)}
              </span>
            </p>
            {resumen.equipo_tag ? (
              <p className="mt-1 text-sm text-slate-500">
                Equipo / TAG:{' '}
                <span className="font-medium text-slate-700">
                  {resumen.equipo_tag}
                  {resumen.equipo_nombre ? ` Â· ${resumen.equipo_nombre}` : ''}
                </span>
              </p>
            ) : null}
            {esFlujoDyfSoftys ? (
              <p className="mt-3 max-w-2xl text-xs text-slate-500 sm:text-sm">
                {usaChecklistPorEquipo
                  ? 'Servicio con trazabilidad por equipos, checklist técnico y técnicos participantes.'
                  : 'Servicio general sin checklist por equipo. El técnico registra el desarrollo y el informe técnico consolida la ejecución.'}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
            {esFlujoDyfSoftys ? (
              <>
                <Link
                  href={`/ot/${otId}/informe-softys`}
                  style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#163A5F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#245C90] sm:w-auto sm:py-2"
                >
                  {informePrincipalLabel}
                </Link>
                {usaChecklistPorEquipo ? (
                  <Link
                    href={`/ot/${otId}/checklists`}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-[#163A5F] bg-white px-4 py-3 text-sm font-semibold text-[#163A5F] hover:bg-blue-50 sm:w-auto sm:py-2"
                  >
                    Checklists individuales
                  </Link>
                ) : null}
                <Link
                  href={`/ot/${otId}?vista=tecnica`}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 sm:w-auto sm:py-2"
                >
                  Abrir ejecución técnica
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/ot/${otId}/firma`}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 sm:w-auto sm:py-2"
                >
                  Abrir vista cliente / firma
                </Link>
                <Link
                  href={`/ot/${otId}/pdf`}
                  style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#163A5F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#245C90] sm:w-auto sm:py-2"
                >
                  PDF OT
                </Link>
              </>
            )}

            <Link
              href="/ot"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto sm:py-2"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      {canManageOt && trabajoFueFinalizadoPorTecnico && !isClosed ? (
        <div className={`rounded-2xl border p-5 shadow-sm ${edicionTecnicaAutorizada ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${edicionTecnicaAutorizada ? 'text-amber-800' : 'text-emerald-800'}`}>
                {edicionTecnicaAutorizada ? 'Corrección técnica autorizada' : 'Trabajo finalizado por técnico'}
              </p>
              <p className={`mt-1 text-sm ${edicionTecnicaAutorizada ? 'text-amber-700' : 'text-emerald-700'}`}>
                {edicionTecnicaAutorizada
                  ? 'El técnico puede modificar la ejecución y debe finalizar nuevamente para devolver la OM a revisión.'
                  : 'La OM está lista para revisión administrativa, cierre, firma e informe. La edición técnica está bloqueada para evitar cambios posteriores.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              {edicionTecnicaAutorizada ? (
                <button
                  type="button"
                  onClick={() => void handleToggleEdicionTecnica(false)}
                  disabled={autorizandoEdicionTecnica}
                  className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {autorizandoEdicionTecnica ? 'Actualizando...' : 'Bloquear edición técnica'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleToggleEdicionTecnica(true)}
                  disabled={autorizandoEdicionTecnica}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {autorizandoEdicionTecnica ? 'Autorizando...' : 'Autorizar corrección técnica'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Estado actual</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(resumen.estado_nombre)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Tipo de servicio</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(resumen.tipo_servicio_nombre)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Equipo / TAG</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(resumen.equipo_tag)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Prioridad</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(form.prioridad)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">DuraciÃ³n OT (cierre)</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatDuration(detalle.duracion_minutos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Tiempo registrado</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatDuration(totalTiempoRegistrado)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Resumen general"
          subtitle="Informacion principal de la orden de trabajo."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Empresa" value={resumen.empresa_nombre} />
          <DetailField label="Cliente" value={resumen.cliente_nombre} />
          <DetailField label="Folio Tralixia" value={detalle.folio} />
          <DetailField label="N° OM / N° Orden cliente" value={form.numero_om_cliente} />
          <DetailField label="Hora inicio OM" value={formatTimeOnly(detalle.hora_inicio)} />
          <DetailField label="Cierre oficial de OM" value={formatTimeOnly(detalle.hora_termino)} />
          <DetailField label="Horas hombre utilizadas" value={detalle.horas_hombre_utilizadas} />
          <DetailField label="Contacto cliente" value={form.contacto_cliente_nombre} />
          <DetailField label="Cargo contacto" value={form.contacto_cliente_cargo} />
          <DetailField label="Email contacto" value={form.contacto_cliente_email} />
          <DetailField label="Area / sector trabajo" value={form.area_trabajo} />
          <DetailField label="Ubicacion base" value={resumen.ubicacion_nombre} />
          <DetailField label="Activo base" value={resumen.activo_nombre} />
          <DetailField label="Equipo / TAG" value={resumen.equipo_tag} />
          <DetailField label="Equipo nombre" value={resumen.equipo_nombre} />
          <DetailField label="Equipo descripcion" value={resumen.equipo_descripcion} />
          <DetailField label="Equipo ubicacion" value={equipoUbicacionLabel || null} />
          <DetailField label="Equipo caracteristicas" value={equipoCaracteristicasLabel || null} />
          <DetailField
            label="Tecnico actual"
            value={humanizePerson(resumen.tecnico_nombre)}
          />
          <DetailField label="Supervisor actual" value={supervisorLabel} />
          <DetailField label="Fecha cierre" value={formatDateTime(detalle.fecha_cierre)} />
          <DetailField label="Creado por" value={createdByLabel} />
        </div>
      </div>


      {usaEquiposMultiples ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Equipos asociados a la OT/OM"
          subtitle={canManageOt ? 'Asocia aquí todos los equipos definidos para este trabajo.' : 'Equipos definidos por el administrador o supervisor para esta OT.'}
        />

        {equipoAsociadoError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {equipoAsociadoError}
          </div>
        ) : null}

        {equipoAsociadoSuccess ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {equipoAsociadoSuccess}
          </div>
        ) : null}

        {canManageOt ? (
          <form onSubmit={handleAddEquipoAsociado} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Equipo
                </label>
                <select
                  value={equipoForm.equipo_id}
                  onChange={(e) => handleEquipoAsociadoChange('equipo_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">Seleccionar equipo...</option>
                  {equiposDisponiblesParaAgregar.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipoDisplayName(equipo)}{equipo.tipo_equipo ? ` / ${equipo.tipo_equipo}` : ''}
                    </option>
                  ))}
                </select>
                {filtroTipoEquipoLabel ? (
                  <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Filtro aplicado por plantilla: se muestran solo {filtroTipoEquipoLabel}.
                  </p>
                ) : null}
                {equiposDisponiblesParaAgregar.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    No hay equipos disponibles para agregar. Revisa el maestro de equipos o si todos ya fueron asociados.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Trabajo solicitado para este equipo
                </label>
                <input
                  value={equipoForm.descripcion_trabajo}
                  onChange={(e) => handleEquipoAsociadoChange('descripcion_trabajo', e.target.value)}
                  placeholder={`Ej: Mantención ${tipoEquipoSingular} línea 2`}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Observación interna
                </label>
                <input
                  value={equipoForm.observacion}
                  onChange={(e) => handleEquipoAsociadoChange('observacion', e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Esta asociación la define el administrador o supervisor antes de asignar el trabajo al técnico.
              </p>
              <button
                type="submit"
                disabled={savingEquipoAsociado || !equipoForm.equipo_id}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {savingEquipoAsociado ? 'Asociando...' : 'Agregar equipo a OM'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 space-y-3">
          {equiposAsociados.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Esta OT aún no tiene equipos asociados en esta estructura. Si corresponde, agrega aquí los equipos definidos para el trabajo.
            </div>
          ) : (
            equiposAsociados.map((item, index) => {
              const equipo = equiposDisponiblesMap[item.equipo_id]
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                          Equipo {index + 1}
                        </span>
                        {equipo?.criticidad ? (
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${prioridadEquipoClass(equipo.criticidad)}`}>
                            Criticidad {equipo.criticidad}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-slate-900">
                        {equipoDisplayName(equipo)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {equipoCaracteristicasDisplay(equipo)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Ubicación: {equipoUbicacionDisplay(equipo)}
                      </p>
                      {item.descripcion_trabajo ? (
                        <p className="mt-3 text-sm text-slate-700">
                          <span className="font-medium">Trabajo solicitado:</span> {item.descripcion_trabajo}
                        </p>
                      ) : null}
                      {item.observacion ? (
                        <p className="mt-1 text-sm text-slate-700">
                          <span className="font-medium">Observación:</span> {item.observacion}
                        </p>
                      ) : null}
                    </div>

                    {canManageOt ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveEquipoAsociado(item)}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 lg:w-auto"
                      >
                        Quitar de la OM
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      ) : null}

      {!esFlujoDyfSoftys ? (
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Datos base"
            subtitle="Campos comunes a cualquier tipo de servicio."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tipo de servicio *
              </label>
              <select
                value={form.tipo_servicio_id}
                onChange={(e) => handleChange('tipo_servicio_id', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">Selecciona un tipo</option>
                {tiposServicio.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Estado *
              </label>
              <select
                value={form.estado_id}
                onChange={(e) => handleChange('estado_id', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">Selecciona un estado</option>
                {estados.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha OT *
              </label>
              <input
                type="date"
                value={form.fecha_ot}
                onChange={(e) => handleChange('fecha_ot', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha programada
              </label>
              <input
                type="date"
                value={form.fecha_programada}
                onChange={(e) => handleChange('fecha_programada', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                TÃ­tulo *
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Prioridad
              </label>
              <select
                value={form.prioridad}
                onChange={(e) =>
                  handleChange('prioridad', e.target.value as FormState['prioridad'])
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Cri­tica</option>
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Contacto cliente / Softys
              </label>
              <select
                value={form.contacto_cliente_id}
                onChange={(e) => handleChange('contacto_cliente_id', e.target.value)}
                disabled={isClosed}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
              >
                <option value="">
                  {contactosCliente.length === 0
                    ? 'Cliente sin contactos registrados'
                    : 'Selecciona contacto'}
                </option>
                {contactosCliente.map((contacto) => (
                  <option key={contacto.id} value={contacto.id}>
                    {contacto.nombre}{contacto.cargo ? ` - ${contacto.cargo}` : ''}{contacto.email ? ` - ${contacto.email}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {contactoEmailParaEnvio
                  ? `Informe OM dirigido a: ${contactoEmailParaEnvio}`
                  : 'Registra contactos desde Clientes para habilitar envío de informe.'}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Cargo contacto
              </label>
              <input
                type="text"
                value={form.contacto_cliente_cargo}
                onChange={(e) => handleChange('contacto_cliente_cargo', e.target.value)}
                disabled={isClosed}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Área / sector de trabajo
              </label>
              <input
                type="text"
                value={form.area_trabajo}
                onChange={(e) => handleChange('area_trabajo', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-semibold text-slate-900">Asignacion</h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tecnico responsable
                </label>
                <select
                  value={form.tecnico_responsable_id}
                  onChange={(e) => handleChange('tecnico_responsable_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">Sin asignar</option>
                  {perfiles.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {perfil.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Supervisor
                </label>
                <select
                  value={form.supervisor_id}
                  onChange={(e) => handleChange('supervisor_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">Sin asignar</option>
                  {perfilesSupervisores.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {perfil.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.requiere_checklist}
                onChange={(e) => handleChange('requiere_checklist', e.target.checked)}
                disabled={isPreventivaMespack}
              />
              Requiere checklist
            </label>
          </div>

          {isPreventiva && !esFlujoDyfSoftys ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              En mantenimiento preventivo el checklist queda marcado automaticamente.
            </div>
          ) : null}
        </div>

        {esFlujoDyfSoftys ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Formato OM Softys"
            subtitle="Campos de la portada principal del informe OM. Se registran una sola vez por orden principal."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                N° OM / N° Orden cliente
              </label>
              <input
                type="text"
                value={form.numero_om_cliente}
                onChange={(e) => handleChange('numero_om_cliente', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Hora inicio OM
              </label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={(e) => handleChange('hora_inicio', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>


            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Supervisor contratista
              </label>
              <input
                type="text"
                value={form.supervisor_contratista_nombre}
                onChange={(e) => handleChange('supervisor_contratista_nombre', e.target.value)}
                placeholder="Nombre supervisor DyF / contratista"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                RUT supervisor contratista
              </label>
              <input
                type="text"
                value={form.supervisor_contratista_rut}
                onChange={(e) => handleChange('supervisor_contratista_rut', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Cargo supervisor contratista
              </label>
              <input
                type="text"
                value={form.supervisor_contratista_cargo}
                onChange={(e) => handleChange('supervisor_contratista_cargo', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Herramientas y materiales utilizados
              </label>
              <textarea
                value={form.herramientas_materiales_utilizados}
                onChange={(e) => handleChange('herramientas_materiales_utilizados', e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            {!mostrarSeguridadSoftys ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones de seguridad para la ejecución del trabajo
                </label>
                <textarea
                  value={form.recomendaciones_seguridad}
                  onChange={(e) => handleChange('recomendaciones_seguridad', e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            ) : null}
          </div>

          {mostrarSeguridadSoftys ? (
            <div className="mt-5">
              {renderSeguridadSoftysChecklist()}
            </div>
          ) : null}

        </div>
        ) : null}

        {esFlujoDyfSoftys ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Planificación / instrucciones para terreno"
              subtitle="Campos administrativos para orientar al técnico. El desarrollo técnico y el checklist se completan en la vista de ejecución."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Trabajo solicitado / alcance inicial
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  placeholder="Ejemplo: Ejecutar pauta de mantenimiento preventivo según plantilla seleccionada."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Observación administrativa para el técnico
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={3}
                  placeholder="Opcional: restricciones de acceso, coordinación con Softys, permisos, ventanas horarias o información de terreno."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                El checklist técnico, fotos, condición encontrada, acciones y término del trabajo quedan reservados para la vista de ejecución técnica.
              </div>
            </div>
          </div>
        ) : null}

        {isPreventiva && !esFlujoDyfSoftys ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido OT: mantenimiento preventivo"
              subtitle="Estructura enfocada en control, ejecucion, hallazgos y recomendaciones."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Objetivo del mantenimiento
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Actividades ejecutadas
                </label>
                <textarea
                  value={form.trabajo_realizado}
                  onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Hallazgos detectados
                </label>
                <textarea
                  value={form.hallazgos}
                  onChange={(e) => handleChange('hallazgos', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Resultado del servicio
                </label>
                <textarea
                  value={form.resultado_servicio}
                  onChange={(e) => handleChange('resultado_servicio', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones preventivas
                </label>
                <textarea
                  value={form.recomendaciones}
                  onChange={(e) => handleChange('recomendaciones', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>
        ) : null}

        {isUrgenciaOAsistencia && !esFlujoDyfSoftys ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido OT: urgencia / asistencia tecnica"
              subtitle="Estructura correctiva y operativa para atencion inmediata o soporte tecnico."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Solicitud del cliente
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Problema reportado
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Diagnostico
                </label>
                <textarea
                  value={form.diagnostico}
                  onChange={(e) => handleChange('diagnostico', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Causa probable
                </label>
                <textarea
                  value={form.causa_probable}
                  onChange={(e) => handleChange('causa_probable', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Labores realizadas
                </label>
                <textarea
                  value={form.trabajo_realizado}
                  onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Resultado del servicio
                </label>
                <textarea
                  value={form.resultado_servicio}
                  onChange={(e) => handleChange('resultado_servicio', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones
                </label>
                <textarea
                  value={form.recomendaciones}
                  onChange={(e) => handleChange('recomendaciones', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.mostrar_nota_valor_hora}
                  onChange={(e) => handleChange('mostrar_nota_valor_hora', e.target.checked)}
                />
                Mostrar nota informativa de valor por hora
              </label>

              {form.mostrar_nota_valor_hora ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Valor hora UF
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.valor_hora_uf}
                      onChange={(e) => handleChange('valor_hora_uf', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Esta nota quedara disponible para el PDF cliente solo cuando la actives.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isAsesoria && !esFlujoDyfSoftys ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido OT: consultora / asesoria tecnica"
              subtitle="Estructura enfocada en analisis, conclusiones y recomendaciones."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Objetivo de la asesoria
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Antecedentes observados
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Analisis tecnico
                </label>
                <textarea
                  value={form.diagnostico}
                  onChange={(e) => handleChange('diagnostico', e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Conclusiones tecnicas
                </label>
                <textarea
                  value={form.conclusiones_tecnicas}
                  onChange={(e) => handleChange('conclusiones_tecnicas', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones
                </label>
                <textarea
                  value={form.recomendaciones}
                  onChange={(e) => handleChange('recomendaciones', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>
        ) : null}

        {!esFlujoDyfSoftys && !isPreventiva && !isUrgenciaOAsistencia && !isAsesoria ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido general"
              subtitle="Modo de respaldo para tipos no clasificados todavia."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  DescripciÃ³n de la solicitud
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Problema reportado
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Diagnostico
                </label>
                <textarea
                  value={form.diagnostico}
                  onChange={(e) => handleChange('diagnostico', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Trabajo realizado
                </label>
                <textarea
                  value={form.trabajo_realizado}
                  onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones
                </label>
                <textarea
                  value={form.recomendaciones}
                  onChange={(e) => handleChange('recomendaciones', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Observaciones de cierre"
            subtitle="Campo complementario para dejar observaciones finales."
          />

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observaciones de cierre
            </label>
            <textarea
              value={form.observaciones_cierre}
              onChange={(e) => handleChange('observaciones_cierre', e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {warning}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Guardando cambios...' : 'Guardar cambios'}
          </button>

          <Link
            href="/ot"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver a OT
          </Link>
        </div>
      </form>
      ) : null}

      {mostrarEquipoTrabajoDyF ? (
        <OTEquipoTrabajoDyFPanel
          otId={otId}
          empresaId={detalle.empresa_id}
          canManage={canManageEquipoTrabajo}
          onChanged={() => void loadData(false)}
        />
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Bitácora opcional de tiempos"
          subtitle="Registra bloques de trabajo, traslado, espera o supervisión como respaldo operativo. No reemplaza la hora oficial de cierre de la OM."
        />

        <form onSubmit={handleAddTiempo} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Usuario *
              </label>
              <select
                value={tiempoForm.usuario_id}
                onChange={(e) => handleTiempoChange('usuario_id', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">
                  {perfilesBitacora.length === 0
                    ? 'No hay usuarios asociados a esta OT'
                    : 'Selecciona un usuario'}
                </option>
                {perfilesBitacora.map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.label}
                  </option>
                ))}
              </select>
              {esFlujoDyfSoftys && perfilesBitacora.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Primero asigna un técnico responsable o supervisor a la OT para registrar tiempos.
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha *
              </label>
              <input
                type="date"
                value={tiempoForm.fecha}
                onChange={(e) => handleTiempoChange('fecha', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tipo de tiempo
              </label>
              <select
                value={tiempoForm.tipo_tiempo}
                onChange={(e) =>
                  handleTiempoChange(
                    'tipo_tiempo',
                    e.target.value as TiempoFormState['tipo_tiempo']
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="trabajo">Trabajo</option>
                <option value="traslado">Traslado</option>
                <option value="espera">Espera</option>
                <option value="supervision">Supervision</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Inicio bloque *
              </label>
              <input
                type="time"
                value={tiempoForm.hora_inicio}
                onChange={(e) => handleTiempoChange('hora_inicio', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fin bloque *
              </label>
              <input
                type="time"
                value={tiempoForm.hora_termino}
                onChange={(e) => handleTiempoChange('hora_termino', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={tiempoForm.termina_dia_siguiente}
                  onChange={(e) =>
                    handleTiempoChange('termina_dia_siguiente', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium text-slate-900">
                    Termina al dia siguiente
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Usa esta opcion cuando el servicio inicia en la noche y termina en la madrugada, por ejemplo 21:15 a 03:00.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observacion
            </label>
            <textarea
              value={tiempoForm.observacion}
              onChange={(e) => handleTiempoChange('observacion', e.target.value)}
              rows={3}
              placeholder="Ejemplo: intervencion en tablero principal, visita en terreno, traslado a planta, etc."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>

          {tiempoError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {tiempoError}
            </div>
          ) : null}

          {tiempoSuccess ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {tiempoSuccess}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={savingTiempo || perfilesBitacora.length === 0}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingTiempo ? 'Registrando tiempo...' : 'Agregar tiempo'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Bitácora de tiempos registrada"
          subtitle={`Historial opcional de bloques de tiempo asociados a esta OT. La hora oficial de cierre se ingresa solo en Cierre / entrega de ${documentoTrabajoLabel}.`}
        />

        {tiempos.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Aun no hay tiempos registrados para esta OT.
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Inicio bloque</th>
                    <th className="px-4 py-3 font-semibold">Fin bloque</th>
                    <th className="px-4 py-3 font-semibold">Duracion</th>
                    <th className="px-4 py-3 font-semibold">Observacion</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiempos.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-4 py-3">{formatDate(item.fecha)}</td>
                      <td className="px-4 py-3">{getUserLabel(item.usuario_id)}</td>
                      <td className="px-4 py-3">
                        {item.tipo_tiempo.charAt(0).toUpperCase() + item.tipo_tiempo.slice(1)}
                      </td>
                      <td className="px-4 py-3">{formatDateTime(item.hora_inicio)}</td>
                      <td className="px-4 py-3">{formatDateTime(item.hora_termino)}</td>
                      <td className="px-4 py-3">{formatDuration(item.duracion_minutos)}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-[360px] whitespace-pre-wrap">
                          {labelOrDash(item.observacion)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDeleteTiempo(item.id)}
                          className="inline-flex rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Archivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {mostrarBloquesTecnicosEnDetalle && usaChecklistPorEquipo ? (
      <OTEquipoChecklistPanel
        otId={otId}
        empresaId={detalle.empresa_id}
        currentUserId={currentUserId}
        plantillaId={detalle.plantilla_checklist_id}
        requiereChecklist={form.requiere_checklist || usaChecklistPorEquipo || isPreventivaMespack}
        tipoEquipoPermitido={plantillaOtConfig?.tipo_equipo_permitido}
        tipoEquipoLabel={filtroTipoEquipoLabel}
        equipos={equiposAsociados.map((item, index) => {
          const equipo = equiposDisponiblesMap[item.equipo_id]
          return {
            id: item.id,
            equipo_id: item.equipo_id,
            orden: item.orden ?? index + 1,
            descripcion_trabajo: item.descripcion_trabajo,
            observacion: item.observacion,
            tag: equipo?.tag ?? null,
            nombre: equipo?.nombre ?? null,
            descripcion: equipo?.descripcion ?? null,
            tipo_equipo: equipo?.tipo_equipo ?? null,
            planta: equipo?.planta ?? null,
            area: equipo?.area ?? null,
            linea: equipo?.linea ?? null,
            ubicacion: equipo?.ubicacion ?? null,
            marca: equipo?.marca ?? null,
            modelo: equipo?.modelo ?? null,
            potencia: equipo?.potencia ?? null,
            criticidad: equipo?.criticidad ?? null,
          }
        })}
        onChanged={() => void loadData(false)}
      />
      ) : null}

      {mostrarBloquesTecnicosEnDetalle && usaChecklistRmsicMespack ? (
        <OTChecklistPanel
          otId={otId}
          empresaId={detalle.empresa_id}
          currentUserId={currentUserId}
          initialPlantillaId={detalle.plantilla_checklist_id}
          requiereChecklist={form.requiere_checklist || usaChecklistPorEquipo || isPreventivaMespack}
          onChanged={() => void loadData(false)}
        />
      ) : null}

      {mostrarBloquesTecnicosEnDetalle ? (
        <>
          <OTEvidenciasPanel
            otId={otId}
            empresaId={detalle.empresa_id}
            currentUserId={currentUserId}
          />

          <OTFirmasPanel
            otId={otId}
            empresaId={detalle.empresa_id}
            currentUserId={currentUserId}
          />
        </>
      ) : null}

      {!mostrarBloquesTecnicosEnDetalle ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <SectionTitle
            title="OM lista para ejecución técnica"
            subtitle="La vista administrativa queda limpia. El checklist, fotos, acciones y término del trabajo se completan en la vista técnica."
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/ot/${otId}?vista=tecnica`}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Abrir ejecución técnica
            </Link>
            <Link
              href={`/ot/${otId}/informe-softys`}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Ver informe OM
            </Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title={`Cierre / entrega de ${documentoTrabajoLabel}`}
          subtitle={`Completa estos datos al entregar el trabajo. La hora término, duración y horas hombre se registran al cierre, no al crear la ${documentoTrabajoLabel}.`}
        />

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Acciones de cierre</p>
              <p className="mt-1 text-xs text-slate-600">
                Primero completa los datos de entrega. Luego puedes cerrar sin enviar o cerrar y enviar el informe al contacto seleccionado.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleCerrarOT(false)}
                disabled={closingOt || isClosed}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isClosed
                  ? 'OT ya cerrada'
                  : closingOt
                    ? 'Guardando y cerrando OT...'
                    : 'Cerrar sin enviar'}
              </button>

              {!isClosed ? (
                <button
                  type="button"
                  onClick={() => void handleCerrarOT(true)}
                  disabled={closingOt || sendingInforme || !form.contacto_cliente_id || !contactoEmailParaEnvio}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {closingOt || sendingInforme
                    ? 'Cerrando y enviando...'
                    : 'Cerrar y enviar informe'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleEnviarInformeEmail()}
                  disabled={sendingInforme || !form.contacto_cliente_id || !contactoEmailParaEnvio}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {sendingInforme ? 'Enviando informe...' : 'Enviar / reenviar informe'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {`Hora oficial de término ${documentoTrabajoLabel} *`}
            </label>
            <input
              type="time"
              value={form.hora_termino}
              onChange={(e) => handleChange('hora_termino', e.target.value)}
              disabled={isClosed}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Esta es la hora oficial de cierre para el informe.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cantidad de técnicos
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.cantidad_tecnicos}
              onChange={(e) => handleChange('cantidad_tecnicos', e.target.value)}
              disabled={isClosed}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Horas hombre utilizadas
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={form.horas_hombre_utilizadas}
              onChange={(e) => handleChange('horas_hombre_utilizadas', e.target.value)}
              disabled={isClosed}
              placeholder={horasHombreSugeridas != null ? String(horasHombreSugeridas) : ''}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              {duracionOmMinutos != null
                ? `Duración calculada: ${Math.round(duracionOmMinutos / 60 * 100) / 100} h${horasHombreSugeridas != null ? ` · HH sugeridas: ${horasHombreSugeridas}` : ''}`
                : 'Se calcula si ingresas hora inicio, hora término y cantidad de técnicos.'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ¿Se ejecutó todo lo solicitado?
            </label>
            <select
              value={form.alcance_trabajo_ejecutado}
              onChange={(e) =>
                handleChange('alcance_trabajo_ejecutado', e.target.value as FormState['alcance_trabajo_ejecutado'])
              }
              disabled={isClosed}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            >
              <option value="">Sin definir</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
            <textarea
              value={form.alcance_trabajo_observacion}
              onChange={(e) => handleChange('alcance_trabajo_observacion', e.target.value)}
              rows={3}
              disabled={isClosed}
              placeholder="Observación de alcance, si corresponde."
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ¿Se ejecutó de acuerdo al programa?
            </label>
            <select
              value={form.ejecutado_segun_programa}
              onChange={(e) =>
                handleChange('ejecutado_segun_programa', e.target.value as FormState['ejecutado_segun_programa'])
              }
              disabled={isClosed}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            >
              <option value="">Sin definir</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
            <textarea
              value={form.ejecutado_segun_programa_observacion}
              onChange={(e) => handleChange('ejecutado_segun_programa_observacion', e.target.value)}
              rows={3}
              disabled={isClosed}
              placeholder="Indica el motivo si no se ejecutó según programa."
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Resultado del servicio
            </label>
            <textarea
              value={form.resultado_servicio}
              onChange={(e) => handleChange('resultado_servicio', e.target.value)}
              rows={4}
              disabled={isClosed}
              placeholder="Resumen del resultado final entregado al cliente."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observaciones de cierre
            </label>
            <textarea
              value={form.observaciones_cierre}
              onChange={(e) => handleChange('observaciones_cierre', e.target.value)}
              rows={4}
              disabled={isClosed}
              placeholder="Observaciones finales de entrega, pendientes o comentarios del cierre."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CierreStatusItem
            label={usaChecklistPorEquipo ? 'Ejecución técnica' : 'Contenido principal'}
            ok={hasContenidoPrincipalParaCierre}
            detail={
              usaChecklistPorEquipo
                ? hasContenidoPrincipalParaCierre
                  ? `Checklist técnico respondido: ${checklistResponsesCount} registro(s).`
                  : 'La ejecución técnica se completa desde la vista técnica antes del cierre.'
                : isAsesoria
                  ? hasTrabajoRealizado
                    ? 'El analisis tecnico o las conclusiones ya estan completas.'
                    : 'Debes completar el analisis tecnico o las conclusiones antes de cerrar.'
                  : hasTrabajoRealizado
                    ? 'El campo principal de ejecucion ya esta completo.'
                    : 'Debes completar el campo principal de ejecucion antes de cerrar.'
            }
          />

          <CierreStatusItem
            label="Cierre oficial de OM"
            ok={!!form.hora_termino || isClosed}
            detail={
              form.hora_termino || isClosed
                ? `Cierre registrado: ${form.hora_termino || formatTimeOnly(detalle.hora_termino)}.`
                : 'Debes ingresar la hora oficial de cierre antes de cerrar o entregar la OM.'
            }
          />

          <CierreStatusItem
            label="Contacto envío informe"
            ok={!!form.contacto_cliente_id && !!contactoEmailParaEnvio}
            detail={
              form.contacto_cliente_id && contactoEmailParaEnvio
                ? `Informe dirigido a ${form.contacto_cliente_nombre || 'contacto seleccionado'} <${contactoEmailParaEnvio}>.`
                : 'Selecciona un contacto con email para cerrar y enviar informe en el mismo paso.'
            }
          />

          <CierreStatusItem
            label="Bitácora de tiempos (opcional)"
            ok={true}
            detail={
              hasTiempos
                ? `Hay ${tiempos.length} registro(s) de tiempo en la OT. Sirven como respaldo operativo.`
                : 'Opcional: puedes registrar bloques de tiempo como respaldo operativo.'
            }
          />

          <CierreStatusItem
            label="Firmas (opcional)"
            ok={true}
            detail={
              hasAnyFirma
                ? `Firmas guardadas: ${firmas.length}. Tecnico: ${hasFirmaTecnico ? 'si­' : 'no'}. Cliente: ${hasFirmaCliente ? 'si' : 'no'}.`
                : 'Opcional: puedes guardar firma del cliente o tecnico, pero no bloquea el cierre rapido.'
            }
          />

          {usaChecklistPorEquipo ? (
          <CierreStatusItem
            label="Checklist técnico por equipo"
            ok={hasChecklistResponses}
            detail={
              requiresChecklistForClose
                ? hasChecklistResponses
                  ? `Checklist técnico respondido: ${checklistResponsesCount} registro(s).`
                  : 'Esta OM requiere checklist técnico por equipo y aún no tiene respuestas.'
                : 'Esta OM no exige checklist técnico para cierre.'
            }
          />
          ) : null}

          <CierreStatusItem
            label="Estado actual"
            ok={isClosed}
            detail={
              isClosed
                ? 'La OT ya se encuentra cerrada.'
                : 'La OT aun no esta cerrada.'
            }
          />
        </div>

        {cierreError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cierreError}
          </div>
        ) : null}

        {cierreSuccess ? (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {cierreSuccess}
          </div>
        ) : null}

        {emailError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {emailError}
          </div>
        ) : null}

        {emailSuccess ? (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {emailSuccess}
          </div>
        ) : null}

        {deleteError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {deleteError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadData(false)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Actualizar validacion
          </button>

          <button
            type="button"
            onClick={() => void handleCerrarOT(false)}
            disabled={closingOt || isClosed}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isClosed
              ? 'OT ya cerrada'
              : closingOt
                ? 'Guardando y cerrando OT...'
                : 'Guardar y cerrar OT'}
          </button>

          {!isClosed ? (
            <button
              type="button"
              onClick={() => void handleCerrarOT(true)}
              disabled={closingOt || sendingInforme || !form.contacto_cliente_id || !contactoEmailParaEnvio}
              className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {closingOt || sendingInforme
                ? 'Cerrando y enviando...'
                : 'Cerrar OT y enviar informe'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnviarInformeEmail()}
              disabled={sendingInforme || !form.contacto_cliente_id || !contactoEmailParaEnvio}
              className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sendingInforme ? 'Enviando informe...' : 'Enviar / reenviar informe'}
            </button>
          )}

          {currentRole === 'admin' ? (
            <button
              type="button"
              onClick={handleOpenDeleteModal}
              disabled={deletingOt}
              className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deletingOt ? 'Eliminando OT...' : 'Eliminar OT'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Historial de envíos de informe OM"
          subtitle="Registro de fecha, hora, contacto, correo y estado de cada envío o reenvío."
        />

        {enviosEmail.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Aún no hay envíos registrados para esta OM.
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Fecha / hora</th>
                    <th className="px-4 py-3 font-semibold">Contacto</th>
                    <th className="px-4 py-3 font-semibold">Correo</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Enviado por</th>
                    <th className="px-4 py-3 font-semibold">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {enviosEmail.map((envio) => (
                    <tr key={envio.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-4 py-3">{formatDateTime(envio.enviado_at || envio.created_at)}</td>
                      <td className="px-4 py-3">
                        {labelOrDash(envio.destinatario_nombre)}
                        {envio.destinatario_cargo ? ` - ${envio.destinatario_cargo}` : ''}
                      </td>
                      <td className="px-4 py-3">{envio.destinatario_email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            envio.estado === 'enviado'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : envio.estado === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {envio.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getUserLabel(envio.enviado_por)}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-[360px] whitespace-pre-wrap">
                          {envio.estado === 'error'
                            ? labelOrDash(envio.error_mensaje)
                            : labelOrDash(envio.proveedor_message_id || envio.asunto)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
                Eliminacion de OT
              </p>
              <h2 className="text-xl font-bold text-slate-900">
                Eliminar {resumen.folio || 'OT'}
              </h2>
              <p className="text-sm text-slate-600">
                Esta accion ocultara la orden del listado normal, pero conservara
                su historial, checklist, evidencias, tiempos e informes para auditoria.
              </p>
            </div>

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Motivo de eliminacion *
              <textarea
                value={deleteMotivo}
                onChange={(event) => setDeleteMotivo(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                placeholder="Ejemplo: OT creada como prueba, duplicada o ingresada por error."
              />
            </label>

            {deleteError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (deletingOt) return
                  setShowDeleteModal(false)
                  setDeleteMotivo('')
                }}
                disabled={deletingOt}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleConfirmDeleteOt()}
                disabled={deletingOt || !deleteMotivo.trim()}
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingOt ? 'Eliminando OT...' : 'Confirmar eliminacion'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function OTDetallePage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <OTDetalleContent />
    </ProtectedModuleRoute>
  )
}

