'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

type OTDetalleLayoutProps = {
  children: ReactNode
}

export default function OTDetalleLayout({ children }: OTDetalleLayoutProps) {
  const pathname = usePathname()
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const isDetallePrincipal = Boolean(otId) && pathname === `/ot/${otId}`

  return (
    <>
      {isDetallePrincipal ? (
        <div className="mb-4 rounded-2xl border border-[#163A5F]/20 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#163A5F] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                  OT Viva
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Piloto de terreno
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Registra hallazgos, mediciones, hipótesis, acciones y resultados en una cronología técnica.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Por ahora funciona como prototipo local seguro y no modifica la OT formal ni la base productiva.
              </p>
            </div>

            <Link
              href={`/ot/${otId}/sesion`}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#245C90]"
            >
              Abrir OT Viva
            </Link>
          </div>
        </div>
      ) : null}

      {children}
    </>
  )
}
