'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedModuleRoute from '../../../../../components/ProtectedModuleRoute'
import { supabase } from '../../../../../lib/supabase/client'

function OTPdfRealPageContent() {
  const params = useParams()

  const otId = useMemo(() => {
    const raw = params?.id
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return raw[0] ?? ''
    return ''
  }, [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [blobUrl, setBlobUrl] = useState('')
  const [fileName, setFileName] = useState('ot.pdf')

  const blobUrlRef = useRef('')

  useEffect(() => {
    let active = true

    const loadPdf = async () => {
      try {
        setLoading(true)
        setError('')

        if (!otId) {
          throw new Error('No se recibió el identificador de la OT.')
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw new Error(`No se pudo validar la sesión: ${sessionError.message}`)
        }

        if (!session?.access_token) {
          throw new Error('No hay sesión activa para generar el PDF.')
        }

        const response = await fetch(`/api/ot-pdf/${otId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'No se pudo generar el PDF real.')
        }

        const blob = await response.blob()

        if (!active) return

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
        }

        const nextBlobUrl = URL.createObjectURL(blob)
        blobUrlRef.current = nextBlobUrl
        setBlobUrl(nextBlobUrl)
        setFileName(`ot-${otId}.pdf`)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'No se pudo generar el PDF real.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadPdf()

    return () => {
      active = false
    }
  }, [otId])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8">
        Generando PDF real...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>

        <Link
          href={`/ot/${otId}`}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a la OT
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              PDF real OT
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Este PDF ya viene generado por el servidor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {blobUrl ? (
              <>
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245C90]"
                >
                  Abrir PDF real
                </a>

                <a
                  href={blobUrl}
                  download={fileName}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Descargar PDF
                </a>
              </>
            ) : null}

            <Link
              href={`/ot/${otId}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Volver a la OT
            </Link>
          </div>
        </div>
      </div>

      {blobUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <iframe
            title="PDF real OT"
            src={blobUrl}
            className="h-[85vh] w-full rounded-xl border border-slate-200"
          />
        </div>
      ) : null}
    </div>
  )
}

export default function OTPdfRealPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <OTPdfRealPageContent />
    </ProtectedModuleRoute>
  )
}