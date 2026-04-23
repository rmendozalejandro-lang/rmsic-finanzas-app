'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type EvidenciaTipo = 'antes' | 'durante' | 'despues' | 'documento' | 'otro'

type OTEvidencia = {
  id: string
  ot_id: string
  tipo: EvidenciaTipo
  archivo_url: string
  archivo_nombre: string | null
  descripcion: string | null
  orden: number
  subido_por: string | null
  created_at: string
}

type Props = {
  otId: string
  empresaId: string
  currentUserId?: string
}

type UploadFormState = {
  tipo: EvidenciaTipo
  descripcion: string
  file: File | null
}

const BUCKET_NAME = 'ot-evidencias'

const TIPOS_LABEL: Record<EvidenciaTipo, string> = {
  antes: 'Antes',
  durante: 'Durante',
  despues: 'Después',
  documento: 'Documento',
  otro: 'Otro',
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

function isImageFile(url: string, fileName?: string | null) {
  const value = `${url} ${fileName ?? ''}`.toLowerCase()
  return (
    value.includes('.jpg') ||
    value.includes('.jpeg') ||
    value.includes('.png') ||
    value.includes('.webp') ||
    value.includes('.gif') ||
    value.includes('.bmp') ||
    value.includes('.svg')
  )
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

export function OTEvidenciasPanel({
  otId,
  empresaId,
  currentUserId,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [evidencias, setEvidencias] = useState<OTEvidencia[]>([])
  const [form, setForm] = useState<UploadFormState>({
    tipo: 'antes',
    descripcion: '',
    file: null,
  })

  const loadEvidencias = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('ot_evidencias')
        .select(
          `
            id,
            ot_id,
            tipo,
            archivo_url,
            archivo_nombre,
            descripcion,
            orden,
            subido_por,
            created_at
          `
        )
        .eq('ot_id', otId)
        .order('tipo', { ascending: true })
        .order('orden', { ascending: true })

      if (error) {
        throw new Error(`No se pudieron cargar las evidencias: ${error.message}`)
      }

      setEvidencias((data ?? []) as OTEvidencia[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las evidencias.'
      )
    } finally {
      setLoading(false)
    }
  }, [otId])

  useEffect(() => {
    void loadEvidencias()
  }, [loadEvidencias])

  const grouped = useMemo(() => {
    return {
      antes: evidencias.filter((item) => item.tipo === 'antes'),
      durante: evidencias.filter((item) => item.tipo === 'durante'),
      despues: evidencias.filter((item) => item.tipo === 'despues'),
      documento: evidencias.filter((item) => item.tipo === 'documento'),
      otro: evidencias.filter((item) => item.tipo === 'otro'),
    }
  }, [evidencias])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.file) {
      setError('Debes seleccionar un archivo para subir.')
      return
    }

    try {
      setUploading(true)
      setError('')
      setSuccess('')

      const safeName = sanitizeFileName(form.file.name)
      const filePath = `${empresaId}/${otId}/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, form.file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`No se pudo subir el archivo: ${uploadError.message}`)
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)

      const nextOrder =
        Math.max(
          0,
          ...evidencias
            .filter((item) => item.tipo === form.tipo)
            .map((item) => item.orden ?? 0)
        ) + 1

      const { error: insertError } = await supabase.from('ot_evidencias').insert({
        ot_id: otId,
        tipo: form.tipo,
        archivo_url: publicUrl,
        archivo_nombre: form.file.name,
        descripcion: form.descripcion.trim() || null,
        orden: nextOrder,
        subido_por: currentUserId || null,
      })

      if (insertError) {
        throw new Error(`No se pudo guardar la evidencia: ${insertError.message}`)
      }

      setForm({
        tipo: form.tipo,
        descripcion: '',
        file: null,
      })

      const input = document.getElementById(
        'ot-evidencia-file-input'
      ) as HTMLInputElement | null
      if (input) {
        input.value = ''
      }

      await loadEvidencias()
      setSuccess('Evidencia subida correctamente.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo subir la evidencia.'
      )
    } finally {
      setUploading(false)
    }
  }

  const renderSection = (title: string, items: OTEvidencia[]) => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Sin evidencias en esta categoría.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
              >
                {isImageFile(item.archivo_url, item.archivo_nombre) ? (
                  <a
                    href={item.archivo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={item.archivo_url}
                      alt={item.archivo_nombre ?? 'Evidencia'}
                      className="h-52 w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-52 items-center justify-center bg-slate-100 p-4 text-center text-sm text-slate-600">
                    Documento adjunto
                  </div>
                )}

                <div className="space-y-2 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    {item.archivo_nombre ?? 'Archivo'}
                  </p>

                  <p className="text-xs text-slate-500">
                    {formatDateTime(item.created_at)}
                  </p>

                  <p className="text-sm text-slate-700">
                    {item.descripcion?.trim() ? item.descripcion : 'Sin descripción'}
                  </p>

                  <a
                    href={item.archivo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Abrir archivo
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Evidencias y fotos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sube imágenes o documentos asociados a esta OT.
          </p>
        </div>

        <form onSubmit={handleUpload} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tipo de evidencia
              </label>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tipo: e.target.value as EvidenciaTipo,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="antes">Antes</option>
                <option value="durante">Durante</option>
                <option value="despues">Después</option>
                <option value="documento">Documento</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="md:col-span-1 xl:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Archivo
              </label>
              <input
                id="ot-evidencia-file-input"
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] ?? null,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  descripcion: e.target.value,
                }))
              }
              rows={3}
              placeholder="Ejemplo: foto antes de intervenir tablero, evidencia de daño encontrado, informe adjunto, etc."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading ? 'Subiendo evidencia...' : 'Subir evidencia'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando evidencias...
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection(TIPOS_LABEL.antes, grouped.antes)}
          {renderSection(TIPOS_LABEL.durante, grouped.durante)}
          {renderSection(TIPOS_LABEL.despues, grouped.despues)}
          {renderSection(TIPOS_LABEL.documento, grouped.documento)}
          {renderSection(TIPOS_LABEL.otro, grouped.otro)}
        </div>
      )}
    </div>
  )
}