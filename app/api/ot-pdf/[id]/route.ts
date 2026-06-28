import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { OTPdfDocument } from '../../../../components/ot/ot-pdf-document'
import type { OTResumen } from '../../../../lib/ot/types'
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
  numero_om_cliente: string | null
  cantidad_tecnicos: number | null
  horas_hombre_utilizadas: number | null
  responsable_cliente_rut: string | null
  supervisor_contratista_nombre: string | null
  supervisor_contratista_rut: string | null
  supervisor_contratista_cargo: string | null
  herramientas_materiales_utilizados: string | null
  recomendaciones_seguridad: string | null
  alcance_trabajo_ejecutado: boolean | null
  alcance_trabajo_observacion: string | null
  ejecutado_segun_programa: boolean | null
  ejecutado_segun_programa_observacion: string | null
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


const CHILE_TIME_ZONE = 'America/Santiago'

type DateTimeParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
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

  // Importante: devolvemos fecha/hora local de Chile SIN sufijo Z ni offset.
  // El componente PDF vuelve a formatear con new Date(). En Vercel el servidor
  // corre en UTC; si le pasamos el timestamptz original, muestra +4 horas.
  // Al pasar un datetime "flotante" como 2026-05-11T21:15:00, tanto local
  // como Vercel muestran la hora real del servicio.
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
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

function toValidTime(value: string | null | undefined) {
  if (!value) return null

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function obtenerHorarioDesdeTiempos(tiempos: TiempoTrabajo[]) {
  const activosConHoras = tiempos.filter(
    (item) => toValidTime(item.hora_inicio) !== null || toValidTime(item.hora_termino) !== null
  )

  if (activosConHoras.length === 0) return null

  // Para el encabezado del informe, priorizamos los bloques de trabajo.
  // Si no existen, usamos cualquier bloque de tiempo registrado en la OT.
  const base = activosConHoras.some((item) => item.tipo_tiempo === 'trabajo')
    ? activosConHoras.filter((item) => item.tipo_tiempo === 'trabajo')
    : activosConHoras

  const inicio = base.reduce<TiempoTrabajo | null>((selected, current) => {
    const currentTime = toValidTime(current.hora_inicio)
    if (currentTime === null) return selected

    if (!selected) return current

    const selectedTime = toValidTime(selected.hora_inicio)
    return selectedTime === null || currentTime < selectedTime ? current : selected
  }, null)

  const termino = base.reduce<TiempoTrabajo | null>((selected, current) => {
    const currentTime = toValidTime(current.hora_termino)
    if (currentTime === null) return selected

    if (!selected) return current

    const selectedTime = toValidTime(selected.hora_termino)
    return selectedTime === null || currentTime > selectedTime ? current : selected
  }, null)

  const duracionTotal = base.reduce((total, item) => {
    if (typeof item.duracion_minutos === 'number') {
      return total + item.duracion_minutos
    }

    const inicioMs = toValidTime(item.hora_inicio)
    const terminoMs = toValidTime(item.hora_termino)

    if (inicioMs === null || terminoMs === null || terminoMs < inicioMs) {
      return total
    }

    return total + Math.round((terminoMs - inicioMs) / 60000)
  }, 0)

  return {
    fecha_ot: toChileDate(inicio?.hora_inicio || inicio?.fecha || null),
    hora_inicio: toChileFloatingDateTime(inicio?.hora_inicio || null),
    hora_termino: toChileFloatingDateTime(termino?.hora_termino || null),
    duracion_minutos: duracionTotal > 0 ? duracionTotal : null,
  }
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: otId } = await context.params

    if (!otId) {
      return jsonError('No se recibió el identificador de la OT.', 400)
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

    const [
      resumenResp,
      detalleResp,
      evidenciasResp,
      firmasResp,
      tiemposResp,
      perfilesResp,
      tiposResp,
    ] = await Promise.all([
      adminClient.from('ot_vw_resumen').select('*').eq('id', otId).single(),
      adminClient
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
            numero_om_cliente,
            cantidad_tecnicos,
            horas_hombre_utilizadas,
            responsable_cliente_rut,
            supervisor_contratista_nombre,
            supervisor_contratista_rut,
            supervisor_contratista_cargo,
            herramientas_materiales_utilizados,
            recomendaciones_seguridad,
            alcance_trabajo_ejecutado,
            alcance_trabajo_observacion,
            ejecutado_segun_programa,
            ejecutado_segun_programa_observacion,
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
      adminClient
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
      adminClient
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
      adminClient
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
        .eq('activo', true)
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: true }),
      adminClient.from('perfiles').select('id, email').order('email', { ascending: true }),
      adminClient.from('ot_tipos_servicio').select('id, codigo, nombre').eq('activo', true),
    ])

    if (resumenResp.error) {
      return jsonError(`No se pudo cargar el resumen OT: ${resumenResp.error.message}`, 500)
    }
    if (detalleResp.error) {
      return jsonError(`No se pudo cargar el detalle OT: ${detalleResp.error.message}`, 500)
    }
    if (evidenciasResp.error) {
      return jsonError(`No se pudieron cargar las evidencias: ${evidenciasResp.error.message}`, 500)
    }
    if (firmasResp.error) {
      return jsonError(`No se pudieron cargar las firmas: ${firmasResp.error.message}`, 500)
    }
    if (tiemposResp.error) {
      return jsonError(`No se pudieron cargar los tiempos registrados: ${tiemposResp.error.message}`, 500)
    }
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

    const resumen = resumenResp.data as OTResumen
    const detalle = detalleResp.data as OTDetalle
    const tiempos = (tiemposResp.data ?? []) as TiempoTrabajo[]
    const horarioDesdeTiempos = obtenerHorarioDesdeTiempos(tiempos)

    const checklistResp = await adminClient
      .from('ot_respuestas_checklist')
      .select('id, plantilla_item_id, respuesta_texto, observacion')
      .eq('ot_id', otId)

    if (checklistResp.error) {
      return jsonError(
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

    let checklistTextoPdf = ''

    if (checklistRaw.length > 0) {
      const checklistItemIds = Array.from(
        new Set(
          checklistRaw
            .map((item) => item.plantilla_item_id)
            .filter(Boolean)
        )
      )

      if (checklistItemIds.length > 0) {
        const checklistItemsResp = await adminClient
          .from('ot_plantillas_checklist_items')
          .select('id, zona, categoria, actividad, frecuencia_horas, tipo_item, orden')
          .in('id', checklistItemIds)

        if (checklistItemsResp.error) {
          return jsonError(
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

        checklistTextoPdf = checklistRaw
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
    }

    const siNoPdf = (value: boolean | null | undefined) => {
      if (value === true) return 'Sí'
      if (value === false) return 'No'
      return '-'
    }

    const omSoftysTextoPdf = [
      'DATOS PRINCIPALES INFORME OM',
      `N° OM / Orden cliente: ${detalle.numero_om_cliente || '-'}`,
      `Responsable cliente / Softys: ${detalle.contacto_cliente_nombre || '-'}${detalle.contacto_cliente_cargo ? ` - ${detalle.contacto_cliente_cargo}` : ''}${detalle.responsable_cliente_rut ? ` - RUT ${detalle.responsable_cliente_rut}` : ''}`,
      `Supervisor contratista: ${detalle.supervisor_contratista_nombre || '-'}${detalle.supervisor_contratista_cargo ? ` - ${detalle.supervisor_contratista_cargo}` : ''}${detalle.supervisor_contratista_rut ? ` - RUT ${detalle.supervisor_contratista_rut}` : ''}`,
      `Área / sector de trabajo: ${detalle.area_trabajo || '-'}`,
      `Cantidad de técnicos: ${detalle.cantidad_tecnicos ?? '-'}`,
      `Horas hombre utilizadas: ${detalle.horas_hombre_utilizadas ?? '-'}`,
      `¿Se ejecutó todo lo solicitado?: ${siNoPdf(detalle.alcance_trabajo_ejecutado)}`,
      detalle.alcance_trabajo_observacion
        ? `Observación alcance: ${detalle.alcance_trabajo_observacion}`
        : '',
      `¿Se ejecutó de acuerdo al programa?: ${siNoPdf(detalle.ejecutado_segun_programa)}`,
      detalle.ejecutado_segun_programa_observacion
        ? `Observación programa: ${detalle.ejecutado_segun_programa_observacion}`
        : '',
      detalle.herramientas_materiales_utilizados
        ? `Herramientas y materiales utilizados:\n${detalle.herramientas_materiales_utilizados}`
        : '',
      detalle.recomendaciones_seguridad
        ? `Recomendaciones de seguridad:\n${detalle.recomendaciones_seguridad}`
        : '',
    ]
      .filter((value) => value && value.trim())
      .join('\n')

    const detallePdf: OTDetalle = {
      ...detalle,
      ...(horarioDesdeTiempos
        ? {
            fecha_ot: horarioDesdeTiempos.fecha_ot || detalle.fecha_ot,
            hora_inicio: horarioDesdeTiempos.hora_inicio || detalle.hora_inicio,
            hora_termino: horarioDesdeTiempos.hora_termino || detalle.hora_termino,
            duracion_minutos:
              horarioDesdeTiempos.duracion_minutos ?? detalle.duracion_minutos,
          }
        : {}),
      observaciones_cierre: [
        detalle.observaciones_cierre,
        omSoftysTextoPdf,
        checklistTextoPdf
          ? `CHECKLIST DE MANTENIMIENTO\n${checklistTextoPdf}`
          : '',
      ]
        .filter((value) => value && value.trim())
        .join('\n\n'),
    }
    const evidencias = (evidenciasResp.data ?? []) as Evidencia[]
    const firmas = (firmasResp.data ?? []) as Firma[]
    const tiposServicio = (tiposResp.data ?? []) as TipoServicioOption[]
    const logoUrl = new URL('/logos/rmsic-logo.png', request.url).toString()

    const resumenPdf = horarioDesdeTiempos
      ? ({
          ...resumen,
          fecha_ot: horarioDesdeTiempos.fecha_ot || (resumen as any).fecha_ot,
          fecha_visita: horarioDesdeTiempos.fecha_ot || (resumen as any).fecha_visita,
          hora_inicio: horarioDesdeTiempos.hora_inicio || (resumen as any).hora_inicio,
          hora_termino: horarioDesdeTiempos.hora_termino || (resumen as any).hora_termino,
          duracion_minutos:
            horarioDesdeTiempos.duracion_minutos ?? (resumen as any).duracion_minutos,
        } as OTResumen)
      : resumen

 const pdfElement = React.createElement(OTPdfDocument, {
  resumen: resumenPdf,
  detalle: detallePdf,
  evidencias,
  firmas,
  perfilesMap,
  tiposServicio,
  logoUrl,
}) as React.ReactElement<DocumentProps>

const buffer = await renderToBuffer(pdfElement)
const pdfBytes = new Uint8Array(buffer)

const safeFolio = (detalle.folio || 'ot').replace(/[^\w.-]+/g, '_')

return new Response(pdfBytes, {      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFolio}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo generar el PDF real.'
    return jsonError(message, 500)
  }
}
