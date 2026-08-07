'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import ProtectedCotizacionesRoute from '@/components/ProtectedCotizacionesRoute'
import CotizacionOtRelacionesPanel from '@/components/comercial/CotizacionOtRelacionesPanel'

const STORAGE_ID_KEY = 'empresa_activa_id'

export default function CotizacionOtRelacionadasPage() {
  const params = useParams<{ id: string }>()
  const cotizacionId = useMemo(() => String(params?.id || ''), [params])
  const [empresaId, setEmpresaId] = useState('')

  useEffect(() => {
    const syncEmpresa = () => {
      setEmpresaId(window.localStorage.getItem(STORAGE_ID_KEY) || '')
    }

    syncEmpresa()
    window.addEventListener('empresa-activa-cambiada', syncEmpresa)
    return () => window.removeEventListener('empresa-activa-cambiada', syncEmpresa)
  }, [])

  return (
    <ProtectedCotizacionesRoute>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Cotización</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">OT relacionadas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Consulta de vínculos comerciales registrados para esta cotización.
            </p>
          </div>
          <Link
            href={`/cotizaciones/${cotizacionId}`}
            className="inline-flex w-fit items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Volver a cotización
          </Link>
        </header>

        {!empresaId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
            No se encontró una empresa activa en el navegador.
          </div>
        ) : (
          <CotizacionOtRelacionesPanel
            modo="cotizacion"
            cotizacionId={cotizacionId}
            empresaId={empresaId}
          />
        )}
      </div>
    </ProtectedCotizacionesRoute>
  )
}
