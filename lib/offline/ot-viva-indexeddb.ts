'use client'

const DB_NAME = 'tralixia-offline'
const DB_VERSION = 1
const STORE_NAME = 'ot-viva'

export type OTVivaIndexedRecord = {
  key: string
  payload: string
  updated_at: string
}

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB no está disponible en este navegador.'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
  })
}

export async function guardarOTVivaIndexedDB(key: string, payload: string) {
  const db = await abrirDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({
        key,
        payload,
        updated_at: new Date().toISOString(),
      } satisfies OTVivaIndexedRecord)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar el respaldo offline.'))
      tx.onabort = () => reject(tx.error ?? new Error('Se canceló el guardado offline.'))
    })
  } finally {
    db.close()
  }
}

export async function leerOTVivaIndexedDB(key: string): Promise<OTVivaIndexedRecord | null> {
  const db = await abrirDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve((request.result as OTVivaIndexedRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('No se pudo leer el respaldo offline.'))
    })
  } finally {
    db.close()
  }
}
