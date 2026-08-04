export const OFFLINE_QUEUE_STORAGE_KEY = 'tralixia_offline_queue_v1'
export const OFFLINE_QUEUE_CHANGED_EVENT = 'tralixia-offline-queue-changed'

export const TERRAIN_MODULES = [
  'haras_partos',
  'ot',
  'informes_tecnicos',
  'evidencias',
  'mediciones',
  'fotos',
] as const

export type TerrainModule = (typeof TERRAIN_MODULES)[number]
export type OfflineQueueStatus = 'pendiente' | 'sincronizando' | 'error'

export type OfflineQueueItem = {
  id: string
  module: TerrainModule
  action: string
  payload: unknown
  status: OfflineQueueStatus
  createdAt: string
  updatedAt: string
  error?: string
}

export type AddOfflineQueueItem = {
  module: TerrainModule
  action: string
  payload: unknown
  error?: string
}

let cachedRaw: string | null | undefined
let cachedItems: OfflineQueueItem[] = []

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isQueueItem(value: unknown): value is OfflineQueueItem {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<OfflineQueueItem>
  return (
    typeof item.id === 'string' &&
    TERRAIN_MODULES.some((module) => module === item.module) &&
    typeof item.action === 'string' &&
    ['pendiente', 'sincronizando', 'error'].includes(item.status ?? '') &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  )
}

export function listOfflineQueue(): OfflineQueueItem[] {
  if (!hasBrowserStorage()) return []

  const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY)
  if (raw === cachedRaw) return cachedItems

  cachedRaw = raw
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cachedItems = Array.isArray(parsed) ? parsed.filter(isQueueItem) : []
  } catch {
    cachedItems = []
  }

  return cachedItems
}

function persistQueue(items: OfflineQueueItem[]) {
  if (!hasBrowserStorage()) {
    throw new Error('La cola offline solo está disponible en el navegador.')
  }

  const raw = JSON.stringify(items)
  window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, raw)
  cachedRaw = raw
  cachedItems = items
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
}

export function addOfflineQueueItem(input: AddOfflineQueueItem): OfflineQueueItem {
  const timestamp = new Date().toISOString()
  const item: OfflineQueueItem = {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    status: input.error ? 'error' : 'pendiente',
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  persistQueue([...listOfflineQueue(), item])
  return item
}

export function removeOfflineQueueItem(id: string) {
  persistQueue(listOfflineQueue().filter((item) => item.id !== id))
}

export function updateOfflineQueueItem(
  id: string,
  changes: Partial<Pick<OfflineQueueItem, 'payload' | 'status' | 'error'>>,
) {
  persistQueue(
    listOfflineQueue().map((item) =>
      item.id === id
        ? { ...item, ...changes, updatedAt: new Date().toISOString() }
        : item,
    ),
  )
}

export function countOfflineQueue() {
  return listOfflineQueue().length
}

export function clearOfflineQueue() {
  persistQueue([])
}
