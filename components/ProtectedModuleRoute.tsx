'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { ModuleKey } from '@/lib/auth/permissions'

type Props = {
  moduleKey: ModuleKey
  children: ReactNode
}

const STORAGE_ID_KEY = 'empresa_activa_id'

export default function ProtectedModuleRoute({
  moduleKey,
  children,
}: Props) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true

    const validateAccess = async () => {
      try {
        setChecking(true)
        setAllowed(false)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.replace('/login')
          return
        }

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(STORAGE_ID_KEY) || ''
            : ''

        if (!empresaActivaId) {
          router.replace('/')
          return
        }

        const userId = session.user.id

        const { data, error } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', userId)
          .eq('empresa_id', empresaActivaId)
          .eq('activo', true)
          .maybeSingle()

        if (error) {
          router.replace('/')
          return
        }

        const rol = data?.rol || ''

if (!active) return

if (!rol) {
  router.replace('/login')
  return
}

if (rol === 'tecnico_ot') {
  if (moduleKey !== 'ot') {
    router.replace('/ot')
    return
  }

  setAllowed(true)
  return
}

setAllowed(true)
      } catch (_error) {
        router.replace('/login')
      } finally {
        if (active) {
          setChecking(false)
        }
      }
    }

    void validateAccess()

    return () => {
      active = false
    }
  }, [moduleKey, router])

  if (checking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        Verificando permisos...
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}