import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { PDFDocument as PDFLibDocument } from 'pdf-lib'
import { OTPdfDocument } from '../../../components/ot/ot-pdf-document'
import type { OTResumen } from '../../../lib/ot/types'
import React from 'react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

type TiempoTrabajo = Record<string, unknown>

type UsuarioEmpresa = {
  rol: string | null
}

type OtPdfPayload = {
  resumen: OTResumen
  detalle: OTDetalle
  evidencias: Evidencia[]
  firmas: Firma[]
  perfilesMap: Record<string, string>
  tiposServicio: TipoServicioOption[]
  logoUrl: string
}

const CHILE_TIME_ZONE = 'America/Santiago'

class HttpError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

type DateTimeParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function pickStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = valueToString(record[key]).trim()
    if (value) return value
  }

  return ''
}

function pickNumberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

function getChileDateTimeParts(value: string | null | undefined): DateTimeParts | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>(
    (acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    },
    {}
  )

  if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute) {
    return null
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour.padStart(2, '0'),
    minute: parts.minute.padStart(2, '0'),
    second: (parts.second || '00').padStart(2, '0'),
  }
}

function isDateOnly(value: string | null | undefined) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function toChileDate(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()

  // Las fechas puras de Supabase, por ejemplo 2026-05-17, no deben pasar
  // por new Date(), porque JS las interpreta como medianoche UTC y en Chile
  // pueden retroceder al día anterior.
  if (isDateOnly(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const parts = getChileDateTimeParts(trimmed)
  if (!parts) return null
  return `${parts.year}-${parts.month}-${parts.day}`
}

function toChileFloatingDateTime(value: string | null | undefined) {
  const parts = getChileDateTimeParts(value)
  if (!parts) return null

  // Importante para Vercel: devolvemos fecha/hora local de Chile sin sufijo Z ni offset.
  // Así evitamos que el PDF vuelva a aplicar UTC y genere desfase de 4 horas.
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

function timestampMs(value: string | null | undefined) {
  if (!value) return Number.NaN
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.NaN : time
}

function esTiempoTrabajo(row: TiempoTrabajo) {
  const tipo = pickStringValue(row, [
    'tipo',
    'tipo_registro',
    'tipo_tiempo',
    'categoria',
    'clase',
  ]).toLowerCase()

  return !tipo || tipo.includes('trabajo') || tipo.includes('servicio')
}

function normalizarTiempos(detalle: OTDetalle, resumen: OTResumen, tiemposRaw: TiempoTrabajo[]) {
  const tiempos = tiemposRaw
    .map((row) => {
      const inicio = pickStringValue(row, [
        'hora_inicio',
        'inicio',
        'fecha_inicio',
        'fecha_hora_inicio',
        'started_at',
      ])
      const termino = pickStringValue(row, [
        'hora_termino',
        'termino',
        'fecha_termino',
        'fecha_hora_termino',
        'ended_at',
      ])
      const duracionMinutos = pickNumberValue(row, [
        'duracion_minutos',
        'duracion',
        'minutos',
        'duration_minutes',
      ])

      return {
        inicio,
        termino,
        duracionMinutos,
        esTrabajo: esTiempoTrabajo(row),
        inicioMs: timestampMs(inicio),
        terminoMs: timestampMs(termino),
      }
    })
    .filter((row) => row.inicio || row.termino)

  const tiemposTrabajo = tiempos.filter((row) => row.esTrabajo)
  const base = tiemposTrabajo.length > 0 ? tiemposTrabajo : tiempos

  const inicioReal =
    base
      .filter((row) => Number.isFinite(row.inicioMs))
      .sort((a, b) => a.inicioMs - b.inicioMs)[0]?.inicio || null

  const terminoReal =
    base
      .filter((row) => Number.isFinite(row.terminoMs))
      .sort((a, b) => b.terminoMs - a.terminoMs)[0]?.termino || null

  const duracionTotal = base.reduce((total, row) => {
    if (typeof row.duracionMinutos === 'number' && row.duracionMinutos > 0) {
      return total + row.duracionMinutos
    }

    if (Number.isFinite(row.inicioMs) && Number.isFinite(row.terminoMs)) {
      const diferencia = Math.max(0, Math.round((row.terminoMs - row.inicioMs) / 60000))
      return total + diferencia
    }

    return total
  }, 0)

  const horaInicioChile = toChileFloatingDateTime(inicioReal)
  const horaTerminoChile = toChileFloatingDateTime(terminoReal)
  const fechaOtChile = toChileDate(inicioReal)

  const detallePdf: OTDetalle = {
    ...detalle,
    fecha_ot: fechaOtChile || detalle.fecha_ot,
    hora_inicio: horaInicioChile || detalle.hora_inicio,
    hora_termino: horaTerminoChile || detalle.hora_termino,
    duracion_minutos: duracionTotal > 0 ? duracionTotal : detalle.duracion_minutos,
  }

  const resumenPdf = {
    ...resumen,
    fecha_ot: fechaOtChile || (resumen as Record<string, unknown>).fecha_ot,
    hora_inicio: horaInicioChile || (resumen as Record<string, unknown>).hora_inicio,
    hora_termino: horaTerminoChile || (resumen as Record<string, unknown>).hora_termino,
    duracion_minutos:
      duracionTotal > 0
        ? duracionTotal
        : (resumen as Record<string, unknown>).duracion_minutos,
  } as OTResumen

  return {
    detallePdf,
    resumenPdf,
  }
}

async function validarAccesoUsuario(
  adminClient: SupabaseClient,
  userId: string,
  detalle: OTDetalle
) {
  const { data, error } = await adminClient
    .from('usuario_empresas')
    .select('rol')
    .eq('usuario_id', userId)
    .eq('empresa_id', detalle.empresa_id)
    .eq('activo', true)
    .maybeSingle()

  if (error) {
    throw new HttpError(`No se pudo validar el acceso del usuario: ${error.message}`, 500)
  }

  const usuarioEmpresa = data as UsuarioEmpresa | null

  if (!usuarioEmpresa) {
    throw new HttpError('No tienes acceso a una o más OT seleccionadas.', 403)
  }

  if (
    usuarioEmpresa.rol === 'tecnico_ot' &&
    detalle.tecnico_responsable_id !== userId &&
    detalle.created_by !== userId
  ) {
    throw new HttpError('No tienes acceso a una o más OT seleccionadas.', 403)
  }
}

async function cargarChecklistTexto(
  adminClient: SupabaseClient,
  otId: string
) {
  const checklistResp = await adminClient
    .from('ot_respuestas_checklist')
    .select('id, plantilla_item_id, respuesta_texto, observacion')
    .eq('ot_id', otId)

  if (checklistResp.error) {
    throw new HttpError(
      `No se pudieron cargar las respuestas del checklist: ${checklistResp.error.message}`,
      500
    )
  }

  const checklistRaw = (checklistResp.data ?? []) as Array<{
    id: string
    plantilla_item_id: string
    respuesta_texto: string | null
    observacion: string | null
  }>

  if (checklistRaw.length === 0) {
    return ''
  }

  const checklistItemIds = Array.from(
    new Set(
      checklistRaw
        .map((item) => item.plantilla_item_id)
        .filter(Boolean)
    )
  )

  if (checklistItemIds.length === 0) {
    return ''
  }

  const checklistItemsResp = await adminClient
    .from('ot_plantillas_checklist_items')
    .select('id, zona, categoria, actividad, frecuencia_horas, tipo_item, orden')
    .in('id', checklistItemIds)

  if (checklistItemsResp.error) {
    throw new HttpError(
      `No se pudieron cargar los ítems del checklist: ${checklistItemsResp.error.message}`,
      500
    )
  }

  const checklistItemsMap = ((checklistItemsResp.data ?? []) as Array<{
    id: string
    zona: string
    categoria: string | null
    actividad: string
    frecuencia_horas: number | null
    tipo_item: string | null
    orden: number
  }>).reduce<Record<string, {
    id: string
    zona: string
    categoria: string | null
    actividad: string
    frecuencia_horas: number | null
    tipo_item: string | null
    orden: number
  }>>((acc, item) => {
    acc[item.id] = item
    return acc
  }, {})

  const estadoLabel = (value: string | null) => {
    if (value === 'ok') return 'OK'
    if (value === 'no_ok') return 'No OK'
    if (value === 'na') return 'N/A'
    return 'Sin respuesta'
  }

  return checklistRaw
    .map((respuesta) => {
      const item = checklistItemsMap[respuesta.plantilla_item_id]
      if (!item) return null

      return {
        orden: item.orden,
        texto: [
          item.zona || 'General',
          item.frecuencia_horas ? `${item.frecuencia_horas} hrs` : '',
          item.actividad,
          estadoLabel(respuesta.respuesta_texto),
          respuesta.observacion ? `Obs: ${respuesta.observacion}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      }
    })
    .filter((item): item is { orden: number; texto: string } => item !== null)
    .sort((a, b) => a.orden - b.orden)
    .map((item) => item.texto)
    .join('\n')
}

async function cargarOtParaPdf(params: {
  adminClient: SupabaseClient
  userId: string
  otId: string
  perfilesMap: Record<string, string>
  tiposServicio: TipoServicioOption[]
  logoUrl: string
}) {
  const { adminClient, userId, otId, perfilesMap, tiposServicio, logoUrl } = params

  const [
    resumenResp,
    detalleResp,
    evidenciasResp,
    firmasResp,
    tiemposResp,
  ] = await Promise.all([
    adminClient.from('ot_vw_resumen').select('*').eq('id', otId).single(),
    adminClient.from('ot_ordenes_trabajo').select('*').eq('id', otId).single(),
    adminClient
      .from('ot_evidencias')
      .select('*')
      .eq('ot_id', otId)
      .order('tipo', { ascending: true })
      .order('orden', { ascending: true }),
    adminClient
      .from('ot_firmas')
      .select('*')
      .eq('ot_id', otId)
      .order('fecha_firma', { ascending: false }),
    adminClient
      .from('ot_tiempos_trabajo')
      .select('*')
      .eq('ot_id', otId),
  ])

  if (resumenResp.error) {
    throw new HttpError(`No se pudo cargar el resumen OT: ${resumenResp.error.message}`, 500)
  }
  if (detalleResp.error) {
    throw new HttpError(`No se pudo cargar el detalle OT: ${detalleResp.error.message}`, 500)
  }
  if (evidenciasResp.error) {
    throw new HttpError(`No se pudieron cargar las evidencias: ${evidenciasResp.error.message}`, 500)
  }
  if (firmasResp.error) {
    throw new HttpError(`No se pudieron cargar las firmas: ${firmasResp.error.message}`, 500)
  }
  if (tiemposResp.error) {
    throw new HttpError(
      `No se pudieron cargar los tiempos registrados: ${tiemposResp.error.message}`,
      500
    )
  }

  const resumen = resumenResp.data as OTResumen
  const detalle = detalleResp.data as OTDetalle

  await validarAccesoUsuario(adminClient, userId, detalle)

  const checklistTextoPdf = await cargarChecklistTexto(adminClient, otId)
  const { detallePdf, resumenPdf } = normalizarTiempos(
    detalle,
    resumen,
    (tiemposResp.data ?? []) as TiempoTrabajo[]
  )

  const detalleConChecklist: OTDetalle = {
    ...detallePdf,
    observaciones_cierre: [
      detallePdf.observaciones_cierre,
      checklistTextoPdf ? `CHECKLIST DE MANTENIMIENTO\n${checklistTextoPdf}` : '',
    ]
      .filter((value) => value && value.trim())
      .join('\n\n'),
  }

  return {
    resumen: resumenPdf,
    detalle: detalleConChecklist,
    evidencias: (evidenciasResp.data ?? []) as Evidencia[],
    firmas: (firmasResp.data ?? []) as Firma[],
    perfilesMap,
    tiposServicio,
    logoUrl,
  } satisfies OtPdfPayload
}

export async function GET(request: NextRequest) {
  try {
    const idsParam = request.nextUrl.searchParams.get('ids') || ''
    const otIds = Array.from(
      new Set(
        idsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      )
    )

    if (otIds.length === 0) {
      return jsonError('Selecciona al menos una OT para generar el PDF.', 400)
    }

    if (otIds.length > 50) {
      return jsonError('Puedes generar un PDF con un máximo de 50 OT por vez.', 400)
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const missingVars = [
      !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !supabaseAnonKey
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
        : null,
      !supabaseServiceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean)

    if (missingVars.length > 0) {
      return jsonError(
        `Faltan variables de entorno: ${missingVars.join(', ')}`,
        500
      )
    }

    const supabaseUrlSafe = supabaseUrl as string
    const supabaseAnonKeySafe = supabaseAnonKey as string
    const supabaseServiceRoleKeySafe = supabaseServiceRoleKey as string

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) {
      return jsonError('No autorizado.', 401)
    }

    const authClient = createClient(supabaseUrlSafe, supabaseAnonKeySafe, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return jsonError('Sesión no válida.', 401)
    }

    const adminClient = createClient(supabaseUrlSafe, supabaseServiceRoleKeySafe, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const [perfilesResp, tiposResp] = await Promise.all([
      adminClient.from('perfiles').select('id, email').order('email', { ascending: true }),
      adminClient.from('ot_tipos_servicio').select('id, codigo, nombre').eq('activo', true),
    ])

    if (perfilesResp.error) {
      return jsonError(`No se pudieron cargar los perfiles: ${perfilesResp.error.message}`, 500)
    }
    if (tiposResp.error) {
      return jsonError(`No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`, 500)
    }

    const perfilesRaw = (perfilesResp.data ?? []) as PerfilMini[]
    const perfilesMap = perfilesRaw.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.email || item.id
      return acc
    }, {})

    const tiposServicio = (tiposResp.data ?? []) as TipoServicioOption[]
    const logoUrl = new URL('/logos/rmsic-logo.png', request.url).toString()

    const mergedPdf = await PDFLibDocument.create()

    for (const otId of otIds) {
      const payload = await cargarOtParaPdf({
        adminClient,
        userId: user.id,
        otId,
        perfilesMap,
        tiposServicio,
        logoUrl,
      })

      const pdfElement = React.createElement(OTPdfDocument, payload) as React.ReactElement<DocumentProps>
      const buffer = await renderToBuffer(pdfElement)
      const sourcePdf = await PDFLibDocument.load(new Uint8Array(buffer))
      const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())

      pages.forEach((page) => {
        mergedPdf.addPage(page)
      })
    }

    const pdfBytes = await mergedPdf.save()
   const today = new Date().toISOString().slice(0, 10)

const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength)
new Uint8Array(pdfArrayBuffer).set(pdfBytes)

return new Response(pdfArrayBuffer, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="ots-seleccionadas-${today}.pdf"`,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
})

  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo generar el PDF de OT seleccionadas.'
    const status = error instanceof HttpError ? error.status : 500

    return jsonError(message, status)
  }
}
