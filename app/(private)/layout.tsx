'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type PrivateLayoutProps = {
  children: ReactNode
}

type Empresa = {
  id: string
  nombre: string
}

const menuItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/ingresos', label: 'Ingresos' },
  { href: '/egresos', label: 'Egresos' },
  { href: '/cobranza', label: 'Cobranza' },
  { href: '/bancos', label: 'Bancos' },
  { href: '/reportes', label: 'Reportes' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/proveedores', label: 'Proveedores' },
  { href: '/transferencias', label: 'Transferencias' },
  { href: '/remuneraciones', label: 'Remuneraciones' },
]

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [checkingSession, setCheckingSession] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaActivaId, setEmpresaActivaId] = useState('')

  const persistEmpresaActiva = (empresa: Empresa) => {
    setEmpresaActivaId(empresa.id)
    window.localStorage.setItem(STORAGE_ID_KEY, empresa.id)
    window.localStorage.setItem(STORAGE_NAME_KEY, empresa.nombre)
    window.dispatchEvent(new Event('empresa-activa-cambiada'))
  }

  useEffect(() => {
    const checkSessionAndLoadEmpresas = async () => {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.push('/login')
        return
      }

      try {
        const accessToken = data.session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        const resp = await fetch(
          `${baseUrl}/rest/v1/empresas?select=id,nombre&order=nombre.asc`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        const json = await resp.json()

        if (resp.ok) {
          const empresasData = json ?? []
          setEmpresas(empresasData)

          const guardada = window.localStorage.getItem(STORAGE_ID_KEY)

          if (guardada) {
            const empresaGuardada = empresasData.find(
              (empresa: Empresa) => empresa.id === guardada
            )

            if (empresaGuardada) {
              persistEmpresaActiva(empresaGuardada)
            } else if (empresasData.length > 0) {
              persistEmpresaActiva(empresasData[0])
            }
          } else if (empresasData.length > 0) {
            persistEmpresaActiva(empresasData[0])
          }
        }
      } catch (error) {
        console.error('Error cargando empresas:', error)
      } finally {
        setCheckingSession(false)
      }
    }

    checkSessionAndLoadEmpresas()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleEmpresaChange = (empresaId: string) => {
    const empresaSeleccionada = empresas.find((empresa) => empresa.id === empresaId)

    if (!empresaSeleccionada) return

    persistEmpresaActiva(empresaSeleccionada)
    router.refresh()
  }

  const empresaActiva = empresas.find((empresa) => empresa.id === empresaActivaId)

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-7xl mx-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Verificando sesión...
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                RMSIC
              </p>
              <h1 className="mt-1 text-2xl font-semibold">
                Plataforma financiera
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[260px]">
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                  Empresa activa
                </label>
                <select
                  value={empresaActivaId}
                  onChange={(e) => handleEmpresaChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
                >
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">
                  Raúl Mendoza
                </p>
                <p className="text-xs text-slate-500">
                  {empresaActiva?.nombre ?? 'Administración financiera'}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            {menuItems.map((item) => {
              const active = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  )
}