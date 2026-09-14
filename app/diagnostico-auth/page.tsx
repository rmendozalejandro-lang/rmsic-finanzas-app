'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

function describirError(error: unknown) {
  if (!error) return 'Sin detalle de error'

  const value = error as {
    name?: unknown
    message?: unknown
    status?: unknown
    code?: unknown
    cause?: unknown
  }

  const detail = {
    name: typeof value.name === 'string' ? value.name : null,
    message:
      typeof value.message === 'string'
        ? value.message
        : value.message != null
          ? JSON.stringify(value.message)
          : null,
    status: value.status ?? null,
    code: value.code ?? null,
    cause:
      value.cause instanceof Error
        ? { name: value.cause.name, message: value.cause.message }
        : value.cause ?? null,
    stringValue: String(error),
  }

  return JSON.stringify(detail, null, 2)
}

export default function DiagnosticoAuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resultado, setResultado] = useState('')
  const [loading, setLoading] = useState(false)

  const probar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResultado('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setResultado(`ERROR SUPABASE:\n${describirError(error)}`)
        return
      }

      setResultado(
        data.session
          ? 'OK: Supabase autenticó correctamente y creó una sesión.'
          : 'RESPUESTA SIN ERROR, PERO SIN SESIÓN.'
      )
    } catch (error) {
      setResultado(`EXCEPCIÓN:\n${describirError(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Diagnóstico temporal de Supabase Auth</h1>
        <p className="mt-2 text-sm text-slate-400">
          Disponible solo en la rama de hotfix para identificar el error real de inicio de sesión.
        </p>

        <form onSubmit={probar} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-medium disabled:opacity-60"
          >
            {loading ? 'Probando...' : 'Probar autenticación'}
          </button>
        </form>

        {resultado ? (
          <div className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm">
            {resultado}
          </div>
        ) : null}
      </div>
    </main>
  )
}
