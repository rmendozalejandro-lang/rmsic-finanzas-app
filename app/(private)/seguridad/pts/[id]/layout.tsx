'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

type Feedback = {
  type: 'success' | 'error'
  message: string
}

type SignatureGate = {
  estado: string
  total: number
  firmadas: number
}

export default function PTSExpedienteLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const permisoId = params.id
  const contentRef = useRef<HTMLDivElement>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [signatureGate, setSignatureGate] = useState<SignatureGate | null>(null)

  const links = [
    { href: `/seguridad/pts/${permisoId}`, label: 'Resumen del expediente', exact: true },
    { href: `/seguridad/pts/${permisoId}/permisos`, label: 'Permisos complementarios', exact: false },
    { href: `/seguridad/pts/${permisoId}/firmas`, label: 'Firmas participantes', exact: false },
  ]

  useEffect(() => {
    setFeedback(null)
  }, [pathname])

  useEffect(() => {
    const loadSignatureGate = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        if (!empresaId) return setSignatureGate(null)

        const permisoResp = await supabase.from('pts_permisos').select('estado').eq('id', permisoId).eq('empresa_id', empresaId).maybeSingle()
        if (permisoResp.error || !permisoResp.data) return setSignatureGate(null)

        const estado = permisoResp.data.estado as string
        if (!['aprobado', 'en_ejecucion', 'cerrado'].includes(estado)) return setSignatureGate(null)

        const [personalResp, firmasResp] = await Promise.all([
          supabase.from('pts_personal').select('id').eq('permiso_id', permisoId).eq('empresa_id', empresaId),
          supabase.from('pts_firmas_participantes').select('id').eq('permiso_id', permisoId).eq('empresa_id', empresaId),
        ])
        if (personalResp.error || firmasResp.error) return setSignatureGate(null)

        setSignatureGate({
          estado,
          total: personalResp.data?.length ?? 0,
          firmadas: firmasResp.data?.length ?? 0,
        })
      } catch {
        setSignatureGate(null)
      }
    }

    void loadSignatureGate()
  }, [permisoId, pathname])

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

  const firmasCompletas = Boolean(signatureGate && signatureGate.total > 0 && signatureGate.firmadas === signatureGate.total)
  const firmasPendientes = signatureGate ? Math.max(0, signatureGate.total - signatureGate.firmadas) : 0

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

      {signatureGate?.estado === 'aprobado' ? (
        <div className={`border-b px-6 py-3 ${firmasCompletas ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${firmasCompletas ? 'text-emerald-700' : 'text-amber-700'}`}>Firmas previas al inicio</p>
              <p className={`mt-0.5 text-sm font-semibold ${firmasCompletas ? 'text-emerald-950' : 'text-amber-950'}`}>{signatureGate.firmadas} de {signatureGate.total} participantes firmaron</p>
              <p className={`mt-0.5 text-xs ${firmasCompletas ? 'text-emerald-800' : 'text-amber-800'}`}>{firmasCompletas ? 'Todos los participantes aceptaron el PTS. Ya puede iniciarse el trabajo.' : `El inicio está bloqueado hasta completar ${firmasPendientes} firma${firmasPendientes === 1 ? '' : 's'} pendiente${firmasPendientes === 1 ? '' : 's'}.`}</p>
            </div>
            <Link href={`/seguridad/pts/${permisoId}/firmas`} className={`inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${firmasCompletas ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}>{firmasCompletas ? 'Ver firmas' : 'Completar firmas'}</Link>
          </div>
        </div>
      ) : null}

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
