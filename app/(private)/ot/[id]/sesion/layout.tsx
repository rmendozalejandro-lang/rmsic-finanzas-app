'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import OTVivaSyncStatus from '@/components/asistente/OTVivaSyncStatus'

export default function OTVivaSesionLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const otId = params?.id || ''
  const relacionesActivas = pathname.endsWith('/relaciones')

  return (
    <div className="space-y-4">
      <nav className="mx-auto flex max-w-6xl gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <Link
          href={`/ot/${otId}/sesion`}
          className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-black transition ${
            !relacionesActivas
              ? 'bg-[#163A5F] text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Registro de terreno
        </Link>
        <Link
          href={`/ot/${otId}/sesion/relaciones`}
          className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-black transition ${
            relacionesActivas
              ? 'bg-[#163A5F] text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Relaciones técnicas
        </Link>
      </nav>

      <OTVivaSyncStatus />
      {children}
    </div>
  )
}
