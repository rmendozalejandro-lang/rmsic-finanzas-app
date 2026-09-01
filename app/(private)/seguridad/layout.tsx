'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import PTSPdfContextAction from '../../../components/pts/PTSPdfContextAction'

const items = [
  {
    href: '/seguridad/pts',
    label: 'Permisos de Trabajo Seguro',
    description: 'Solicitudes, revisión y autorización',
  },
]

export default function SeguridadLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-w-0">
      <div className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">
              Tralixia Seguridad
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Gestión de contratistas y permisos
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-2" aria-label="Módulo Seguridad">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? 'border-[#163A5F] bg-[#163A5F] !text-white shadow-sm hover:bg-[#0B2947] hover:!text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    title={item.description}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <PTSPdfContextAction />
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}
