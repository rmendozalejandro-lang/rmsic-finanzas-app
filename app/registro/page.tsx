'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function RegistroPage() {
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [registroCompletado, setRegistroCompletado] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const validar = () => {
    if (!nombreCompleto.trim()) return 'Debes ingresar tu nombre completo.'
    if (!email.trim()) return 'Debes ingresar tu email.'
    if (!email.includes('@')) return 'Debes ingresar un email válido.'
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    if (password !== passwordConfirm) return 'Las contraseñas no coinciden.'
    return ''
  }

  const handleRegistro = async () => {
    const validationError = validar()

    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const emailNormalizado = email.trim().toLowerCase()
      const nombre = nombreCompleto.trim()

      const redirectTo = `${window.location.origin}/login`

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailNormalizado,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: nombre,
            name: nombre,
            nombre_completo: nombre,
          },
        },
      })

      if (signUpError) throw new Error(signUpError.message)

      /*
       * Si Supabase tiene confirmación de correo desactivada,
       * puede devolver sesión inmediatamente.
       * En ese caso aceptamos invitaciones de todas formas,
       * pero no redirigimos automáticamente para evitar confusión.
       */
      if (signUpData.session?.user) {
        const { error: invitacionError } = await supabase.rpc(
          'aceptar_mis_invitaciones_empresa'
        )

        if (invitacionError) {
          console.warn(
            'Cuenta creada, pero no se pudieron aceptar invitaciones:',
            invitacionError.message
          )
        }

        window.localStorage.removeItem('empresa_activa_id')
        window.localStorage.removeItem('empresa_activa_nombre')

        setRegistroCompletado(true)
        setSuccess(
          'Cuenta creada correctamente. Ya puedes iniciar sesión desde el enlace inferior. Si recibes un correo de confirmación, confirma tu email antes de ingresar.'
        )

        return
      }

      /*
       * Si Supabase exige confirmación de correo,
       * el usuario debe confirmar primero y luego iniciar sesión.
       * No redirigimos automáticamente.
       */
      setRegistroCompletado(true)
      setSuccess(
        'Cuenta creada correctamente. Ahora revisa tu correo y confirma tu email mediante el mensaje enviado por Supabase. Después de confirmar, vuelve a iniciar sesión con este mismo correo y contraseña.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">Auren</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Regístrate usando exactamente el mismo email con el que fuiste invitado.
            La plataforma asociará automáticamente tu empresa y rol cuando confirmes
            tu correo e inicies sesión.
          </p>
        </div>

        {(error || success) && (
          <div
            className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nombre completo
            </label>
            <input
              value={nombreCompleto}
              onChange={(event) => setNombreCompleto(event.target.value)}
              placeholder="Nombre y apellido"
              disabled={loading || registroCompletado}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#245C90] disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.cl"
              type="email"
              disabled={loading || registroCompletado}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#245C90] disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              type="password"
              disabled={loading || registroCompletado}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#245C90] disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Confirmar contraseña
            </label>
            <input
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="Repite la contraseña"
              type="password"
              disabled={loading || registroCompletado}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#245C90] disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <button
            type="button"
            onClick={handleRegistro}
            disabled={loading || registroCompletado}
            className="w-full rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? 'Creando cuenta...'
              : registroCompletado
                ? 'Cuenta creada'
                : 'Crear cuenta'}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          ¿Ya confirmaste tu correo o ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-[#163A5F] hover:underline">
            Iniciar sesión
          </Link>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          Debes usar exactamente el mismo email de la invitación. Después de crear
          la cuenta recibirás un segundo correo de confirmación enviado por Supabase.
          Debes confirmar ese correo antes de iniciar sesión.
        </div>
      </section>
    </main>
  )
}