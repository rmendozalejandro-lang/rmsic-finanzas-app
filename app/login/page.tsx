'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()

        if (data.session) {
          router.replace('/')
          return
        }
      } finally {
        setCheckingSession(false)
      }
    }

    void checkSession()
  }, [router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message || 'No fue posible iniciar sesión.')
        return
      }

      router.replace('/')
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al iniciar sesión.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-xl">
          <div className="space-y-2 px-6 text-center">
            <p className="text-sm font-medium text-slate-500">Auren</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Verificando acceso
            </h1>
            <p className="text-sm text-slate-500">
              Estamos preparando su entorno empresarial.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#163A5F] px-8 py-10 text-white sm:px-10 lg:px-12">
          <div className="absolute inset-0 opacity-[0.08]">
            <div className="absolute -left-10 top-10 h-56 w-56 rounded-full border border-white" />
            <div className="absolute bottom-16 right-10 h-72 w-72 rounded-full border border-white" />
            <div className="absolute left-1/3 top-1/3 h-28 w-28 rotate-12 rounded-3xl border border-white" />
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 backdrop-blur-sm">
                <span className="text-lg font-semibold">A</span>
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight">Auren</div>
                <div className="text-sm text-white/75">
                  Plataforma de gestión financiera y administrativa
                </div>
              </div>
            </div>

            <div className="max-w-xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                Acceso corporativo
              </div>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Control, trazabilidad y operación centralizada.
              </h1>

              <p className="max-w-lg text-base leading-7 text-white/80 sm:text-lg">
                Una plataforma multiempresa diseñada para ordenar la gestión financiera y administrativa con una experiencia clara, corporativa y escalable.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-2xl font-semibold">Multi</div>
              <div className="mt-1 text-sm text-white/75">Empresa</div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-2xl font-semibold">Roles</div>
              <div className="mt-1 text-sm text-white/75">Acceso segmentado</div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-2xl font-semibold">24/7</div>
              <div className="mt-1 text-sm text-white/75">Disponibilidad</div>
            </div>
          </div>

          <div className="relative z-10 mt-10 text-sm text-white/70">
            Desarrollado e implementado por RMSIC
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
            <div className="space-y-3 pb-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Acceso corporativo
              </div>

              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Ingrese al sistema
              </h2>

              <p className="text-sm leading-6 text-slate-500">
                Ingrese con sus credenciales para acceder a su entorno empresarial.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="nombre@empresa.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#245C90]"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Contraseña
                  </label>
                </div>

                <input
                  id="password"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#245C90]"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span>Soporte de acceso y administración de cuentas</span>
                <span className="font-medium text-[#163A5F]">Auren</span>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-[#163A5F] px-4 text-base font-medium text-white transition hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Ingresando...' : 'Ingresar al sistema'}
              </button>

              <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span>© Auren · Plataforma corporativa</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}