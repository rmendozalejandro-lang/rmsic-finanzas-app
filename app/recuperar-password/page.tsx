'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

const SAFE_RESET_MESSAGE =
  'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.'

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
        <linearGradient id="tralixiaGradientMainRecovery" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18B7A8" />
          <stop offset="1" stopColor="#4DA8FF" />
        </linearGradient>
        <linearGradient id="tralixiaGradientDepthRecovery" x1="14" y1="50" x2="50" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#103B66" />
          <stop offset="1" stopColor="#18B7A8" />
        </linearGradient>
      </defs>
      <rect x="7" y="7" width="50" height="50" rx="16" fill="url(#tralixiaGradientDepthRecovery)" />
      <rect x="16" y="16" width="32" height="8" rx="4" fill="white" fillOpacity="0.94" />
      <rect x="28" y="20" width="8" height="28" rx="4" fill="url(#tralixiaGradientMainRecovery)" />
      <circle cx="20" cy="20" r="4" fill="#18B7A8" />
      <circle cx="44" cy="20" r="4" fill="#4DA8FF" />
      <circle cx="32" cy="48" r="4" fill="white" fillOpacity="0.92" />
      <path d="M20 20H44M32 24V48" stroke="white" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setError('Debes ingresar tu correo electrónico.')
      return
    }

    try {
      setLoading(true)

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/actualizar-password`,
      })

      if (resetError) {
        setError('No fue posible enviar el enlace de recuperación. Intenta nuevamente.')
        return
      }

      setSuccess(SAFE_RESET_MESSAGE)
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Recuperar contraseña</h1>
            <p className="mt-2 text-sm text-slate-500">Ingresa tu correo y te enviaremos instrucciones seguras.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@empresa.cl"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[#18B7A8] px-4 py-3.5 text-sm font-medium text-white transition hover:bg-[#11998E] disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="font-semibold text-[#18B7A8] hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
