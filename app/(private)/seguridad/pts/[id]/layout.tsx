'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type Feedback = {
  type: 'success' | 'error'
  message: string
}

export default function PTSExpedienteLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const permisoId = params.id
  const contentRef = useRef<HTMLDivElement>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const links = [
    { href: `/seguridad/pts/${permisoId}`, label: 'Resumen del expediente', exact: true },
    { href: `/seguridad/pts/${permisoId}/permisos`, label: 'Permisos complementarios', exact: false },
  ]

  useEffect(() => {
    setFeedback(null)
  }, [pathname])

  useEffect(() => {
    const root = contentRef.current
    if (!root) return

    const syncFeedback = () => {
      const directMessages = Array.from(root.querySelectorAll('main > div'))
      const successElement = directMessages.find(
        (element) =>
          element.classList.contains('border-emerald-200') &&
          element.classList.contains('bg-emerald-50') &&
          element.classList.contains('text-emerald-700')
      )
      const errorElement = directMessages.find(
        (element) =>
          element.classList.contains('border-red-200') &&
          element.classList.contains('bg-red-50') &&
          element.classList.contains('text-red-700')
      )

      const element = errorElement ?? successElement
      if (!element) {
        setFeedback(null)
        return
      }

      const message = element.textContent?.trim() || ''
      if (!message) {
        setFeedback(null)
        return
      }

      setFeedback({
        type: errorElement ? 'error' : 'success',
        message,
      })
    }

    syncFeedback()
    const observer = new MutationObserver(syncFeedback)
    observer.observe(root, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [pathname])

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Expediente PTS</span>
          {links.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-cyan-50 text-[#168F86]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div ref={contentRef}>{children}</div>

      {feedback ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2.5rem))] rounded-2xl border p-4 shadow-xl ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em]">
                {feedback.type === 'error' ? 'No se pudo completar la acción' : 'Acción registrada'}
              </p>
              <p className="mt-1 text-sm leading-5">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="rounded-lg px-2 py-1 text-sm font-semibold opacity-70 hover:bg-white/60 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
