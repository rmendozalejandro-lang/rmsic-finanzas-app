import type { OTResumen } from '@/lib/ot/types'
import { addOfflineQueueItem, listOfflineQueue, updateOfflineQueueItem } from './offline-queue'

export const OT_MODULE = 'ot'
export const OT_ROUTE = '/ot'
export const OT_PENDING_ACTION = 'guardar_avance_ot'
export const OT_CACHE_PREFIX = 'tralixia_ot_offline_cache_v1'

export type OTOfflineDraft = {
  observacion_terreno: string
  estado_local_avance: string
  checklist_local: Record<string, boolean | string>
  equipos_locales?: Record<string, string>
  notas_internas_ejecucion: string
  problema_reportado?: string
  diagnostico?: string
  causa_probable?: string
  trabajo_realizado?: string
  recomendaciones?: string
  resultado_servicio?: string
  hallazgos?: string
  conclusiones_tecnicas?: string
  area_trabajo?: string
  seguridad_observacion?: string
  herramientas_materiales_utilizados?: string
  recomendaciones_seguridad?: string
}

export type OTOfflinePendingPayload = OTOfflineDraft & {
  local_id: string
  empresa_id: string
  user_id: string
  ot_id: string
  base_updated_at: string | null
  created_at: string
}

export type OTOfflineDetail = Record<string, unknown> & {
  id: string
  empresa_id: string
  folio?: string | null
  titulo?: string | null
  cliente_id?: string | null
  cliente_nombre?: string | null
  estado_nombre?: string | null
  requiere_checklist?: boolean | null
  updated_at?: string | null
}

export type OTOfflineCache = {
  empresa_id: string
  user_id: string
  updated_at: string
  routes: string[]
  ots: OTResumen[]
  detalles: OTOfflineDetail[]
}

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function otCacheKey(empresaId: string, userId: string) {
  return `${OT_CACHE_PREFIX}_${empresaId}_${userId}`
}

export function readOTOfflineCache(empresaId: string, userId: string): OTOfflineCache | null {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(otCacheKey(empresaId, userId))
    if (!raw) return null
    const cache = JSON.parse(raw) as Partial<OTOfflineCache>
    if (cache.empresa_id !== empresaId || cache.user_id !== userId || !Array.isArray(cache.ots)) return null
    return { ...cache, detalles: Array.isArray(cache.detalles) ? cache.detalles : [] } as OTOfflineCache
  } catch {
    return null
  }
}

export function writeOTOfflineCache(cache: OTOfflineCache) {
  if (!hasStorage()) return
  window.localStorage.setItem(otCacheKey(cache.empresa_id, cache.user_id), JSON.stringify(cache))
  window.dispatchEvent(new Event('tralixia-ot-offline-cache-changed'))
}

export function mergeOTOfflineCache(input: Omit<OTOfflineCache, 'updated_at' | 'routes'>) {
  writeOTOfflineCache({ ...input, routes: [OT_ROUTE, ...input.ots.map((ot) => `${OT_ROUTE}/${ot.id}`)], updated_at: new Date().toISOString() })
}

export function findCachedOTDetail(empresaId: string, userId: string, otId: string) {
  return readOTOfflineCache(empresaId, userId)?.detalles.find((detalle) => detalle.id === otId) ?? null
}

export function addOTOfflineDraft(payload: Omit<OTOfflinePendingPayload, 'local_id' | 'created_at'>) {
  const existing = listOfflineQueue().find((item) => {
    const queued = item.payload as Partial<OTOfflinePendingPayload>
    return item.module === OT_MODULE && item.action === OT_PENDING_ACTION && queued.ot_id === payload.ot_id && queued.empresa_id === payload.empresa_id && queued.user_id === payload.user_id
  })

  const nextPayload: OTOfflinePendingPayload = {
    ...payload,
    local_id: existing?.id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    created_at: new Date().toISOString(),
  }

  if (existing) {
    updateOfflineQueueItem(existing.id, { payload: nextPayload, status: 'pendiente', error: undefined })
    return { ...existing, payload: nextPayload, status: 'pendiente', error: undefined }
  }
  return addOfflineQueueItem({ module: OT_MODULE, action: OT_PENDING_ACTION, payload: nextPayload })
}

export function isOTPendingPayload(value: unknown): value is OTOfflinePendingPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<OTOfflinePendingPayload>
  return Boolean(payload.empresa_id && payload.user_id && payload.ot_id && payload.local_id)
}

export function otHasPendingLocalChanges(empresaId: string, userId: string, otId: string) {
  return listOfflineQueue().some((item) => {
    const payload = item.payload as Partial<OTOfflinePendingPayload>
    return item.module === OT_MODULE && item.action === OT_PENDING_ACTION && payload.empresa_id === empresaId && payload.user_id === userId && payload.ot_id === otId
  })
}
