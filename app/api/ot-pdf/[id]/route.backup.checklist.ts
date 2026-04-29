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
    const evidencias = (evidenciasResp.data ?? []) as Evidencia[]
    const firmas = (firmasResp.data ?? []) as Firma[]
    const tiposServicio = (tiposResp.data ?? []) as TipoServicioOption[]
    const logoUrl = new URL('/rmsic-logo.png', request.url).toString()

 const pdfElement = React.createElement(OTPdfDocument, {
  resumen,
  detalle,
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
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo generar el PDF real.'
    return jsonError(message, 500)
  }
}