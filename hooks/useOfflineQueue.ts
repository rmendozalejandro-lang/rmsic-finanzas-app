'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  addOfflineQueueItem,
  clearOfflineQueue,
  OFFLINE_QUEUE_CHANGED_EVENT,
  OFFLINE_QUEUE_STORAGE_KEY,
  listOfflineQueue,
  removeOfflineQueueItem,
  type AddOfflineQueueItem,
} from '@/lib/offline/offline-queue'

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === OFFLINE_QUEUE_STORAGE_KEY) callback()
  }

  window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, callback)
    window.removeEventListener('storage', onStorage)
  }
}

const EMPTY_QUEUE: ReturnType<typeof listOfflineQueue> = []

export function useOfflineQueue() {
  const items = useSyncExternalStore(subscribe, listOfflineQueue, () => EMPTY_QUEUE)
  const addPending = useCallback((input: AddOfflineQueueItem) => addOfflineQueueItem(input), [])
  const removePending = useCallback((id: string) => removeOfflineQueueItem(id), [])
  const clearPending = useCallback(() => clearOfflineQueue(), [])

  return {
    items,
    pendingCount: items.length,
    addPending,
    removePending,
    clearPending,
  }
}
