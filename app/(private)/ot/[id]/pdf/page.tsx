'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import ProtectedModuleRoute from '../../../../../components/ProtectedModuleRoute'
import { OTPdfDocument } from '../../../../../components/ot/ot-pdf-document'
import { supabase } from '../../../../../lib/supabase/client'
import type { OTResumen } from '../../../../../lib/ot/types'

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  cliente_id: string
  ubicacion_id: string | null
  activo_id: string | null
  cotizacion_id: string | null
  tipo_servicio_id: string
  estado_id: string
  fecha_ot: string
  fecha_programada: string | null
  fecha_cierre: string | null
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
  diagnostico: string | null
  causa_probable: string | null
  trabajo_realizado: string | null
  recomendaciones: string | null
  tecnico_responsable_id: string | null
  supervisor_id: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  requiere_checklist: boolean
  plantilla_checklist_id: string | null
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  cliente_nombre_firma: string | null
  cliente_cargo_firma: string | null
  observaciones_cierre: string | null
  mostrar_firma_cliente: boolean
  mostrar_firma_tecnico: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  contacto_cliente_nombre: string | null
  contacto_cliente_cargo: string | null
  area_trabajo: string | null
  resultado_servicio: string | null
  hallazgos: string | null
  conclusiones_tecnicas: string | null
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: number | null
}

type Evidencia = {
  id: string
  ot_id: string
  tipo: 'antes' | 'durante' | 'despues' | 'documento' | 'otro'
  archivo_url: string
  archivo_nombre: string | null
  descripcion: string | null
  orden: number
  created_at: string
}

type Firma = {
  id: string
  ot_id: string
  tipo_firma: 'tecnico' | 'cliente' | 'supervisor'
  nombre_firmante: string | null
  cargo_firmante: string | null
  firma_url: string
  fecha_firma: string
  created_at: string
}

type PerfilMini = {
  id: string
  email: string | null
}

type TipoServicioOption = {
  id: string
  codigo: string
  nombre: string
}

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
  const [generating, setGenerating] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [blobUrl, setBlobUrl] = useState('')
  const [fileName, setFileName] = useState('ot.pdf')

  const blobUrlRef = useRef('')

  const [resumen, setResumen] = useState<OTResumen | null>(null)
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [evidencias, setEvidencias] = useState<Evidencia[]>([])
  const [firmas, setFirmas] = useState<Firma[]>([])
  const [perfilesMap, setPerfilesMap] = useState<Record<string, string>>({})
  const [tiposServicio, setTiposServicio] = useState<TipoServicioOption[]>([])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        setPdfError('')

        if (!otId) {
          throw new Error('No se recibió el identificador de la OT.')
        }

        const [
          resumenResp,
          detalleResp,
          evidenciasResp,
          firmasResp,
          perfilesResp,
          tiposResp,
        ] = await Promise.all([
          supabase.from('ot_vw_resumen').select('*').eq('id', otId).single(),
          supabase
            .from('ot_ordenes_trabajo')
            .select(
              `
                id,
                folio,
                empresa_id,
                cliente_id,
                ubicacion_id,
                activo_id,
                cotizacion_id,
                tipo_servicio_id,
                estado_id,
                fecha_ot,
                fecha_programada,
                fecha_cierre,
                titulo,
                descripcion_solicitud,
                problema_reportado,
                diagnostico,
                causa_probable,
                trabajo_realizado,
                recomendaciones,
                tecnico_responsable_id,
                supervisor_id,
                prioridad,
                requiere_checklist,
                plantilla_checklist_id,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                cliente_nombre_firma,
                cliente_cargo_firma,
                observaciones_cierre,
                mostrar_firma_cliente,
                mostrar_firma_tecnico,
                created_by,
                created_at,
                updated_at,
                contacto_cliente_nombre,
                contacto_cliente_cargo,
                area_trabajo,
                resultado_servicio,
                hallazgos,
                conclusiones_tecnicas,
                mostrar_nota_valor_hora,
                valor_hora_uf
              `
            )
            .eq('id', otId)
            .single(),
          supabase
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
                created_at
              `
            )
            .eq('ot_id', otId)
            .order('tipo', { ascending: true })
            .order('orden', { ascending: true }),
          supabase
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
            .order('fecha_firma', { ascending: false }),
          supabase.from('perfiles').select('id, email').order('email', { ascending: true }),
          supabase.from('ot_tipos_servicio').select('id, codigo, nombre').eq('activo', true),
        ])

        if (resumenResp.error) {
          throw new Error(`No se pudo cargar el resumen OT: ${resumenResp.error.message}`)
        }
        if (detalleResp.error) {
          throw new Error(`No se pudo cargar el detalle OT: ${detalleResp.error.message}`)
        }
        if (evidenciasResp.error) {
          throw new Error(`No se pudieron cargar las evidencias: ${evidenciasResp.error.message}`)
        }
        if (firmasResp.error) {
          throw new Error(`No se pudieron cargar las firmas: ${firmasResp.error.message}`)
        }
        if (perfilesResp.error) {
          throw new Error(`No se pudieron cargar los perfiles: ${perfilesResp.error.message}`)
        }
        if (tiposResp.error) {
          throw new Error(`No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`)
        }

        if (!active) return

        const perfilesRaw = (perfilesResp.data ?? []) as PerfilMini[]
        const nextMap = perfilesRaw.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = item.email || item.id
          return acc
        }, {})

        const detalleData = detalleResp.data as OTDetalle

        setPerfilesMap(nextMap)
        setResumen(resumenResp.data as OTResumen)
        setDetalle(detalleData)
        setEvidencias((evidenciasResp.data ?? []) as Evidencia[])
        setFirmas((firmasResp.data ?? []) as Firma[])
        setTiposServicio((tiposResp.data ?? []) as TipoServicioOption[])
        setFileName(`${detalleData.folio || 'ot'}-${otId}.pdf`)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar la OT.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [otId])

  const pdfPayload = useMemo(() => {
    if (!resumen || !detalle) return null

    const logoUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/rmsic-logo.png`
        : '/rmsic-logo.png'

    return {
      resumen,
      detalle,
      evidencias,
      firmas,
      perfilesMap,
      tiposServicio,
      logoUrl,
    }
  }, [resumen, detalle, evidencias, firmas, perfilesMap, tiposServicio])

  useEffect(() => {
    let active = true

    const buildPdf = async () => {
      if (!pdfPayload) return

      try {
        setGenerating(true)
        setPdfError('')

        const blob = await pdf(<OTPdfDocument {...pdfPayload} />).toBlob()
        if (!active) return

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
        }

        const nextUrl = URL.createObjectURL(blob)
        blobUrlRef.current = nextUrl
        setBlobUrl(nextUrl)
      } catch (err) {
        if (!active) return
        setPdfError(
          err instanceof Error ? err.message : 'No se pudo generar el PDF real.'
        )
      } finally {
        if (active) {
          setGenerating(false)
        }
      }
    }

    void buildPdf()

    return () => {
      active = false
    }
  }, [pdfPayload])

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
        Cargando datos para PDF real...
      </div>
    )
  }

  if (error || !detalle || !resumen) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || 'No se encontró la OT.'}
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
            <p className="text-sm font-medium text-slate-500">
              {detalle.folio || 'Sin folio'}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              PDF real OT
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Esta vista genera un PDF real A4, sin depender de la impresión del navegador.
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

            <Link
              href={`/ot/${otId}/imprimir`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Vista HTML / imprimir
            </Link>
          </div>
        </div>
      </div>

      {pdfError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {pdfError}
        </div>
      ) : null}

      {generating ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Generando PDF real...
        </div>
      ) : null}

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