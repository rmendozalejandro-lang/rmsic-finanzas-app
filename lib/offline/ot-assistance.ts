export type OTAssistanceOfflineFields = {
  problema_reportado?: string
  causa_probable?: string
  trabajo_realizado?: string
  fecha_ot?: string
  hora_inicio?: string
  hora_termino?: string
}

function localDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? null : value
}

/** Builds the same real OT columns used online, rolling the end into the next day when needed. */
export function buildAssistanceOfflineUpdate(fields: OTAssistanceOfflineFields) {
  const update: Record<string, string | number | null> = {
    problema_reportado: fields.problema_reportado?.trim() || null,
    causa_probable: fields.causa_probable?.trim() || null,
    trabajo_realizado: fields.trabajo_realizado?.trim() || null,
  }

  const date = fields.fecha_ot?.slice(0, 10)
  const start = date && fields.hora_inicio ? localDateTime(date, fields.hora_inicio) : null
  const end = date && fields.hora_termino ? localDateTime(date, fields.hora_termino) : null

  if (start && end && end <= start) {
    end.setDate(end.getDate() + 1)
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
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
