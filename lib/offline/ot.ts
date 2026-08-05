import type { OTResumen } from '@/lib/ot/types'
import { addOfflineQueueItem, listOfflineQueue, updateOfflineQueueItem } from './offline-queue'

export const OT_MODULE = 'ot'
export const OT_ROUTE = '/ot'
export const OT_PENDING_ACTION = 'guardar_avance_ot'
export const OT_CACHE_SCHEMA_VERSION = 2
export const OT_CACHE_PREFIX = 'tralixia_ot_offline_cache_v2'

export type OTOfflineDraft = {
  observacion_terreno: string
  estado_local_avance: string
  checklist_local: Record<string, boolean | string | { estado?: 'ok' | 'no_ok' | 'na' | 'observado' | ''; observacion?: string }>
  equipos_locales?: Record<string, string>
  notas_internas_ejecucion: string
  descripcion_solicitud?: string
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
  schema_version: typeof OT_CACHE_SCHEMA_VERSION
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

export function isOTOfflineOperative(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const estado = String(record.estado_nombre ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const fechaCierre = typeof record.fecha_cierre === 'string' ? record.fecha_cierre.trim() : ''
  const deletedAt = typeof record.deleted_at === 'string' ? record.deleted_at.trim() : ''
  const activo = record.activo

  if (deletedAt) return false
  if (activo === false) return false
  if (fechaCierre) return false
  if (estado.includes('cerrad') || estado.includes('anulad') || estado.includes('archivad')) return false
  return true
}

function normalizeOTOfflineCache(cache: Partial<OTOfflineCache>, empresaId: string, userId: string): OTOfflineCache | null {
  if (cache.schema_version !== OT_CACHE_SCHEMA_VERSION) return null
  if (cache.empresa_id !== empresaId || cache.user_id !== userId) return null
  if (!Array.isArray(cache.ots) || !Array.isArray(cache.detalles)) return null

  const detalles = cache.detalles.filter((detalle): detalle is OTOfflineDetail =>
    Boolean(detalle?.id) && detalle.empresa_id === empresaId && isOTOfflineOperative(detalle)
  )
  const detalleIds = new Set(detalles.map((detalle) => detalle.id))
  const ots = cache.ots.filter((ot) => detalleIds.has(ot.id) && isOTOfflineOperative(ot))
  const otIds = new Set(ots.map((ot) => ot.id))
  const detallesFiltrados = detalles.filter((detalle) => otIds.has(detalle.id))

  if (ots.length === 0 || detallesFiltrados.length === 0) return null

  return {
    schema_version: OT_CACHE_SCHEMA_VERSION,
    empresa_id: empresaId,
    user_id: userId,
    updated_at: cache.updated_at ?? '',
    routes: [OT_ROUTE, ...ots.map((ot) => `${OT_ROUTE}/${ot.id}`)],
    ots,
    detalles: detallesFiltrados,
  }
}

export function readOTOfflineCache(empresaId: string, userId: string): OTOfflineCache | null {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(otCacheKey(empresaId, userId))
    if (!raw) return null
    return normalizeOTOfflineCache(JSON.parse(raw) as Partial<OTOfflineCache>, empresaId, userId)
  } catch {
    return null
  }
}

export function writeOTOfflineCache(cache: OTOfflineCache) {
  if (!hasStorage()) return
  const normalized = normalizeOTOfflineCache(cache, cache.empresa_id, cache.user_id)
  if (!normalized) return
  window.localStorage.setItem(otCacheKey(normalized.empresa_id, normalized.user_id), JSON.stringify(normalized))
  window.dispatchEvent(new Event('tralixia-ot-offline-cache-changed'))
}

export function mergeOTOfflineCache(input: Omit<OTOfflineCache, 'schema_version' | 'updated_at' | 'routes'>) {
  writeOTOfflineCache({ ...input, schema_version: OT_CACHE_SCHEMA_VERSION, routes: [OT_ROUTE, ...input.ots.map((ot) => `${OT_ROUTE}/${ot.id}`)], updated_at: new Date().toISOString() })
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
