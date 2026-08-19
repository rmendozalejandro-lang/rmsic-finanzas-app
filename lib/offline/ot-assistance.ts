export type OTAssistanceOfflineFields = {
  problema_reportado?: string
  causa_probable?: string
  trabajo_realizado?: string
  fecha_ot?: string
  hora_inicio?: string
  hora_termino?: string
}

export type OTAssistanceSyncPayload = OTAssistanceOfflineFields & {
  ot_id: string
  empresa_id: string
  user_id: string
  base_updated_at: string | null
}

type AssistanceUpdateFilters = {
  id: string
  empresa_id: string
  updated_at: string | null
}

type AssistanceSyncDependencies = {
  updateOT: (values: Record<string, string | number | null>, filters: AssistanceUpdateFilters) => Promise<{
    data: { id: string } | null
    error: unknown
  }>
  removeDraft: (payload: OTAssistanceSyncPayload) => void
  removeQueueItem: (queueItemId: string) => void
}

const CHILE_TIME_ZONE = 'America/Santiago'

type DateTimeParts = { year: number; month: number; day: number; hour: number; minute: number }

function dateTimePartsInChile(value: Date): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value
    return result
  }, {})

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

function chileDateTime(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !timeMatch) return null

  const target: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }
  if (target.hour > 23 || target.minute > 59) return null

  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  let instant = new Date(targetAsUtc)

  // Resolve the Santiago offset at the requested instant; the second pass covers DST boundaries.
  for (let pass = 0; pass < 2; pass += 1) {
    const represented = dateTimePartsInChile(instant)
    const representedAsUtc = Date.UTC(represented.year, represented.month - 1, represented.day, represented.hour, represented.minute)
    instant = new Date(instant.getTime() + targetAsUtc - representedAsUtc)
  }

  const resolved = dateTimePartsInChile(instant)
  return Object.keys(target).every((key) => resolved[key as keyof DateTimeParts] === target[key as keyof DateTimeParts])
    ? instant
    : null
}

function nextCalendarDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(year, month - 1, day, 12)
  value.setDate(value.getDate() + 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

/** Builds the same real OT columns used online, rolling the end into the next day when needed. */
export function buildAssistanceOfflineUpdate(fields: OTAssistanceOfflineFields) {
  const update: Record<string, string | number | null> = {
    problema_reportado: fields.problema_reportado?.trim() || null,
    causa_probable: fields.causa_probable?.trim() || null,
    trabajo_realizado: fields.trabajo_realizado?.trim() || null,
  }

  const date = fields.fecha_ot?.slice(0, 10)
  if (fields.hora_inicio && fields.hora_termino && fields.hora_inicio === fields.hora_termino) {
    throw new Error('La hora de término debe ser distinta de la hora de inicio.')
  }

  const start = date && fields.hora_inicio ? chileDateTime(date, fields.hora_inicio) : null
  const endDate = date && fields.hora_inicio && fields.hora_termino && fields.hora_termino < fields.hora_inicio
    ? nextCalendarDate(date)
    : date
  const end = endDate && fields.hora_termino ? chileDateTime(endDate, fields.hora_termino) : null

  if (fields.hora_inicio && !start) {
    throw new Error('La hora de inicio seleccionada no existe o no es válida para la fecha en Chile.')
  }
  if (fields.hora_termino && !end) {
    throw new Error('La hora de término seleccionada no existe o no es válida para la fecha en Chile.')
  }

  update.hora_inicio = start?.toISOString() ?? null
  update.hora_termino = end?.toISOString() ?? null
  update.duracion_minutos = start && end
    ? Math.round((end.getTime() - start.getTime()) / 60000)
    : null

  return update
}

export function toOfflineTimeInput(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = dateTimePartsInChile(date)
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function requireAssistanceSyncMatch(value: { id: string } | null) {
  if (!value) {
    throw new Error('Conflicto de versión: la OT cambió en línea. El avance offline se conservó para revisión manual.')
  }
  return value
}

export async function syncAssistanceOffline(
  payload: OTAssistanceSyncPayload,
  queueItemId: string,
  dependencies: AssistanceSyncDependencies,
) {
  const update = buildAssistanceOfflineUpdate(payload)
  const response = await dependencies.updateOT(update, {
    id: payload.ot_id,
    empresa_id: payload.empresa_id,
    updated_at: payload.base_updated_at,
  })

  if (response.error) throw response.error
  requireAssistanceSyncMatch(response.data)
  dependencies.removeDraft(payload)
  dependencies.removeQueueItem(queueItemId)
}
