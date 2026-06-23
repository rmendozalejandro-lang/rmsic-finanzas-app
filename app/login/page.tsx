'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

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

function TralixiaSymbol({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="tralixiaGradientMainLogin"
          x1="8"
          y1="8"
          x2="56"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#18B7A8" />
          <stop offset="1" stopColor="#4DA8FF" />
        </linearGradient>
        <linearGradient
          id="tralixiaGradientDepthLogin"
          x1="14"
          y1="50"
          x2="50"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#103B66" />
          <stop offset="1" stopColor="#18B7A8" />
        </linearGradient>
      </defs>

      <rect
        x="7"
        y="7"
        width="50"
        height="50"
        rx="16"
        fill="url(#tralixiaGradientDepthLogin)"
      />
      <rect
        x="16"
        y="16"
        width="32"
        height="8"
        rx="4"
        fill="white"
        fillOpacity="0.94"
      />
      <rect
        x="28"
        y="20"
        width="8"
        height="28"
        rx="4"
        fill="url(#tralixiaGradientMainLogin)"
      />
      <circle cx="20" cy="20" r="4" fill="#18B7A8" />
      <circle cx="44" cy="20" r="4" fill="#4DA8FF" />
      <circle cx="32" cy="48" r="4" fill="white" fillOpacity="0.92" />
      <path
        d="M20 20H44M32 24V48"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

async function resolvePostLoginRoute() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error(`No se pudo validar la sesión: ${sessionError.message}`)
  }

  if (!session) {
    return '/login'
  }

  const accessToken = session.access_token
  const userId = session.user.id

  const apiKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  if (!apiKey || !baseUrl) {
    return '/'
  }

  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken}`,
  }

  const usuarioEmpresasResp = await fetch(
    `${baseUrl}/rest/v1/usuario_empresas?select=empresa_id,rol,activo&usuario_id=eq.${userId}&activo=eq.true`,
    { headers }
  )

  const usuarioEmpresasJson = (await usuarioEmpresasResp.json()) as
    | UsuarioEmpresaRow[]
    | { message?: string }

  if (!usuarioEmpresasResp.ok || !Array.isArray(usuarioEmpresasJson)) {
    return '/'
  }

  const accesos = usuarioEmpresasJson.filter((item) => item.activo)

  if (accesos.length === 0) {
    return '/'
  }

  const empresaGuardada =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_ID_KEY) || ''
      : ''

  const accesoActivo =
    accesos.find((item) => item.empresa_id === empresaGuardada) || accesos[0]

  const empresaResp = await fetch(
    `${baseUrl}/rest/v1/empresas?select=id,nombre&id=eq.${accesoActivo.empresa_id}`,
    { headers }
  )

  const empresaJson = (await empresaResp.json()) as
    | EmpresaRow[]
    | { message?: string }

  if (empresaResp.ok && Array.isArray(empresaJson) && empresaJson.length > 0) {
    const empresa = empresaJson[0]

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_ID_KEY, empresa.id)
      window.localStorage.setItem(STORAGE_NAME_KEY, empresa.nombre)
      window.dispatchEvent(new Event('empresa-activa-cambiada'))
    }
  }

  if (accesoActivo.rol === 'tecnico_ot') {
    return '/ot'
  }

  return '/'
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
          const targetRoute = await resolvePostLoginRoute()
          router.replace(targetRoute)
          return
        }
      } catch (_error) {
        // no-op
      } finally {
        setCheckingSession(false)
      }
    }

    void checkSession()
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
          window.sessionStorage.setItem('tralixia-session-temp', 'true')
        } catch {
          // no-op
        }
      }

      const targetRoute = await resolvePostLoginRoute()
      router.replace(targetRoute)
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
      <main className="min-h-screen bg-[#061524] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
              <TralixiaSymbol className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Tralixia</h1>
            <p className="mt-2 text-sm text-slate-300">Cargando acceso seguro...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#061524] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(24,183,168,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(77,168,255,0.18),_transparent_28%),linear-gradient(135deg,_#061524_0%,_#103B66_45%,_#061524_100%)]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-[-10%] top-[8%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-[10%] right-[-8%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <section className="hidden lg:block">
            <div className="max-w-2xl">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 shadow-xl ring-1 ring-white/10 backdrop-blur">
                  <TralixiaSymbol className="h-14 w-14" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/90">
                    Plataforma modular
                  </p>
                  <h1 className="mt-1 text-6xl font-semibold tracking-tight text-white">
                    Tralixia
                  </h1>
                </div>
              </div>

              <p className="max-w-xl text-lg leading-8 text-slate-300">
                Plataforma modular de gestión empresarial para conectar operación,
                finanzas, bancos, contabilidad y trazabilidad en una sola plataforma.
              </p>

              <p className="mt-4 text-sm font-medium text-cyan-200/90">
                Desarrollado por RM Servicios de Ingeniería y Construcción
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
                    Acceso corporativo Tralixia
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#103B66]/80 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Finanzas
                    </p>
                    <p className="mt-3 text-sm text-slate-200">
                      Ingresos, egresos, bancos, transferencias y reportes.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#103B66]/80 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Comercial
                    </p>
                    <p className="mt-3 text-sm text-slate-200">
                      Cotizaciones, clientes y seguimiento comercial.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#103B66]/80 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Maestros
                    </p>
                    <p className="mt-3 text-sm text-slate-200">
                      Clientes, proveedores, contactos y datos compartidos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[28px] border border-white/10 bg-white/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#103B66] shadow-lg">
                  <TralixiaSymbol className="h-12 w-12" />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Iniciar sesión
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Accede a tu entorno empresarial en Tralixia.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@empresa.cl"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Contraseña
                    </label>
                    <Link
                      href="#"
                      className="text-xs font-medium text-[#18B7A8] hover:text-[#11998E]"
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
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#18B7A8] focus:ring-[#18B7A8]"
                    />
                    Recordarme
                  </label>

                  <span className="text-xs text-slate-400">Acceso seguro</span>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#18B7A8] px-4 py-3.5 text-sm font-medium text-white transition hover:bg-[#11998E] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Ingresando...' : 'Ingresar a Tralixia'}
                </button>

                <div className="text-center text-sm text-slate-500">
                  ¿No tienes cuenta?{' '}
                  <Link href="/registro" className="font-semibold text-[#18B7A8] hover:underline">
                    Crear cuenta
                  </Link>
                </div>
              </form>

              <div className="mt-8 border-t border-slate-200 pt-6 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Tralixia
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Plataforma modular de gestión empresarial
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}