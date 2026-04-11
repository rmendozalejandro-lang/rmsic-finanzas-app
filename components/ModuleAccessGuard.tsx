'use client'

import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { canAccessModule, ModuleKey, RolEmpresa } from '../lib/auth/permissions'

const STORAGE_KEY = 'empresa_activa_id'

type Props = {
  moduleKey: ModuleKey
  children: ReactNode
}

export default function ModuleAccessGuard({ moduleKey, children }: Props) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''

        if (!empresaId) {
          setAllowed(false)
          return
        }

        const { data } = await supabase.auth.getSession()

        if (!data.session) {
          setAllowed(false)
          return
        }

        const accessToken = data.session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const userId = data.session.user.id

        const resp = await fetch(
          `${baseUrl}/rest/v1/usuario_empresas?select=rol&usuario_id=eq.${userId}&empresa_id=eq.${empresaId}&activo=eq.true`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        const json = await resp.json()

        if (!resp.ok || !json?.length) {
          setAllowed(false)
          return
        }

        const rol = (json[0].rol ?? '') as RolEmpresa
        setAllowed(canAccessModule(rol, moduleKey))
      } catch (error) {
        console.error('Error validando acceso al módulo:', error)
        setAllowed(false)
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [moduleKey])

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
            href="/"
            className="inline-block mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  return <>{children}</>
}