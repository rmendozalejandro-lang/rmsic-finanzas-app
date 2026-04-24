'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../../../components/ProtectedModuleRoute'
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

type TiempoTrabajo = {
  id: string
  ot_id: string
  usuario_id: string
  fecha: string
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  tipo_tiempo: 'trabajo' | 'traslado' | 'espera' | 'supervision'
  observacion: string | null
  created_at: string
  updated_at: string
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

function formatDate(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function labelOrDash(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'
  return value
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

function toTitleCase(text: string) {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function humanizePerson(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'

  const raw = value.trim()
  const lower = raw.toLowerCase()

  const knownMap: Record<string, string> = {
    'rmendoza@rmsic.cl': 'Raúl Mendoza',
    'dallendes@rmsic.cl': 'David Allendes',
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raul mendoza': 'Raúl Mendoza',
    'raúl mendoza': 'Raúl Mendoza',
    'raul mendoza c.': 'Raúl Mendoza',
    'raúl mendoza c.': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
    'david allendes a.': 'David Allendes',
    'rmendoza': 'Raúl Mendoza',
    'dallendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raúl') && lower.includes('mendoza'))
  ) {
    return 'Raúl Mendoza'
  }

  if (lower.includes('dallendes') || (lower.includes('david') && lower.includes('allendes'))) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0].toLowerCase().trim()

    if (knownMap[localPart]) return knownMap[localPart]

    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}
function CompactField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  if (value == null || value === '' || value === '-') return null

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  )
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`ot-print-section rounded-2xl border border-slate-200 bg-white p-6 print:rounded-none print:border-slate-300 ${className}`}
    >
      <h2 className="ot-print-section-title text-base font-semibold uppercase tracking-[0.08em] text-slate-900">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function TextBlock({
  title,
  value,
}: {
  title: string
  value: string | null | undefined
}) {
  if (!value || !value.trim()) return null

  return (
    <div className="space-y-2">
      <h3 className="ot-print-section-title text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {value}
      </p>
    </div>
  )
}

function PhotoGroup({
  title,
  items,
}: {
  title: string
  items: Evidencia[]
}) {
  if (items.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="ot-print-section-title text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">
        {title}
      </h3>

      <div className="ot-print-photo-grid grid gap-4 md:grid-cols-2 print:grid-cols-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="ot-print-photo-card overflow-hidden rounded-2xl border border-slate-200"
          >
            <img
              src={item.archivo_url}
              alt={item.archivo_nombre ?? 'Evidencia'}
              className="ot-print-photo-img h-60 w-full object-cover print:h-48"
            />
            <div className="space-y-2 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {item.archivo_nombre ?? 'Registro fotográfico'}
              </p>
              <p className="text-sm leading-6 text-slate-700">
                {item.descripcion?.trim() ? item.descripcion : 'Sin detalle informado.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReceptionCard({
  name,
  role,
  signatureUrl,
}: {
  name: string | null | undefined
  role: string | null | undefined
  signatureUrl?: string | null
}) {
  return (
    <div className="ot-print-avoid rounded-2xl border border-slate-200 p-5">
      <div className="grid gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Nombre
          </p>
          <p className="mt-1 text-sm text-slate-900">{labelOrDash(name)}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Cargo
          </p>
          <p className="mt-1 text-sm text-slate-900">{labelOrDash(role)}</p>
        </div>

        {signatureUrl ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white px-4">
            <img
              src={signatureUrl}
              alt="Firma recepción"
              className="max-h-20 w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-24 items-end rounded-xl border border-dashed border-slate-300 bg-white px-4 pb-3">
            <div className="w-full border-b border-slate-400" />
          </div>
        )}
      </div>
    </div>
  )
}

function PrintOTPageContent() {
  const params = useParams()

  const otId = useMemo(() => {
    const raw = params?.id
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return raw[0] ?? ''
    return ''
  }, [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [resumen, setResumen] = useState<OTResumen | null>(null)
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [tiempos, setTiempos] = useState<TiempoTrabajo[]>([])
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

        if (!otId) {
          throw new Error('No se recibió el identificador de la OT.')
        }

        const [
          resumenResp,
          detalleResp,
          tiemposResp,
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
            .from('ot_tiempos_trabajo')
            .select(
              `
                id,
                ot_id,
                usuario_id,
                fecha,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                tipo_tiempo,
                observacion,
                created_at,
                updated_at
              `
            )
            .eq('ot_id', otId)
            .order('created_at', { ascending: true }),
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
        if (tiemposResp.error) {
          throw new Error(`No se pudieron cargar los tiempos: ${tiemposResp.error.message}`)
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

        setPerfilesMap(nextMap)
        setResumen(resumenResp.data as OTResumen)
        setDetalle(detalleResp.data as OTDetalle)
        setTiempos((tiemposResp.data ?? []) as TiempoTrabajo[])
        setEvidencias((evidenciasResp.data ?? []) as Evidencia[])
        setFirmas((firmasResp.data ?? []) as Firma[])
        setTiposServicio((tiposResp.data ?? []) as TipoServicioOption[])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el informe OT.')
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

  const tipoActual = useMemo(() => {
    if (!detalle) return null
    return tiposServicio.find((item) => item.id === detalle.tipo_servicio_id) ?? null
  }, [detalle, tiposServicio])

  const tipoCodigo = tipoActual?.codigo ?? ''
  const tipoNombre = tipoActual?.nombre ?? resumen?.tipo_servicio_nombre ?? '-'

  const isPreventiva = tipoCodigo === 'preventiva'
  const isUrgencia = tipoCodigo === 'urgencia'
  const isAsistencia = tipoCodigo === 'general'
  const isUrgenciaOAsistencia = isUrgencia || isAsistencia
  const isAsesoria = tipoCodigo === 'asesoria'

  const evidenciasImagenes = useMemo(() => {
    return evidencias.filter((item) => isImageFile(item.archivo_url, item.archivo_nombre))
  }, [evidencias])

  const fotosAntes = useMemo(
    () => evidenciasImagenes.filter((item) => item.tipo === 'antes'),
    [evidenciasImagenes]
  )

  const fotosDurante = useMemo(
    () => evidenciasImagenes.filter((item) => item.tipo === 'durante'),
    [evidenciasImagenes]
  )

  const fotosDespues = useMemo(
    () => evidenciasImagenes.filter((item) => item.tipo === 'despues'),
    [evidenciasImagenes]
  )

  const otrasFotos = useMemo(
    () =>
      evidenciasImagenes.filter(
        (item) => item.tipo !== 'antes' && item.tipo !== 'durante' && item.tipo !== 'despues'
      ),
    [evidenciasImagenes]
  )

  const firmaCliente = useMemo(
    () => firmas.find((item) => item.tipo_firma === 'cliente') ?? null,
    [firmas]
  )

  const horaLlegada = useMemo(() => {
    const validos = tiempos.map((item) => item.hora_inicio).filter(Boolean) as string[]
    if (validos.length === 0) return detalle?.hora_inicio ?? null
    return validos.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
  }, [tiempos, detalle])

  const horaSalida = useMemo(() => {
    const validos = tiempos.map((item) => item.hora_termino).filter(Boolean) as string[]
    if (validos.length === 0) return detalle?.hora_termino ?? null
    return validos.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[validos.length - 1]
  }, [tiempos, detalle])

  const nombreTecnico = useMemo(() => {
    const raw =
      (detalle?.tecnico_responsable_id
        ? perfilesMap[detalle.tecnico_responsable_id] || detalle.tecnico_responsable_id
        : null) ||
      resumen?.tecnico_nombre ||
      '-'

    return humanizePerson(raw)
  }, [detalle, perfilesMap, resumen])

  const nombreRecepcion = useMemo(() => {
    return humanizePerson(
      firmaCliente?.nombre_firmante ||
        detalle?.cliente_nombre_firma ||
        detalle?.contacto_cliente_nombre ||
        '-'
    )
  }, [firmaCliente, detalle])

  const cargoRecepcion = useMemo(() => {
    return (
      firmaCliente?.cargo_firmante ||
      detalle?.cliente_cargo_firma ||
      detalle?.contacto_cliente_cargo ||
      '-'
    )
  }, [firmaCliente, detalle])

  const areaTrabajo = useMemo(() => {
    return (
      detalle?.area_trabajo ||
      resumen?.ubicacion_nombre ||
      resumen?.activo_nombre ||
      '-'
    )
  }, [detalle, resumen])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8">
        Cargando informe OT...
      </div>
    )
  }

  if (error || !detalle || !resumen) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || 'No se encontró la OT.'}
        </div>

        <Link
          href="/ot"
          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a OT
        </Link>
      </div>
    )
  }

  return (
    <div className="ot-print-root mx-auto max-w-5xl space-y-5 bg-slate-50 print:max-w-none print:bg-white print:space-y-4">
      <style jsx global>{`
        @media print {
          html,
          body {
            width: 100% !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            size: A4;
            margin: 10mm;
          }

          .ot-print-root {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
          }

          .ot-print-root .ot-print-hide {
            display: none !important;
          }

          .ot-print-root .ot-print-header {
            display: grid !important;
            grid-template-columns: 1.3fr 0.7fr !important;
            gap: 16px !important;
            align-items: start !important;
          }

          .ot-print-root .ot-print-grid-two {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }

          .ot-print-root .ot-print-section {
            width: 100% !important;
            max-width: none !important;
            break-inside: auto;
            page-break-inside: auto;
          }

          .ot-print-root .ot-print-section-title {
            break-after: avoid-page;
            page-break-after: avoid;
          }

          .ot-print-root .ot-print-avoid {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          .ot-print-root .ot-print-photo-grid {
            display: block !important;
          }

          .ot-print-root .ot-print-photo-card {
            width: 100% !important;
            margin-bottom: 12px !important;
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          .ot-print-root .ot-print-photo-img {
            height: 165px !important;
            object-fit: cover !important;
          }

          .ot-print-root .ot-print-reception {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="ot-print-hide flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245C90]"
        >
          Imprimir / Guardar PDF
        </button>

        <Link
          href={`/ot/${otId}`}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a la OT
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white print:rounded-none print:border-slate-300">
        <div className="h-2 bg-slate-900" />
        <div className="ot-print-header grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr]">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3">
              <img
                src="/rmsic-logo.png"
                alt="RMSIC"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                RM Servicios de Ingeniería y Construcción SpA
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Informe de servicio en terreno
              </h1>
              <p className="mt-2 text-sm text-slate-600">{detalle.titulo}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Folio OT
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {detalle.folio || '-'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fecha
                </p>
                <p className="mt-1 text-sm text-slate-900">
                  {formatDate(detalle.fecha_ot)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Tipo de servicio
              </p>
              <p className="mt-1 text-sm text-slate-900">{tipoNombre}</p>
            </div>
          </div>
        </div>
      </div>

      <Section title="Datos del cliente y servicio">
        <div className="ot-print-grid-two grid grid-cols-2 gap-3">
          <CompactField label="Razón social" value={resumen.cliente_nombre} />
          <CompactField label="Fecha visita" value={formatDate(detalle.fecha_ot)} />
          <CompactField label="Hora inicio" value={formatTime(horaLlegada)} />
          <CompactField label="Hora término" value={formatTime(horaSalida)} />
          <CompactField label="Técnico ejecutante" value={nombreTecnico} />
          <CompactField label="Área / sector" value={areaTrabajo} />
        </div>
      </Section>

      {isPreventiva ? (
        <Section title="Desarrollo de la actividad">
          <div className="space-y-5">
            <TextBlock title="Objetivo del mantenimiento" value={detalle.descripcion_solicitud} />
            <TextBlock title="Actividades ejecutadas" value={detalle.trabajo_realizado} />
            <TextBlock title="Hallazgos detectados" value={detalle.hallazgos} />
            <TextBlock title="Resultado del servicio" value={detalle.resultado_servicio} />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={detalle.observaciones_cierre} />
          </div>
        </Section>
      ) : null}

      {isUrgenciaOAsistencia ? (
        <Section title="Desarrollo de la actividad">
          <div className="space-y-5">
            <TextBlock title="Solicitud del cliente" value={detalle.descripcion_solicitud} />
            <TextBlock title="Problema detectado" value={detalle.problema_reportado} />
            <TextBlock title="Causa probable" value={detalle.causa_probable} />
            <TextBlock title="Solución implementada" value={detalle.trabajo_realizado} />
            <TextBlock title="Resultado del servicio" value={detalle.resultado_servicio} />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={detalle.observaciones_cierre} />

            {detalle.mostrar_nota_valor_hora ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                <span className="font-semibold">Nota comercial informativa:</span>{' '}
                Este servicio fue atendido bajo modalidad de atención inmediata en terreno.
                El valor referencial de atención corresponde a{' '}
                <span className="font-semibold">
                  {labelOrDash(
                    detalle.valor_hora_uf != null
                      ? `${detalle.valor_hora_uf} UF por hora`
                      : null
                  )}
                </span>
                , salvo acuerdo comercial, cotización previa o condiciones particulares pactadas con el cliente.
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {isAsesoria ? (
        <Section title="Desarrollo de la asesoría">
          <div className="space-y-5">
            <TextBlock title="Objetivo de la asesoría" value={detalle.descripcion_solicitud} />
            <TextBlock title="Antecedentes observados" value={detalle.problema_reportado} />
            <TextBlock title="Análisis técnico" value={detalle.diagnostico} />
            <TextBlock title="Conclusiones técnicas" value={detalle.conclusiones_tecnicas} />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={detalle.observaciones_cierre} />
          </div>
        </Section>
      ) : null}

      {!isPreventiva && !isUrgenciaOAsistencia && !isAsesoria ? (
        <Section title="Desarrollo de la actividad">
          <div className="space-y-5">
            <TextBlock title="Solicitud del cliente" value={detalle.descripcion_solicitud} />
            <TextBlock title="Problema detectado" value={detalle.problema_reportado} />
            <TextBlock title="Diagnóstico" value={detalle.diagnostico} />
            <TextBlock title="Solución implementada" value={detalle.trabajo_realizado} />
            <TextBlock title="Resultado del servicio" value={detalle.resultado_servicio} />
            <TextBlock title="Recomendaciones" value={detalle.recomendaciones} />
            <TextBlock title="Observaciones" value={detalle.observaciones_cierre} />
          </div>
        </Section>
      ) : null}

      {(fotosAntes.length > 0 ||
        fotosDurante.length > 0 ||
        fotosDespues.length > 0 ||
        otrasFotos.length > 0) ? (
        <Section title="Registro fotográfico">
          <div className="space-y-6">
            <PhotoGroup title="Antes" items={fotosAntes} />
            <PhotoGroup title="Durante" items={fotosDurante} />
            <PhotoGroup title="Después" items={fotosDespues} />
            <PhotoGroup title="Otras evidencias" items={otrasFotos} />
          </div>
        </Section>
      ) : null}

      <Section title="Recepción y conformidad del servicio" className="ot-print-reception">
        <div className="mx-auto max-w-xl">
          <ReceptionCard
            name={nombreRecepcion}
            role={cargoRecepcion}
            signatureUrl={firmaCliente?.firma_url}
          />
        </div>
      </Section>
    </div>
  )
}

export default function PrintOTPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <PrintOTPageContent />
    </ProtectedModuleRoute>
  )
}