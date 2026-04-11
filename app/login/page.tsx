'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-3xl font-semibold text-slate-900">
          Iniciar sesión
        </h1>
       <p className="text-slate-600 mt-2">
  Acceso a la plataforma financiera y contable.
</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-2">
              Correo
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@empresa.cl"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 text-white py-3 font-medium disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  )
}