'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export default function PTSExpedienteLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const permisoId = params.id

  const links = [
    { href: `/seguridad/pts/${permisoId}`, label: 'Resumen del expediente', exact: true },
    { href: `/seguridad/pts/${permisoId}/permisos`, label: 'Permisos complementarios', exact: false },
  ]

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
      {children}
    </>
  )
}
