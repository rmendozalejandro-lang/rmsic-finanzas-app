import { buildAssistanceOfflineUpdate } from './ot-assistance'

export type OTUrgencyOfflineFields = {
  problema_reportado?: string
  causa_probable?: string
  trabajo_realizado?: string
  resultado_servicio?: string
  recomendaciones?: string
  fecha_ot?: string
  hora_inicio?: string
  hora_termino?: string
}

export type OTUrgencySyncPayload = OTUrgencyOfflineFields & {
  ot_id: string
  empresa_id: string
  user_id: string
  base_updated_at: string | null
}

type UrgencyUpdateFilters = {
  id: string
  empresa_id: string
  updated_at: string | null
}

type UrgencySyncDependencies = {
  updateOT: (values: Record<string, string | number | null>, filters: UrgencyUpdateFilters) => Promise<{
    data: { id: string } | null
    error: unknown
  }>
  removeDraft: (payload: OTUrgencySyncPayload) => void
  removeQueueItem: (queueItemId: string) => void
}

/** Maps an offline urgency to the same real columns used by the online form. */
export function buildUrgencyOfflineUpdate(fields: OTUrgencyOfflineFields): Record<string, string | number | null> {
  return {
    ...buildAssistanceOfflineUpdate(fields),
    resultado_servicio: fields.resultado_servicio?.trim() || null,
    recomendaciones: fields.recomendaciones?.trim() || null,
  }
}

export async function syncUrgencyOffline(
  payload: OTUrgencySyncPayload,
  queueItemId: string,
  dependencies: UrgencySyncDependencies,
) {
  // Build first: an invalid Chilean wall-clock time must never reach UPDATE.
  const update = buildUrgencyOfflineUpdate(payload)
  const response = await dependencies.updateOT(update, {
    id: payload.ot_id,
    empresa_id: payload.empresa_id,
    updated_at: payload.base_updated_at,
  })

  if (response.error) throw response.error
  if (!response.data) {
    throw new Error('Conflicto de versión: la OT cambió en línea. El avance offline se conservó para revisión manual.')
  }

  dependencies.removeDraft(payload)
  dependencies.removeQueueItem(queueItemId)
}
