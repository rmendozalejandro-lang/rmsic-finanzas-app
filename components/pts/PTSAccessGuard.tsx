'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

type Props = { children: ReactNode }

export default function PTSAccessGuard({ children }: Props) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true

    const validate = async () => {
      try {
        if (active) {
          setLoading(true)
          setAllowed(false)
        }

        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!empresaId || !session?.user?.id) return

        const [usuarioResp, moduloResp] = await Promise.all([
          supabase
            .from('usuario_empresas')
            .select('rol, activo')
            .eq('usuario_id', session.user.id)
            .eq('empresa_id', empresaId)
            .eq('activo', true)
            .maybeSingle(),
          supabase
            .from('empresa_modulos')
            .select('habilitado')
            .eq('empresa_id', empresaId)
            .eq('modulo', 'seguridad')
            .eq('habilitado', true)
            .maybeSingle(),
        ])

        const rol = usuarioResp.data?.rol || ''
        const hasRole = ['admin', 'seguridad_pts', 'demo_cliente'].includes(rol)
        const hasModule = Boolean(moduloResp.data?.habilitado)

        if (active) setAllowed(hasRole && hasModule)
      } finally {
        if (active) setLoading(false)
      }
    }

    const revalidate = () => void validate()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) revalidate()
    }

    revalidate()
    window.addEventListener('empresa-activa-cambiada', revalidate)
    window.addEventListener('storage', handleStorage)

    return () => {
      active = false
      window.removeEventListener('empresa-activa-cambiada', revalidate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  if (loading) {
    return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-slate-500">Verificando acceso a Seguridad...</div>
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">Acceso restringido</h1>
          <p className="mt-2 text-sm text-red-700">Tu usuario no tiene habilitado el módulo de Permisos de Trabajo Seguro.</p>
          <Link href="/" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Volver</Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
