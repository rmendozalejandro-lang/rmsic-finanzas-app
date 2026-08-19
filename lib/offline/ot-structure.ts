export type OTOfflineStructureInput = Record<string, unknown> & {
  estructura_ot_codigo?: unknown
  tipo_servicio_codigo?: unknown
  tipo_servicio_nombre?: unknown
  plantilla_ot_config?: unknown
  plantilla_checklist_info?: unknown
  equipos_asociados?: unknown
  requiere_checklist?: unknown
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalized(value: unknown) {
  return typeof value === 'string'
    ? value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : ''
}

/** Classifies an OT from its service and template configuration, never from a company id. */
export function getOfflineStructure(detail: OTOfflineStructureInput) {
  const config = record(detail.plantilla_ot_config)
  const checklistInfo = record(detail.plantilla_checklist_info)
  const text = [
    detail.estructura_ot_codigo, detail.tipo_servicio_codigo, detail.tipo_servicio_nombre,
    config.codigo, config.nombre, config.flujo_ot, config.formato_ot, checklistInfo.tipo_activo,
  ].map(normalized).join(' ')
  const equipos = Array.isArray(detail.equipos_asociados) ? detail.equipos_asociados : []
  const usaEquiposMultiples = Boolean(config.usa_equipos_multiples) || equipos.length > 1
  const usaChecklistPorEquipo = Boolean(config.usa_checklist_por_equipo) ||
    text.includes('checklist equipo') || text.includes('checklist_por_equipo') ||
    normalized(checklistInfo.tipo_activo).includes('motor') || normalized(checklistInfo.tipo_activo).includes('valvula')
  const usaChecklistPorHoras = Boolean(config.usa_checklist_por_horas) || text.includes('mespack')
  const tieneChecklist = Boolean(detail.requiere_checklist) || usaChecklistPorEquipo || usaChecklistPorHoras
  const isPreventiva = text.includes('preventiv') || usaChecklistPorHoras ||
    (tieneChecklist && (text.includes('mantencion') || text.includes('mantenimiento')))
  const isMantenimientoGeneral =
    (text.includes('mantencion_general') || text.includes('mantenimiento_general') || text.includes('mantenimiento general')) &&
    !isPreventiva && !tieneChecklist && !usaEquiposMultiples
  const isUrgencia = text.includes('urgencia')
  const isAsistencia = text.includes('asistencia')

  const common = { usaEquiposMultiples, usaChecklistPorEquipo, usaChecklistPorHoras, isMantenimientoGeneral, isAsistencia, isUrgencia }
  if (usaChecklistPorEquipo) return { kind: 'checklist_por_equipo' as const, title: 'Estructura checklist por equipo', ...common }
  if (usaChecklistPorHoras) return { kind: 'checklist_por_horas' as const, title: 'Estructura checklist por horas', ...common }
  if (usaEquiposMultiples) return { kind: 'equipos_multiples' as const, title: 'Estructura con múltiples equipos', ...common }
  if (isPreventiva) return { kind: 'preventiva' as const, title: 'Estructura mantenimiento preventivo', ...common }
  if (isMantenimientoGeneral) return { kind: 'mantenimiento_general' as const, title: 'Estructura mantenimiento general', ...common }
  if (isUrgencia || isAsistencia) return { kind: 'asistencia_urgencia' as const, title: isUrgencia ? 'Estructura urgencia técnica' : 'Estructura asistencia técnica', ...common, isAsistencia, isUrgencia }
  return { kind: 'general' as const, title: 'Estructura general de OT', ...common }
}
