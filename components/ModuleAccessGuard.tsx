'use client'

import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'
import { canAccessModule, ModuleKey } from '../lib/auth/permissions'

const STORAGE_KEY = 'empresa_activa_id'
const TERRAIN_ACCESS_TTL_MS = 24 * 60 * 60 * 1000

type Props = {
  moduleKey: ModuleKey
  children: ReactNode
  allowOfflineTerrainAccess?: boolean
}

type TerrainAccessCache = {
  empresaId: string
  module: 'haras_partos'
  userId: string
  allowed: true
  validatedAt: string
  expiresAt: string
}

function terrainAccessKey(empresaId: string) {
  return `tralixia_terrain_access_v1_${empresaId}_haras_partos`
}

function readTerrainAccess(empresaId: string, userId: string) {
  try {
    const raw = window.localStorage.getItem(terrainAccessKey(empresaId))
    if (!raw) return false
    const cache = JSON.parse(raw) as Partial<TerrainAccessCache>
    return Boolean(
      cache.allowed === true &&
        cache.module === 'haras_partos' &&
        cache.empresaId === empresaId &&
        cache.userId === userId &&
        typeof cache.expiresAt === 'string' &&
        new Date(cache.expiresAt).getTime() > Date.now(),
    )
  } catch {
    return false
  }
}

export default function ModuleAccessGuard({
  moduleKey,
  children,
  allowOfflineTerrainAccess = false,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [offlineValidated, setOfflineValidated] = useState(false)
  const [offlineAccessMissing, setOfflineAccessMissing] = useState(false)

  useEffect(() => {
    let active = true

    const checkAccess = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''

        if (!empresaId) {
          if (active) {
            setAllowed(false)
            setOfflineAccessMissing(
              allowOfflineTerrainAccess && !navigator.onLine,
            )
          }
          return
        }

        if (!navigator.onLine && !allowOfflineTerrainAccess) {
          if (active) setAllowed(false)
          return
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          if (active) {
            setAllowed(false)
            setOfflineAccessMissing(
              allowOfflineTerrainAccess && !navigator.onLine,
            )
          }
          return
        }

        const userId = session.user.id

        if (!navigator.onLine) {
          const cachedAccess =
            allowOfflineTerrainAccess &&
            moduleKey === 'haras' &&
            readTerrainAccess(empresaId, userId)
          if (active) {
            setAllowed(cachedAccess)
            setOfflineValidated(cachedAccess)
            setOfflineAccessMissing(!cachedAccess)
          }
          return
        }

        const { data, error } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', userId)
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .maybeSingle()

        if (error || !data?.rol) {
          const networkFailure = Boolean(
            error &&
              (!navigator.onLine ||
                /failed to fetch|fetch failed|network|load failed/i.test(
                  error.message,
                )),
          )
          const cachedAccess =
            networkFailure &&
            allowOfflineTerrainAccess &&
            moduleKey === 'haras' &&
            readTerrainAccess(empresaId, userId)
          if (active) {
            setAllowed(cachedAccess)
            setOfflineValidated(cachedAccess)
            if (!cachedAccess && networkFailure && allowOfflineTerrainAccess) {
              setOfflineAccessMissing(true)
            }
          }
          return
        }

        const rol = data.rol as string

        if (!active) return

        if (rol === 'tecnico_ot') {
          if (allowOfflineTerrainAccess && moduleKey === 'haras') {
            try {
              window.localStorage.removeItem(terrainAccessKey(empresaId))
            } catch {
              // El bloqueo online prevalece aunque no se pueda limpiar el caché.
            }
          }
          if (moduleKey !== 'ot') {
            router.replace('/ot')
            return
          }

          setAllowed(true)
          return
        }

        const hasAccess = canAccessModule(rol, moduleKey)
        setAllowed(hasAccess)

        if (allowOfflineTerrainAccess && moduleKey === 'haras') {
          const key = terrainAccessKey(empresaId)
          if (hasAccess) {
            const validatedAt = new Date()
            const cache: TerrainAccessCache = {
              empresaId,
              module: 'haras_partos',
              userId,
              allowed: true,
              validatedAt: validatedAt.toISOString(),
              expiresAt: new Date(
                validatedAt.getTime() + TERRAIN_ACCESS_TTL_MS,
              ).toISOString(),
            }
            try {
              window.localStorage.setItem(key, JSON.stringify(cache))
            } catch {
              // El acceso online sigue válido aunque no se prepare el permiso local.
            }
          } else {
            try {
              window.localStorage.removeItem(key)
            } catch {
              // El rechazo online prevalece aunque no se pueda limpiar el caché.
            }
          }
        }
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
  }, [allowOfflineTerrainAccess, moduleKey, router])

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
            {offlineAccessMissing && allowOfflineTerrainAccess
              ? 'No se pudo validar acceso sin conexión. Abre esta pantalla con internet antes de usarla en terreno.'
              : 'No tienes permisos para acceder a este módulo.'}
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

  return (
    <>
      {offlineValidated && (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900"
        >
          Acceso validado localmente. Estás trabajando sin conexión.
        </div>
      )}
      {children}
    </>
  )
}
