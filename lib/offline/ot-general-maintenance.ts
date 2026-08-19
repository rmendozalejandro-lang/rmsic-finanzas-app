import { buildAssistanceOfflineUpdate } from './ot-assistance'

export type OTGeneralMaintenanceOfflineFields = {
  trabajo_realizado?: string
  hallazgos?: string
  resultado_servicio?: string
  recomendaciones?: string
  fecha_ot?: string
  hora_inicio?: string
  hora_termino?: string
}

export type OTGeneralMaintenanceSyncPayload = OTGeneralMaintenanceOfflineFields & {
  ot_id: string
  empresa_id: string
  user_id: string
  base_updated_at: string | null
}

type Filters = { id: string; empresa_id: string; updated_at: string | null }
type Dependencies = {
  updateOT: (values: Record<string, string | number | null>, filters: Filters) => Promise<{ data: { id: string } | null; error: unknown }>
  removeDraft: (payload: OTGeneralMaintenanceSyncPayload) => void
  removeQueueItem: (queueItemId: string) => void
}

export function buildGeneralMaintenanceOfflineUpdate(fields: OTGeneralMaintenanceOfflineFields) {
  const time = buildAssistanceOfflineUpdate(fields)
  return {
    trabajo_realizado: fields.trabajo_realizado?.trim() || null,
    hallazgos: fields.hallazgos?.trim() || null,
    resultado_servicio: fields.resultado_servicio?.trim() || null,
    recomendaciones: fields.recomendaciones?.trim() || null,
    hora_inicio: time.hora_inicio,
    hora_termino: time.hora_termino,
    duracion_minutos: time.duracion_minutos,
  }
}

export async function syncGeneralMaintenanceOffline(payload: OTGeneralMaintenanceSyncPayload, queueItemId: string, dependencies: Dependencies) {
  const update = buildGeneralMaintenanceOfflineUpdate(payload)
  const response = await dependencies.updateOT(update, { id: payload.ot_id, empresa_id: payload.empresa_id, updated_at: payload.base_updated_at })
  if (response.error) throw response.error
  if (!response.data) throw new Error('Conflicto de versión: la OT cambió en línea. El avance offline se conservó para revisión manual.')
  dependencies.removeDraft(payload)
  dependencies.removeQueueItem(queueItemId)
}
