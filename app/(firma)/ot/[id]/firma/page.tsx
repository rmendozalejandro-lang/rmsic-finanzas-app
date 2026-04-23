'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../../../components/ProtectedModuleRoute'
import { OTFirmasPanel } from '../../../../../components/ot/ot-firmas-panel'
import { supabase } from '../../../../../lib/supabase/client'
import type { OTResumen } from '../../../../../lib/ot/types'

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  cliente_id: string
  tipo_servicio_id: string
  fecha_ot: string
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
  diagnostico: string | null
  causa_probable: string | null
  trabajo_realizado: string | null
  recomendaciones: string | null
  tecnico_responsable_id: string | null
  hora_inicio: string | null
  hora_termino: string | null
  cliente_nombre_firma: string | null
  cliente_cargo_firma: string | null
  observaciones_cierre: string | null
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
  tipo: 'antes' | 'durante' | 'despues' | 'documento' | 'otro'
  archivo_url: string
  archivo_nombre: string | null
  descripcion: string | null
  orden: number
}

type Firma = {
  id: string
  tipo_firma: 'tecnico' | 'cliente' | 'supervisor'
  nombre_firmante: string | null
  cargo_firmante: string | null
  firma_url: string
  fecha_firma: string
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

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
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
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raul mendoza': 'Raúl Mendoza',
    'raúl mendoza': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raúl') && lower.includes('mendoza'))
  ) {
    return 'Raúl Mendoza'
  }

  if (lower.includes('david') && lower.includes('allendes')) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0]
    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function FieldCard({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  if (value == null || value === '' || value === '-') return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
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
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">
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
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">
        {title}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-slate-200"
          >
            <img
              src={item.archivo_url}
              alt={item.archivo_nombre ?? 'Evidencia'}
              className="h-56 w-full object-cover"
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

function FirmaClienteView() {
  const params = useParams()

  const otId = useMemo(() => {
    const raw = params?.id
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return raw[0] ?? ''
    return ''
  }, [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

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
          authResp,
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
                tipo_servicio_id,
                fecha_ot,
                titulo,
                descripcion_solicitud,
                problema_reportado,
                diagnostico,
                causa_probable,
                trabajo_realizado,
                recomendaciones,
                tecnico_responsable_id,
                hora_inicio,
                hora_termino,
                cliente_nombre_firma,
                cliente_cargo_firma,
                observaciones_cierre,
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
                tipo,
                archivo_url,
                archivo_nombre,
                descripcion,
                orden
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
                tipo_firma,
                nombre_firmante,
                cargo_firmante,
                firma_url,
                fecha_firma
              `
            )
            .eq('ot_id', otId)
            .order('fecha_firma', { ascending: false }),
          supabase.from('perfiles').select('id, email').order('email', { ascending: true }),
          supabase.from('ot_tipos_servicio').select('id, codigo, nombre').eq('activo', true),
          supabase.auth.getUser(),
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

        setCurrentUserId(authResp.data.user?.id || '')
        setPerfilesMap(nextMap)
        setResumen(resumenResp.data as OTResumen)
        setDetalle(detalleResp.data as OTDetalle)
        setEvidencias((evidenciasResp.data ?? []) as Evidencia[])
        setFirmas((firmasResp.data ?? []) as Firma[])
        setTiposServicio((tiposResp.data ?? []) as TipoServicioOption[])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar la vista cliente.')
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

  const nombreTecnico = useMemo(() => {
    const raw =
      (detalle?.tecnico_responsable_id
        ? perfilesMap[detalle.tecnico_responsable_id] || detalle.tecnico_responsable_id
        : null) ||
      resumen?.tecnico_nombre ||
      '-'

    return humanizePerson(raw)
  }, [detalle, perfilesMap, resumen])

  const areaTrabajo = useMemo(() => {
    return detalle?.area_trabajo || resumen?.ubicacion_nombre || resumen?.activo_nombre || '-'
  }, [detalle, resumen])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          Cargando vista cliente...
        </div>
      </div>
    )
  }

  if (error || !detalle || !resumen) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || 'No se encontró la OT.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-2 bg-slate-900" />
        <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr]">
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
                Revisión de orden de trabajo
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

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/ot/${otId}`}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a la OT
        </Link>

        <Link
          href={`/ot/${otId}/pdf`}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          PDF real
        </Link>
      </div>

      <Section title="Datos del cliente y servicio">
        <div className="grid gap-3 md:grid-cols-2">
          <FieldCard label="Razón social" value={resumen.cliente_nombre} />
          <FieldCard label="Fecha visita" value={formatDate(detalle.fecha_ot)} />
          <FieldCard label="Hora inicio" value={formatTime(detalle.hora_inicio)} />
          <FieldCard label="Hora término" value={formatTime(detalle.hora_termino)} />
          <FieldCard label="Técnico ejecutante" value={nombreTecnico} />
          <FieldCard label="Área / sector" value={areaTrabajo} />
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

      <Section title="Firma de recepción">
        <div className="space-y-5">
          <div
            className={`rounded-2xl border px-4 py-4 text-sm ${
              firmaCliente
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {firmaCliente ? (
              <div className="space-y-1">
                <p className="font-semibold">Firma de cliente registrada.</p>
                <p>
                  Firmante: {humanizePerson(firmaCliente.nombre_firmante || detalle.contacto_cliente_nombre || '-')}
                </p>
                <p>Fecha firma: {formatDateTime(firmaCliente.fecha_firma)}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold">Pendiente de firma del cliente.</p>
                <p>Revisa el trabajo y luego registra la firma en este mismo dispositivo.</p>
              </div>
            )}
          </div>

          <OTFirmasPanel
            otId={otId}
            empresaId={detalle.empresa_id}
            currentUserId={currentUserId}
          />
        </div>
      </Section>
    </div>
  )
}

export default function OTFirmaClientePage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <FirmaClienteView />
    </ProtectedModuleRoute>
  )
}