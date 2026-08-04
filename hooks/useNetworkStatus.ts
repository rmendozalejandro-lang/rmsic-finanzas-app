'use client'

import { useSyncExternalStore } from 'react'

const subscribers = new Set<() => void>()
let listening = false

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber())
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber)

  if (!listening) {
    window.addEventListener('online', notifySubscribers)
    window.addEventListener('offline', notifySubscribers)
    listening = true
  }

  return () => {
    subscribers.delete(subscriber)
    if (subscribers.size === 0 && listening) {
      window.removeEventListener('online', notifySubscribers)
      window.removeEventListener('offline', notifySubscribers)
      listening = false
    }
  }
}

function getSnapshot() {
  return navigator.onLine
}

export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, () => true)

  return { isOnline, isOffline: !isOnline }
}
