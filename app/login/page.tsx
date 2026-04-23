'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

function AurenSymbol({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="aurenGradientMainLogin" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="aurenGradientAccentLogin" x1="18" y1="34" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>

      <path
        d="M9 54L25.5 11.5C26.5 9 30 9 31.1 11.4L46.8 45.8C47.6 47.5 46.3 49.5 44.4 49.5H36.8C35.4 49.5 34.2 48.7 33.6 47.5L28.5 36.1L20.2 54H9Z"
        fill="url(#aurenGradientMainLogin)"
      />
      <path
        d="M28.6 36.1L46.8 45.7L38.8 54.1C37.6 55.3 35.8 55.6 34.3 54.9L20.2 48.2L28.6 36.1Z"
        fill="url(#aurenGradientAccentLogin)"
      />
      <path
        d="M31.6 17.6L39.7 35.2H31.4L27 25.5L31.6 17.6Z"
        fill="#0F172A"
        fillOpacity="0.2"
      />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
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

    checkSession()
  }, [router])

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Debes ingresar tu correo electrónico.')
      return
    }

    if (!password.trim()) {
      setError('Debes ingresar tu contraseña.')
      return
    }

    try {
      setLoading(true)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError('No fue posible iniciar sesión. Revisa tu correo y contraseña.')
        return
      }

      if (!rememberMe) {
        try {
          window.sessionStorage.setItem('auren-session-temp', 'true')
        } catch {
          // no-op
        }
      }

      router.replace('/')
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocurrió un error inesperado al iniciar sesión.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#081120] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
              <AurenSymbol className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Auren</h1>
            <p className="mt-2 text-sm text-slate-300">Cargando acceso seguro...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#081120] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#081120_0%,_#0B1630_45%,_#0A1120_100%)]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-[-10%] top-[8%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-[10%] right-[-8%] h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <section className="hidden lg:block">
            <div className="max-w-2xl">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 shadow-xl ring-1 ring-white/10 backdrop-blur">
                  <AurenSymbol className="h-14 w-14" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/90">
                    Plataforma empresarial
                  </p>
                  <h1 className="mt-1 text-6xl font-semibold tracking-tight text-white">
                    Auren
                  </h1>
                </div>
              </div>

              <p className="max-w-xl text-lg leading-8 text-slate-300">
                Plataforma empresarial modular para la gestión financiera,
                administrativa y operativa de empresas multiárea y multiempresa.
              </p>

              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-medium text-cyan-300">Confianza</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Seguridad y respaldo para operar con trazabilidad.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-medium text-cyan-300">Evolución</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Una identidad tecnológica diseñada para crecer por módulos.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-medium text-cyan-300">Control</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Información clara para una gestión empresarial más precisa.
                  </p>
                </div>
              </div>

              <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                  <p className="text-sm font-medium text-slate-200">
                    Acceso corporativo Auren
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#0D1B36]/80 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Finanzas
                    </p>
                    <p className="mt-3 text-sm text-slate-200">
                      Ingresos, egresos, bancos, transferencias y reportes.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#0D1B36]/80 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Comercial
                    </p>
                    <p className="mt-3 text-sm text-slate-200">
                      Cotizaciones, clientes y seguimiento comercial.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#0D1B36]/80 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Gestión
                    </p>
                    <p className="mt-3 text-sm text-slate-200">
                      Roles, control interno y operación multiempresa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[28px] border border-white/10 bg-white/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0D1B36] shadow-lg">
                  <AurenSymbol className="h-12 w-12" />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Iniciar sesión
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Accede a tu entorno empresarial en Auren.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@empresa.cl"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#155CFF] focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                      Contraseña
                    </label>
                    <Link
                      href="#"
                      className="text-xs font-medium text-[#155CFF] hover:text-[#0F4AE6]"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#155CFF] focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#155CFF] focus:ring-[#155CFF]"
                    />
                    Recordarme
                  </label>

                  <span className="text-xs text-slate-400">
                    Acceso seguro
                  </span>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#155CFF] px-4 py-3.5 text-sm font-medium text-white transition hover:bg-[#0F4AE6] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Ingresando...' : 'Ingresar a Auren'}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-200 pt-6 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Auren
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Plataforma empresarial modular
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}