'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

function filenameFromDisposition(value: string | null) {
  if (!value) return ''
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (utf8) {
    try {
      return decodeURIComponent(utf8)
    } catch {
      return utf8
    }
  }

  return value.match(/filename="([^"]+)"/i)?.[1] || ''
}

export default function PTSPdfButton({ permisoId }: { permisoId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const descargarPdf = async () => {
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
      const filename = filenameFromDisposition(response.headers.get('content-disposition')) || 'PTS.pdf'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF del PTS.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={descargarPdf} disabled={loading} className="rounded-xl border border-[#18B7A8] bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-[#11998E] hover:bg-[#11998E] disabled:opacity-60">
        {loading ? 'Generando PDF...' : 'Descargar PDF oficial'}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
