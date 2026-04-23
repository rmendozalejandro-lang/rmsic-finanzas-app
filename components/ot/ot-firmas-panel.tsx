'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type FirmaTipo = 'tecnico' | 'cliente' | 'supervisor'

type OTFirma = {
  id: string
  ot_id: string
  tipo_firma: FirmaTipo
  nombre_firmante: string | null
  cargo_firmante: string | null
  firma_url: string
  fecha_firma: string
  created_at: string
}

type Props = {
  otId: string
  empresaId: string
  currentUserId?: string
}

type SignaturePadProps = {
  title: string
  tipoFirma: FirmaTipo
  otId: string
  empresaId: string
  currentUserId?: string
  existingFirma?: OTFirma | null
  onSaved: () => Promise<void> | void
}

const BUCKET_NAME = 'ot-evidencias'

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function dataUrlToBlob(dataUrl: string) {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
  const binary = atob(parts[1])
  const len = binary.length
  const bytes = new Uint8Array(len)

  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: mime })
}

function SignaturePad({
  title,
  tipoFirma,
  otId,
  empresaId,
  currentUserId,
  existingFirma,
  onSaved,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const drawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  const [nombreFirmante, setNombreFirmante] = useState(existingFirma?.nombre_firmante || '')
  const [cargoFirmante, setCargoFirmante] = useState(existingFirma?.cargo_firmante || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setNombreFirmante(existingFirma?.nombre_firmante || '')
    setCargoFirmante(existingFirma?.cargo_firmante || '')
  }, [existingFirma])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const width = wrapper.clientWidth
    const height = 220

    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#0f172a'

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }, [])

  useEffect(() => {
    resizeCanvas()

    const onResize = () => resizeCanvas()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [resizeCanvas])

  const getPoint = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      if (!touch) return null

      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const point = getPoint(e)

    if (!ctx || !point) return

    drawingRef.current = true
    hasDrawnRef.current = true

    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault()
    if (!drawingRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const point = getPoint(e)

    if (!ctx || !point) return

    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const stopDrawing = (
    e?:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (e) e.preventDefault()
    drawingRef.current = false
  }

  const clearCanvas = () => {
    setError('')
    setSuccess('')
    hasDrawnRef.current = false
    resizeCanvas()
  }

  const saveSignature = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const canvas = canvasRef.current
      if (!canvas) {
        throw new Error('No se encontró el canvas de firma.')
      }

      if (!hasDrawnRef.current) {
        throw new Error('Debes dibujar la firma antes de guardar.')
      }

      if (!nombreFirmante.trim()) {
        throw new Error('Debes ingresar el nombre del firmante.')
      }

      const dataUrl = canvas.toDataURL('image/png')
      const blob = dataUrlToBlob(dataUrl)

      const safeName = sanitizeFileName(`${tipoFirma}-${nombreFirmante.trim()}.png`)
      const filePath = `${empresaId}/${otId}/firmas/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`No se pudo subir la firma: ${uploadError.message}`)
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)

      if (existingFirma?.id) {
        const { error: updateError } = await supabase
          .from('ot_firmas')
          .update({
            nombre_firmante: nombreFirmante.trim(),
            cargo_firmante: cargoFirmante.trim() || null,
            firma_url: publicUrl,
            fecha_firma: new Date().toISOString(),
          })
          .eq('id', existingFirma.id)

        if (updateError) {
          throw new Error(`No se pudo actualizar la firma: ${updateError.message}`)
        }
      } else {
        const { error: insertError } = await supabase
          .from('ot_firmas')
          .insert({
            ot_id: otId,
            tipo_firma: tipoFirma,
            nombre_firmante: nombreFirmante.trim(),
            cargo_firmante: cargoFirmante.trim() || null,
            firma_url: publicUrl,
            fecha_firma: new Date().toISOString(),
          })

        if (insertError) {
          throw new Error(`No se pudo guardar la firma: ${insertError.message}`)
        }
      }

      setSuccess('Firma guardada correctamente.')
      await onSaved()
      clearCanvas()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la firma.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {existingFirma ? (
            <p className="mt-1 text-sm text-slate-500">
              Firma registrada el {formatDateTime(existingFirma.fecha_firma)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Aún no hay firma registrada.
            </p>
          )}
        </div>

        {existingFirma?.firma_url ? (
          <a
            href={existingFirma.firma_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Ver firma actual
          </a>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Nombre firmante
          </label>
          <input
            type="text"
            value={nombreFirmante}
            onChange={(e) => setNombreFirmante(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Cargo
          </label>
          <input
            type="text"
            value={cargoFirmante}
            onChange={(e) => setCargoFirmante(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Firma
        </label>

        <div
          ref={wrapperRef}
          className="overflow-hidden rounded-2xl border border-slate-300 bg-white"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="block w-full touch-none"
          />
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Firma con mouse o dedo. En iPad funciona táctil.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={saveSignature}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? 'Guardando firma...' : 'Guardar firma'}
        </button>

        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Limpiar firma
        </button>
      </div>
    </div>
  )
}

export function OTFirmasPanel({
  otId,
  empresaId,
  currentUserId,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [firmas, setFirmas] = useState<OTFirma[]>([])

  const loadFirmas = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('ot_firmas')
        .select(
          `
            id,
            ot_id,
            tipo_firma,
            nombre_firmante,
            cargo_firmante,
            firma_url,
            fecha_firma,
            created_at
          `
        )
        .eq('ot_id', otId)
        .order('fecha_firma', { ascending: false })

      if (error) {
        throw new Error(`No se pudieron cargar las firmas: ${error.message}`)
      }

      setFirmas((data ?? []) as OTFirma[])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron cargar las firmas.'
      )
    } finally {
      setLoading(false)
    }
  }, [otId])

  useEffect(() => {
    void loadFirmas()
  }, [loadFirmas])

  const firmaTecnico = useMemo(
    () => firmas.find((item) => item.tipo_firma === 'tecnico') ?? null,
    [firmas]
  )

  const firmaCliente = useMemo(
    () => firmas.find((item) => item.tipo_firma === 'cliente') ?? null,
    [firmas]
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Firmas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Guarda firma de técnico y cliente para respaldo de la OT.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Cargando firmas...
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SignaturePad
          title="Firma técnico"
          tipoFirma="tecnico"
          otId={otId}
          empresaId={empresaId}
          currentUserId={currentUserId}
          existingFirma={firmaTecnico}
          onSaved={loadFirmas}
        />

        <SignaturePad
          title="Firma cliente"
          tipoFirma="cliente"
          otId={otId}
          empresaId={empresaId}
          currentUserId={currentUserId}
          existingFirma={firmaCliente}
          onSaved={loadFirmas}
        />
      </div>
    </div>
  )
}