'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase/client'

const STORAGE_ID_KEY = 'empresa_activa_id'

export default function PrivateTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [puedeVerPts, setPuedeVerPts] = useState(false)
  const [checkingPts, setCheckingPts] = useState(true)

  const refreshPtsAccess = useCallback(async () => {
    const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''

    if (!empresaId) {
      setPuedeVerPts(false)
      setCheckingPts(false)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setPuedeVerPts(false)
      setCheckingPts(false)
      return
    }

    const { data, error } = await supabase.rpc('usuario_tiene_acceso_pts', {
      p_empresa_id: empresaId,
    })

    setPuedeVerPts(!error && Boolean(data))
    setCheckingPts(false)
  }, [])

  useEffect(() => {
    void refreshPtsAccess()

    const handleEmpresaChange = () => {
      setCheckingPts(true)
      void refreshPtsAccess()
    }

    window.addEventListener('empresa-activa-cambiada', handleEmpresaChange)
    return () => window.removeEventListener('empresa-activa-cambiada', handleEmpresaChange)
  }, [refreshPtsAccess])

  const estaEnSeguridad = pathname === '/seguridad' || pathname.startsWith('/seguridad/')

  return (
    <>
      {!checkingPts && puedeVerPts && !estaEnSeguridad && (
        <div className="border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">
                Seguridad
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Gestión de contratistas y permisos de trabajo seguro
              </p>
            </div>

            <Link
              href="/seguridad/pts"
              className="inline-flex items-center justify-center rounded-2xl bg-[#163A5F] px-4 py-2.5 text-sm font-semibold !text-white no-underline shadow-sm transition hover:bg-[#0B2947] hover:!text-white"
            >
              Permisos de Trabajo Seguro (PTS)
            </Link>
          </div>
        </div>
      )}

      {children}
    </>
  )
}
