import React from 'react'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { PTSPdfDocument } from '../../../../components/pts/pts-pdf-document'
import { createVerificationQrMatrix, qrMatrixToSvgPath } from '../../../../lib/pts/qr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } })
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    if (!id) return jsonError('No se recibió el identificador del PTS.', 400)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonError('Faltan variables de entorno para generar el PDF.', 500)

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return jsonError('No autorizado.', 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: { user }, error: userError } = await authClient.auth.getUser(token)
    if (userError || !user) return jsonError('Sesión no válida.', 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: permiso, error: permisoError } = await admin
      .from('pts_permisos')
      .select('*')
      .eq('id', id)
      .single()
    if (permisoError || !permiso) return jsonError('PTS no encontrado.', 404)

    const [{ data: perfil }, { data: membresia }, { data: modulo }] = await Promise.all([
      admin.from('perfiles').select('rol').eq('id', user.id).maybeSingle(),
      admin.from('usuario_empresas').select('rol,activo').eq('usuario_id', user.id).eq('empresa_id', permiso.empresa_id).maybeSingle(),
      admin.from('empresa_modulos').select('habilitado').eq('empresa_id', permiso.empresa_id).eq('modulo', 'seguridad').maybeSingle(),
    ])

    const superadmin = perfil?.rol === 'superadmin'
    const accesoEmpresa = membresia?.activo === true && ['admin', 'seguridad_pts'].includes(membresia.rol)
    const seguridadHabilitada = modulo?.habilitado === true
    if (!superadmin && !(accesoEmpresa && seguridadHabilitada)) return jsonError('Sin permisos para este PTS.', 403)

    if (!['aprobado', 'en_ejecucion', 'cerrado'].includes(permiso.estado)) {
      return jsonError('El PDF oficial solo está disponible para PTS aprobados, en ejecución o cerrados.', 409)
    }

    const [empresaResp, riesgosResp, personalResp, eppResp, firmasResp, aprobacionesResp, historialResp] = await Promise.all([
      admin.from('empresas').select('nombre').eq('id', permiso.empresa_id).single(),
      admin.from('pts_analisis_riesgos').select('paso,actividad,peligros,riesgos,medidas_preventivas').eq('permiso_id', id).eq('empresa_id', permiso.empresa_id).order('orden'),
      admin.from('pts_personal').select('id,nombre_apellido,rut,induccion_ingreso_ok,charla_5_min_ok,examen_altura_vigente_hasta').eq('permiso_id', id).eq('empresa_id', permiso.empresa_id).order('orden'),
      admin.from('pts_epp').select('nombre,requerido').eq('permiso_id', id).eq('empresa_id', permiso.empresa_id).order('orden'),
      admin.from('pts_firmas_participantes').select('personal_id,nombre_firmante,rut_firmante,declaracion,declaracion_version,firma_trazos,metodo,capturado_por_nombre,firmado_at').eq('permiso_id', id).eq('empresa_id', permiso.empresa_id).order('firmado_at'),
      admin.from('pts_aprobaciones').select('etapa,estado,observacion,nombre_firmante,cargo_firmante,usuario_id,firmado_at').eq('permiso_id', id).eq('empresa_id', permiso.empresa_id).order('orden'),
      admin.from('pts_historial').select('evento,detalle,created_at,usuario_id').eq('permiso_id', id).eq('empresa_id', permiso.empresa_id).order('created_at', { ascending: true }),
    ])

    const firstError = [empresaResp, riesgosResp, personalResp, eppResp, firmasResp, aprobacionesResp, historialResp].find((result) => result.error)?.error
    if (firstError) return jsonError(`No se pudo construir el PDF: ${firstError.message}`, 500)

    const personalTotal = (personalResp.data ?? []).length
    const firmasTotal = (firmasResp.data ?? []).length
    if (permiso.estado === 'aprobado' && (personalTotal === 0 || firmasTotal !== personalTotal)) {
      return jsonError('El PDF oficial requiere que todos los participantes hayan firmado el PTS antes del inicio.', 409)
    }

    const userIds = Array.from(new Set([
      ...(aprobacionesResp.data ?? []).map((item) => item.usuario_id),
      ...(historialResp.data ?? []).map((item) => item.usuario_id),
    ].filter((value): value is string => Boolean(value))))

    let perfilesMap = new Map<string, string>()
    if (userIds.length > 0) {
      const perfilesResp = await admin.from('perfiles').select('id,nombre_completo,email').in('id', userIds)
      if (perfilesResp.error) return jsonError(`No se pudieron cargar responsables del PDF: ${perfilesResp.error.message}`, 500)
      perfilesMap = new Map((perfilesResp.data ?? []).map((item) => [item.id, item.nombre_completo || item.email || item.id]))
    }

    const verificationUrl = new URL(`/verificar/pts/${permiso.verificacion_token}`, request.url).toString()
    const matrix = createVerificationQrMatrix(verificationUrl)
    const qr = qrMatrixToSvgPath(matrix)

    const data = {
      folio: Number(permiso.folio),
      estado: permiso.estado,
      empresa_nombre: empresaResp.data?.nombre || 'Empresa',
      trabajo_a_realizar: permiso.trabajo_a_realizar,
      tipo_actividad: permiso.tipo_actividad,
      lugar_ejecucion: permiso.lugar_ejecucion,
      empresa_contratista: permiso.empresa_contratista,
      fecha_inicio: permiso.fecha_inicio,
      fecha_termino: permiso.fecha_termino,
      hora_inicio: permiso.hora_inicio,
      hora_termino: permiso.hora_termino,
      observaciones: permiso.observaciones,
      iniciado_at: permiso.iniciado_at,
      cerrado_at: permiso.cerrado_at,
      iniciado_por_nombre: permiso.iniciado_por_nombre,
      cerrado_por_nombre: permiso.cerrado_por_nombre,
      cierre_observaciones: permiso.cierre_observaciones,
      riesgos: riesgosResp.data ?? [],
      personal: personalResp.data ?? [],
      epp: (eppResp.data ?? []).filter((item) => item.requerido).map((item) => item.nombre),
      firmas_participantes: (firmasResp.data ?? []).map((item) => ({
        personal_id: item.personal_id,
        nombre_firmante: item.nombre_firmante,
        rut_firmante: item.rut_firmante,
        declaracion: item.declaracion,
        declaracion_version: item.declaracion_version,
        firma_trazos: item.firma_trazos,
        metodo: item.metodo,
        capturado_por_nombre: item.capturado_por_nombre,
        firmado_at: item.firmado_at,
      })),
      aprobaciones: (aprobacionesResp.data ?? []).map((item) => ({
        etapa: item.etapa,
        estado: item.estado,
        observacion: item.observacion,
        responsable_nombre: item.nombre_firmante || (item.usuario_id ? perfilesMap.get(item.usuario_id) || null : null),
        cargo_firmante: item.cargo_firmante,
        firmado_at: item.firmado_at,
      })),
      historial: (historialResp.data ?? []).map((item) => ({
        evento: item.evento,
        detalle: item.detalle,
        created_at: item.created_at,
        usuario_nombre: item.usuario_id ? perfilesMap.get(item.usuario_id) || null : null,
      })),
      verificationUrl,
      qrPath: qr.path,
      qrViewBoxSize: qr.viewBoxSize,
    }

    const pdfElement = React.createElement(PTSPdfDocument, { data }) as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(pdfElement)
    const filename = `PTS-${String(permiso.folio).padStart(6, '0')}.pdf`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo generar el PDF del PTS.', 500)
  }
}