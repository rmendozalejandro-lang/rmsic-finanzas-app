'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function PTSPdfButton({ permisoId }: { permisoId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const abrirPdf = async () => {
    try {
      setLoading(true)
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Tu sesión no está disponible. Vuelve a ingresar.')

      const response = await fetch(`/api/pts-pdf/${permisoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'No se pudo generar el PDF del PTS.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF del PTS.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={abrirPdf} disabled={loading} className="rounded-xl border border-[#18B7A8] bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-[#11998E] hover:bg-[#11998E] disabled:opacity-60">
        {loading ? 'Generando PDF...' : 'PDF oficial'}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
