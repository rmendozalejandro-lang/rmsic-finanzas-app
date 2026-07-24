'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

const INVALID_LINK_MESSAGE = 'El enlace de recuperación expiró o no es válido. Solicita uno nuevo.'

function hasRecoveryMarker() {
  if (typeof window === 'undefined') {
    return false
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery'
}

function TralixiaSymbol({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tralixiaGradientMainUpdate" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18B7A8" />
          <stop offset="1" stopColor="#4DA8FF" />
        </linearGradient>
        <linearGradient id="tralixiaGradientDepthUpdate" x1="14" y1="50" x2="50" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#103B66" />
          <stop offset="1" stopColor="#18B7A8" />
        </linearGradient>
      </defs>
      <rect x="7" y="7" width="50" height="50" rx="16" fill="url(#tralixiaGradientDepthUpdate)" />
      <rect x="16" y="16" width="32" height="8" rx="4" fill="white" fillOpacity="0.94" />
      <rect x="28" y="20" width="8" height="28" rx="4" fill="url(#tralixiaGradientMainUpdate)" />
      <circle cx="20" cy="20" r="4" fill="#18B7A8" />
      <circle cx="44" cy="20" r="4" fill="#4DA8FF" />
      <circle cx="32" cy="48" r="4" fill="white" fillOpacity="0.92" />
      <path d="M20 20H44M32 24V48" stroke="white" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function ActualizarPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [checkingLink, setCheckingLink] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true

    const validateRecoverySession = async () => {
      const { data } = await supabase.auth.getSession()

      if (mounted) {
        setHasValidSession(hasRecoveryMarker() && Boolean(data.session))
        setCheckingLink(false)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && mounted) {
        setHasValidSession(Boolean(session))
        setCheckingLink(false)
      }
    })

    void validateRecoverySession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!hasValidSession) {
      setError(INVALID_LINK_MESSAGE)
      return
    }

    if (!password) {
      setError('Debes ingresar una nueva contraseña.')
      return
    }

    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('La confirmación debe coincidir con la nueva contraseña.')
      return
    }

    try {
      setLoading(true)

      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError('No fue posible actualizar la contraseña. Solicita un nuevo enlace e intenta nuevamente.')
        return
      }

      setSuccess('Contraseña actualizada correctamente. Redirigiendo al inicio de sesión...')
      await supabase.auth.signOut()
      window.setTimeout(() => {
        router.replace('/login')
      }, 1200)
    } catch {
      setError('Ocurrió un error inesperado. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#061524] text-white">
      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(24,183,168,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(77,168,255,0.18),_transparent_28%),linear-gradient(135deg,_#061524_0%,_#103B66_45%,_#061524_100%)]" />
        <section className="relative z-10 w-full max-w-md rounded-[28px] border border-white/10 bg-white/90 p-8 text-slate-900 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#103B66] shadow-lg">
              <TralixiaSymbol className="h-12 w-12" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#18B7A8]">Tralixia</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Crear nueva contraseña</h1>
            <p className="mt-2 text-sm text-slate-500">Define una contraseña segura para recuperar el acceso.</p>
          </div>

          {checkingLink ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Validando enlace de recuperación...</div>
          ) : !hasValidSession ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{INVALID_LINK_MESSAGE}</div>
              <Link href="/recuperar-password" className="block w-full rounded-2xl bg-[#18B7A8] px-4 py-3.5 text-center text-sm font-medium text-white transition hover:bg-[#11998E]">
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Nueva contraseña</label>
                <input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">Confirmar nueva contraseña</label>
                <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu nueva contraseña" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100" />
              </div>

              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[#18B7A8] px-4 py-3.5 text-sm font-medium text-white transition hover:bg-[#11998E] disabled:cursor-not-allowed disabled:opacity-70">
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="font-semibold text-[#18B7A8] hover:underline">Volver a iniciar sesión</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
