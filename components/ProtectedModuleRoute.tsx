'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { ModuleKey } from '@/lib/auth/permissions'
import { readOTOfflineCache } from '@/lib/offline/ot'
import { OT_MODULE, readCurrentTerrainRegistry } from '@/lib/offline/terrain-registry'

type Props = {
  moduleKey: ModuleKey
  children: ReactNode
  allowOfflineTerrainAccess?: boolean
}

const STORAGE_ID_KEY = 'empresa_activa_id'

export default function ProtectedModuleRoute({
  moduleKey,
  children,
  allowOfflineTerrainAccess = false,
}: Props) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [offlineValidated, setOfflineValidated] = useState(false)
  const [offlineDenied, setOfflineDenied] = useState(false)

  useEffect(() => {
    let active = true

    const validateAccess = async () => {
      try {
        setChecking(true)
        setAllowed(false)
        setOfflineValidated(false)
        setOfflineDenied(false)

        if (
          typeof navigator !== 'undefined' &&
          !navigator.onLine &&
          allowOfflineTerrainAccess &&
          moduleKey === 'ot'
        ) {
          const registry = readCurrentTerrainRegistry()
          const hasOtModule = Boolean(
            registry?.modules.some((module) => module.module === OT_MODULE),
          )
          const cache = registry
            ? readOTOfflineCache(registry.empresaId, registry.userId)
            : null
          const hasPreparedOt = Boolean(cache?.ots.length)

          if (hasOtModule && hasPreparedOt) {
            if (!active) return
            setAllowed(true)
            setOfflineValidated(true)
            return
          }

          if (!active) return
          setOfflineDenied(true)
          return
        }

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
      } catch {
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
  }, [allowOfflineTerrainAccess, moduleKey, router])

  if (checking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        Verificando permisos...
      </div>
    )
  }

  if (offlineDenied) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Modo terreno</p>
          <h2 className="mt-2 text-xl font-semibold text-amber-950">
            No se pudo validar acceso sin conexión. Abre OT con internet antes de usarla en terreno.
          </h2>
        </div>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white no-underline"
        >
          Volver al menú
        </Link>
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  return (
    <>
      {offlineValidated ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
          Acceso validado localmente. Estás trabajando sin conexión.
        </div>
      ) : null}
      {children}
    </>
  )
}
