'use client'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

export default function OfflineStatusBanner() {
  const { isOffline } = useNetworkStatus()
  const { pendingCount } = useOfflineQueue()

  if (!isOffline && pendingCount === 0) return null

  return (
    <div
      role={isOffline ? 'status' : undefined}
      aria-live="polite"
      className={`border-b px-4 py-2 print:hidden sm:px-6 lg:px-8 ${
        isOffline
          ? 'border-amber-300 bg-amber-50 text-amber-950'
          : 'border-sky-200 bg-sky-50 text-sky-950'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-medium sm:text-sm">
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${isOffline ? 'bg-amber-500' : 'bg-sky-500'}`}
        />
        <span>{isOffline ? 'Sin conexión' : 'Con conexión'}</span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold shadow-sm">
            {pendingCount} {pendingCount === 1 ? 'pendiente local' : 'pendientes locales'}
          </span>
        )}
      </div>
    </div>
  )
}
