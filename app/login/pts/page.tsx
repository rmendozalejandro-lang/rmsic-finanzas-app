'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type UsuarioEmpresaRow = {
  empresa_id: string
  rol: string
  activo: boolean
}

type EmpresaRow = {
  id: string
  nombre: string
}

async function resolvePTSAccess() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return { allowed: false, route: '/login/pts', message: 'No se pudo validar la sesión.' }
  }

  const { data: accesos, error: accesosError } = await supabase
    .from('usuario_empresas')
    .select('empresa_id, rol, activo')
    .eq('usuario_id', session.user.id)
    .eq('activo', true)

  if (accesosError) {
    return { allowed: false, route: '/login/pts', message: 'No se pudo validar el acceso PTS.' }
  }

  const candidatos = ((accesos ?? []) as UsuarioEmpresaRow[]).filter(
    (item) => item.rol === 'seguridad_pts' || item.rol === 'admin'
  )

  for (const acceso of candidatos) {
    const { data: modulo } = await supabase
      .from('empresa_modulos')
      .select('habilitado')
      .eq('empresa_id', acceso.empresa_id)
      .eq('modulo', 'seguridad')
      .eq('habilitado', true)
      .maybeSingle()

    if (!modulo?.habilitado) continue

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, nombre')
      .eq('id', acceso.empresa_id)
      .maybeSingle()

    if (!empresa) continue

    const empresaRow = empresa as EmpresaRow
    window.localStorage.setItem(STORAGE_ID_KEY, empresaRow.id)
    window.localStorage.setItem(STORAGE_NAME_KEY, empresaRow.nombre)
    window.dispatchEvent(new Event('empresa-activa-cambiada'))

    return { allowed: true, route: '/seguridad/pts', message: '' }
  }

  return {
    allowed: false,
    route: '/login/pts',
    message: 'Tu usuario no tiene habilitado el módulo de Permisos de Trabajo Seguro.',
  }
}

export default function PTSLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return

        const result = await resolvePTSAccess()
        if (active && result.allowed) {
          router.replace(result.route)
        }
      } finally {
        if (active) setChecking(false)
      }
    }

    void check()
    return () => {
      active = false
    }
  }, [router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo electrónico y contraseña.')
      return
    }

    try {
      setLoading(true)
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (loginError) {
        setError('No fue posible iniciar sesión. Revisa tus credenciales.')
        return
      }

      const result = await resolvePTSAccess()
      if (!result.allowed) {
        await supabase.auth.signOut()
        setError(result.message)
        return
      }

      router.replace(result.route)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible validar el acceso PTS.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061524] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-7 text-sm text-slate-300 shadow-xl">
          Verificando acceso a Seguridad...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#061524] px-6 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Tralixia Seguridad</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight">Permisos de Trabajo Seguro</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Gestión digital de solicitudes, revisión, autorización y trazabilidad de trabajos de contratistas.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {['Prevalidación', 'Trazabilidad', 'Autorización'].map((label) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] bg-white p-8 text-slate-900 shadow-2xl sm:p-10">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">Acceso restringido</p>
              <h2 className="mt-2 text-3xl font-semibold">Seguridad / PTS</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Este acceso muestra únicamente los módulos habilitados para tu empresa y rol.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block text-sm font-medium text-slate-700">
                Correo electrónico
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#18B7A8] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#11998E] disabled:opacity-60"
              >
                {loading ? 'Validando acceso...' : 'Ingresar a Permisos de Trabajo'}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-5 text-center">
              <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Volver al acceso general de Tralixia
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
