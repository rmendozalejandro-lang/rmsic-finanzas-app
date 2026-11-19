'use client'

const DB_NAME = 'tralixia-ot-viva-local-audio'
const DB_VERSION = 1
const STORE = 'recordings'

export type PendingVivaAudio = {
  id: string
  empresaId: string
  userId: string
  otId: string
  destino: 'evento' | 'ia'
  createdAt: string
  mimeType: string
  size: number
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Este dispositivo no admite almacenamiento local de audios.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('No se pudo abrir almacenamiento local de audio.'))
    req.onblocked = () => reject(new Error('Almacenamiento local bloqueado por otra pestaña.'))
  })
}

export async function savePendingVivaAudio(
  data: Omit<PendingVivaAudio, 'id' | 'createdAt' | 'mimeType' | 'size'>,
): Promise<PendingVivaAudio> {
  const item: PendingVivaAudio = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mimeType: data.blob.type || 'application/octet-stream',
    size: data.blob.size,
  }
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el audio local.'))
      tx.onabort = () => reject(tx.error || new Error('El navegador canceló el guardado del audio.'))
    })
    return item
  } finally {
    db.close()
  }
}

export async function listPendingVivaAudio(
  empresaId: string, userId: string, otId: string,
): Promise<PendingVivaAudio[]> {
  const db = await openDb()
  try {
    const items = await new Promise<PendingVivaAudio[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as PendingVivaAudio[])
      req.onerror = () => reject(req.error || new Error('No se pudieron leer los audios locales.'))
    })
    return items.filter((item) =>
      item.empresaId === empresaId && item.userId === userId && item.otId === otId
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } finally {
    db.close()
  }
}

export async function deletePendingVivaAudio(id: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('No se pudo eliminar el audio local.'))
      tx.onabort = () => reject(tx.error || new Error('El navegador canceló la eliminación del audio.'))
    })
  } finally {
    db.close()
  }
}
