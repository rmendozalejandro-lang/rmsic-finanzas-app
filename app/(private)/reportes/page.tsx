'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type ReportCard = {
  title: string
  description: string
  href: string
}

const reportes: ReportCard[] = [
  {
    title: 'Reporte de ingresos',
    description:
      'Consulta ventas, documentos emitidos, estados y montos registrados.',
    href: '/reportes/ingresos',
  },
  {
    title: 'Reporte de egresos',
    description:
      'Visualiza gastos, pagos, categorías y movimientos de salida.',
    href: '/reportes/egresos',
  },
  {
    title: 'Reporte de bancos',
    description:
      'Revisa saldos, movimientos pagados y comportamiento de cuentas bancarias.',
    href: '/reportes/bancos',
  },
  {
    title: 'Reporte de cobranza',
    description:
      'Consulta facturas pendientes, vencidas y seguimiento comercial.',
    href: '/reportes/cobranza',
  },
  {
    title: 'Antigüedad de saldos',
    description:
      'Clasifica cuentas por cobrar por tramo: al día, 1-30, 31-60, 61-90 y más de 90 días.',
    href: '/reportes/antiguedad-saldos',
  },
]

export default function ReportesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
      const empresaNombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

      setEmpresaActivaId(empresaId)
      setEmpresaActivaNombre(empresaNombre)
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Centro de reportes</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          Reportes financieros y contables
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Accede a los reportes disponibles según la empresa activa seleccionada.
        </p>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>Empresa activa:</strong>{' '}
          {empresaActivaNombre || 'Sin empresa activa seleccionada'}
          {empresaActivaId ? '' : ' — selecciona una empresa para trabajar con datos filtrados.'}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportes.map((reporte) => (
          <Link
            key={reporte.href}
            href={reporte.href}
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 group-hover:text-slate-700">
                  {reporte.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {reporte.description}
                </p>
              </div>

              <div className="text-sm font-medium text-blue-700">
                Abrir reporte →
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}