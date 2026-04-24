'use client'

import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'
import { canAccessModule, ModuleKey } from '../lib/auth/permissions'

const STORAGE_KEY = 'empresa_activa_id'

type Props = {
  moduleKey: ModuleKey
  children: ReactNode
}

export default function ModuleAccessGuard({ moduleKey, children }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true

    const checkAccess = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''

        if (!empresaId) {
          if (active) setAllowed(false)
          return
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          if (active) setAllowed(false)
          return
        }

        const userId = session.user.id

        const { data, error } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', userId)
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .maybeSingle()

        if (error || !data?.rol) {
          if (active) setAllowed(false)
          return
        }

        const rol = data.rol as string

        if (!active) return

        if (rol === 'tecnico_ot') {
          if (moduleKey !== 'ot') {
            router.replace('/ot')
            return
          }

          setAllowed(true)
          return
        }

        setAllowed(canAccessModule(rol, moduleKey))
      } catch (error) {
        console.error('Error validando acceso al módulo:', error)
        if (active) setAllowed(false)
      } finally {
        if (active) setLoading(false)
      }
    }

    void checkAccess()

    return () => {
      active = false
    }
  }, [moduleKey, router])

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Verificando permisos...
        </div>
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-red-800">Acceso restringido</h2>
          <p className="mt-2 text-sm text-red-700">
            No tienes permisos para acceder a este módulo.
          </p>
          <Link
            href="/ot"
            className="inline-block mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Volver
          </Link>
        </div>
      </main>
    )
  }

  return <>{children}</>
}