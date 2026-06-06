'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'
import { supabase } from '@/lib/supabase/client'
import type { OTResumen } from '@/lib/ot/types'

type OTResumenConEquipo = OTResumen & {
  equipo_id: string | null
  equipo_tag: string | null
  equipo_nombre: string | null
  equipo_descripcion: string | null
  equipo_tipo: string | null
  equipo_planta: string | null
  equipo_area: string | null
  equipo_linea: string | null
  equipo_ubicacion: string | null
  equipo_marca: string | null
  equipo_modelo: string | null
  equipo_serie: string | null
  equipo_potencia: string | null
}

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  cliente_id: string
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
  prioridad: string
  requiere_checklist: boolean
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  cliente_nombre_firma: string | null
  cliente_cargo_firma: string | null
  observaciones_cierre: string | null
  contacto_cliente_nombre: string | null
  contacto_cliente_cargo: string | null
  area_trabajo: string | null
  resultado_servicio: string | null
  hallazgos: string | null
  conclusiones_tecnicas: string | null
}

type Evidencia = {
  id: string
  tipo: string | null
  archivo_url: string | null
  archivo_nombre: string | null
  descripcion: string | null
  orden: number | null
  created_at: string
}

type Firma = {
  id: string
  tipo_firma: string
  nombre_firmante: string | null
  cargo_firmante: string | null
  firma_url: string | null
  fecha_firma: string | null
}

type TiempoTrabajo = {
  id: string
  usuario_id: string
  fecha: string
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  tipo_tiempo: string | null
  observacion: string | null
}

const DYF_LOGO = '/logos/dyf-logo.png'
const SOFTYS_LOGO = '/logos/softys-logo.png'

function labelOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-CL')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatMinutes(value: number | null | undefined) {
  if (!value || value <= 0) return '-'
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

function buildLocation(resumen: OTResumenConEquipo | null) {
  if (!resumen) return ''
  return [
    resumen.equipo_planta,
    resumen.equipo_area,
    resumen.equipo_linea,
    resumen.equipo_ubicacion,
  ]
    .filter(Boolean)
    .join(' / ')
}

function buildEquipoCaracteristicas(resumen: OTResumenConEquipo | null) {
  if (!resumen) return ''
  return [
    resumen.equipo_tipo,
    resumen.equipo_marca,
    resumen.equipo_modelo,
    resumen.equipo_potencia,
  ]
    .filter(Boolean)
    .join(' · ')
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildDocumentTitle(resumen: OTResumenConEquipo | null) {
  const folio = resumen?.folio || 'OT'
  const tag = resumen?.equipo_tag ? ` ${resumen.equipo_tag}` : ''
  return sanitizeFileName(`Informe OM ${folio}${tag}`)
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="section-block">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{labelOrDash(value)}</strong>
    </div>
  )
}

function TextBox({
  value,
  minHeight = 70,
}: {
  value: string | null | undefined
  minHeight?: number
}) {
  return (
    <div className="text-box" style={{ minHeight }}>
      {value || <span className="muted">Sin información registrada.</span>}
    </div>
  )
}

function FirmaBox({
  title,
  nombre,
  cargo,
  firmaUrl,
}: {
  title: string
  nombre: string | null | undefined
  cargo: string | null | undefined
  firmaUrl?: string | null
}) {
  return (
    <div className="firma-box">
      <p className="firma-title">{title}</p>
      <div className="firma-area">
        {firmaUrl ? <img src={firmaUrl} alt={title} /> : <span>Firma</span>}
      </div>
      <p className="firma-name">{labelOrDash(nombre)}</p>
      <p className="firma-role">{labelOrDash(cargo)}</p>
    </div>
  )
}

export default function InformeSoftysPage() {
  const params = useParams()
  const otId = String(params?.id || '')

  const [resumen, setResumen] = useState<OTResumenConEquipo | null>(null)
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [evidencias, setEvidencias] = useState<Evidencia[]>([])
  const [firmas, setFirmas] = useState<Firma[]>([])
  const [tiempos, setTiempos] = useState<TiempoTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          resumenResp,
          detalleResp,
          evidenciasResp,
          firmasResp,
          tiemposResp,
        ] = await Promise.all([
          supabase.from('ot_vw_resumen').select('*').eq('id', otId).maybeSingle(),
          supabase
            .from('ot_ordenes_trabajo')
            .select(
              `
                id,
                folio,
                empresa_id,
                cliente_id,
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
                hora_inicio,
                hora_termino,
                duracion_minutos,
                cliente_nombre_firma,
                cliente_cargo_firma,
                observaciones_cierre,
                contacto_cliente_nombre,
                contacto_cliente_cargo,
                area_trabajo,
                resultado_servicio,
                hallazgos,
                conclusiones_tecnicas
              `
            )
            .eq('id', otId)
            .maybeSingle(),
          supabase
            .from('ot_evidencias')
            .select('id,tipo,archivo_url,archivo_nombre,descripcion,orden,created_at')
            .eq('ot_id', otId)
            .order('orden', { ascending: true }),
          supabase
            .from('ot_firmas')
            .select('id,tipo_firma,nombre_firmante,cargo_firmante,firma_url,fecha_firma')
            .eq('ot_id', otId)
            .order('fecha_firma', { ascending: false }),
          supabase
            .from('ot_tiempos_trabajo')
            .select('id,usuario_id,fecha,hora_inicio,hora_termino,duracion_minutos,tipo_tiempo,observacion')
            .eq('ot_id', otId)
            .eq('activo', true)
            .is('deleted_at', null)
            .order('created_at', { ascending: true }),
        ])

        if (resumenResp.error) {
          throw new Error(`No se pudo cargar resumen OT: ${resumenResp.error.message}`)
        }

        if (detalleResp.error) {
          throw new Error(`No se pudo cargar detalle OT: ${detalleResp.error.message}`)
        }

        if (!resumenResp.data || !detalleResp.data) {
          throw new Error('No se encontró la OT solicitada.')
        }

        if (evidenciasResp.error) {
          throw new Error(`No se pudieron cargar evidencias: ${evidenciasResp.error.message}`)
        }

        if (firmasResp.error) {
          throw new Error(`No se pudieron cargar firmas: ${firmasResp.error.message}`)
        }

        if (tiemposResp.error) {
          throw new Error(`No se pudieron cargar tiempos: ${tiemposResp.error.message}`)
        }

        setResumen(resumenResp.data as OTResumenConEquipo)
        setDetalle(detalleResp.data as OTDetalle)
        setEvidencias((evidenciasResp.data ?? []) as Evidencia[])
        setFirmas((firmasResp.data ?? []) as Firma[])
        setTiempos((tiemposResp.data ?? []) as TiempoTrabajo[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el informe.')
      } finally {
        setLoading(false)
      }
    }

    if (otId) loadData()
  }, [otId])

  const evidenciasImagenes = useMemo(() => {
    return evidencias.filter((item) => {
      const url = item.archivo_url || ''
      const nombre = item.archivo_nombre || ''
      return /\.(png|jpg|jpeg|webp|gif)$/i.test(url) || /\.(png|jpg|jpeg|webp|gif)$/i.test(nombre)
    })
  }, [evidencias])

  const firmaCliente = firmas.find((item) => item.tipo_firma === 'cliente')
  const firmaTecnico = firmas.find((item) => item.tipo_firma === 'tecnico')
  const firmaSupervisor = firmas.find((item) => item.tipo_firma === 'supervisor')

  const documentTitle = useMemo(() => buildDocumentTitle(resumen), [resumen])

  useEffect(() => {
    if (!resumen) return

    const previousTitle = document.title
    document.title = documentTitle

    return () => {
      document.title = previousTitle
    }
  }, [resumen, documentTitle])

  if (loading) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando informe...
        </div>
      </ProtectedModuleRoute>
    )
  }

  if (error || !resumen || !detalle) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            {error || 'No se encontró la OT.'}
          </div>
          <Link
            href={`/ot/${otId}`}
            className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver a la OT
          </Link>
        </div>
      </ProtectedModuleRoute>
    )
  }

  const equipoUbicacion = buildLocation(resumen)
  const equipoCaracteristicas = buildEquipoCaracteristicas(resumen)

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="screen-actions">
        <Link href={`/ot/${otId}`} className="action-secondary">
          Volver a la OT
        </Link>
        <button
          type="button"
          onClick={() => {
            document.title = documentTitle
            window.print()
          }}
          className="action-primary"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <main className="report-page">
        <style jsx global>{`
          body {
            background: #f1f5f9;
          }

          .screen-actions {
            max-width: 980px;
            margin: 0 auto 16px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }

          .action-primary,
          .action-secondary {
            border-radius: 14px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            border: 1px solid #cbd5e1;
            cursor: pointer;
          }

          .action-primary {
            background: #163a5f;
            color: #ffffff;
            border-color: #163a5f;
          }

          .action-secondary {
            background: #ffffff;
            color: #334155;
          }

          .report-page {
            max-width: 980px;
            margin: 0 auto;
            background: #ffffff;
            color: #0f172a;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
            border-radius: 24px;
            overflow: hidden;
            font-family: Arial, Helvetica, sans-serif;
          }

          .report-header {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            align-items: center;
            gap: 24px;
            padding: 28px 34px 22px;
            border-bottom: 4px solid #163a5f;
          }

          .logo-wrap {
            height: 82px;
            display: flex;
            align-items: center;
          }

          .logo-wrap.right {
            justify-content: flex-end;
          }

          .logo-wrap img {
            max-height: 76px;
            max-width: 210px;
            object-fit: contain;
          }

          .header-title {
            text-align: center;
          }

          .header-title p {
            margin: 0;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .header-title h1 {
            margin: 8px 0 0;
            color: #0f172a;
            font-size: 24px;
            line-height: 1.15;
            font-weight: 900;
            text-transform: uppercase;
          }

          .header-title strong {
            display: block;
            margin-top: 8px;
            font-size: 14px;
            color: #163a5f;
          }

          .report-body {
            padding: 28px 34px 34px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            border: 1px solid #dbe3ea;
            border-radius: 18px;
            overflow: hidden;
            margin-bottom: 22px;
          }

          .summary-grid .field {
            border-right: 1px solid #dbe3ea;
            border-bottom: 1px solid #dbe3ea;
          }

          .summary-grid .field:nth-child(4n) {
            border-right: 0;
          }

          .field {
            min-height: 62px;
            padding: 11px 13px;
          }

          .field span {
            display: block;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .field strong {
            display: block;
            margin-top: 5px;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.35;
            font-weight: 800;
          }

          .section-block {
            margin-top: 18px;
            break-inside: avoid;
          }

          .section-block h2 {
            margin: 0 0 10px;
            padding: 9px 12px;
            color: #ffffff;
            background: #163a5f;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .three-col {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          .text-box {
            border: 1px solid #dbe3ea;
            border-radius: 14px;
            padding: 13px 14px;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.55;
            white-space: pre-wrap;
            background: #ffffff;
          }

          .muted {
            color: #94a3b8;
            font-style: italic;
          }

          .reception-table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 14px;
            font-size: 12px;
          }

          .reception-table th,
          .reception-table td {
            border: 1px solid #dbe3ea;
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }

          .reception-table th {
            background: #f8fafc;
            color: #475569;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .checkbox-cell {
            width: 46px;
            text-align: center !important;
            font-weight: 800;
            color: #64748b;
          }

          .evidence-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .evidence-card {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            overflow: hidden;
            break-inside: avoid;
          }

          .evidence-card img {
            width: 100%;
            height: 230px;
            object-fit: cover;
            display: block;
            background: #f8fafc;
          }

          .evidence-card p {
            margin: 0;
            padding: 10px 12px;
            font-size: 12px;
            color: #475569;
          }

          .firma-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }

          .firma-box {
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            padding: 14px;
            min-height: 160px;
          }

          .firma-title {
            margin: 0;
            color: #163a5f;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .firma-area {
            height: 72px;
            border-bottom: 1px solid #94a3b8;
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #cbd5e1;
            font-size: 12px;
          }

          .firma-area img {
            max-height: 64px;
            max-width: 100%;
            object-fit: contain;
          }

          .firma-name {
            margin: 4px 0 0;
            color: #0f172a;
            font-size: 13px;
            font-weight: 800;
          }

          .firma-role {
            margin: 2px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .footer-note {
            margin-top: 22px;
            border-top: 1px solid #dbe3ea;
            padding-top: 12px;
            color: #64748b;
            font-size: 11px;
            text-align: center;
          }

          @page {
            size: A4;
            margin: 10mm;
          }

          @media print {
            body {
              background: #ffffff !important;
            }

            .screen-actions,
            aside,
            header,
            nav {
              display: none !important;
            }

            .report-page {
              max-width: none;
              width: 100%;
              margin: 0;
              box-shadow: none;
              border-radius: 0;
            }

            .report-header {
              padding: 0 0 16px;
            }

            .report-body {
              padding: 18px 0 0;
            }

            .section-block {
              page-break-inside: avoid;
            }

            .evidence-card img {
              height: 190px;
            }
          }
        `}</style>

        <header className="report-header">
          <div className="logo-wrap">
            <img src={DYF_LOGO} alt="DyF Ingeniería y Mantenimiento Industrial" />
          </div>

          <div className="header-title">
            <p>Informe de OM</p>
            <h1>Orden de Trabajo / Informe Técnico</h1>
            <strong>{labelOrDash(resumen.folio)}</strong>
          </div>

          <div className="logo-wrap right">
            <img src={SOFTYS_LOGO} alt="Softys" />
          </div>
        </header>

        <div className="report-body">
          <div className="summary-grid">
            <Field label="Cliente final" value={resumen.cliente_nombre || 'Softys'} />
            <Field label="Empresa contratista" value="DyF Ingeniería y Mantenimiento Industrial" />
            <Field label="Tipo de servicio" value={resumen.tipo_servicio_nombre} />
            <Field label="Estado" value={resumen.estado_nombre} />
            <Field label="Fecha OT" value={formatDate(detalle.fecha_ot)} />
            <Field label="Fecha programada" value={formatDate(detalle.fecha_programada)} />
            <Field label="Inicio" value={formatDateTime(detalle.hora_inicio)} />
            <Field label="Término" value={formatDateTime(detalle.hora_termino)} />
            <Field label="Duración" value={formatMinutes(detalle.duracion_minutos)} />
            <Field label="Responsable Softys / receptor" value={detalle.contacto_cliente_nombre || detalle.cliente_nombre_firma} />
            <Field label="Cargo receptor" value={detalle.contacto_cliente_cargo || detalle.cliente_cargo_firma} />
            <Field label="Área de trabajo" value={detalle.area_trabajo || resumen.equipo_area} />
          </div>

          <Section title="Equipo / motor intervenido">
            <div className="summary-grid">
              <Field label="TAG" value={resumen.equipo_tag} />
              <Field label="Equipo" value={resumen.equipo_nombre || resumen.equipo_descripcion} />
              <Field label="Tipo" value={resumen.equipo_tipo} />
              <Field label="Potencia" value={resumen.equipo_potencia} />
              <Field label="Ubicación" value={equipoUbicacion} />
              <Field label="Marca / Modelo" value={equipoCaracteristicas} />
              <Field label="Serie" value={resumen.equipo_serie} />
              <Field label="Planta" value={resumen.equipo_planta} />
            </div>
          </Section>

          <Section title="Descripción y alcance del trabajo">
            <div className="two-col">
              <div>
                <p className="label-title">Descripción / solicitud</p>
                <TextBox value={detalle.descripcion_solicitud || detalle.titulo} minHeight={105} />
              </div>
              <div>
                <p className="label-title">Problema reportado / diagnóstico</p>
                <TextBox value={detalle.problema_reportado || detalle.diagnostico} minHeight={105} />
              </div>
            </div>
          </Section>

          <Section title="Detalle de trabajo realizado">
            <TextBox value={detalle.trabajo_realizado || detalle.resultado_servicio} minHeight={125} />

            <div className="two-col" style={{ marginTop: 12 }}>
              <div>
                <p className="label-title">Hallazgos</p>
                <TextBox value={detalle.hallazgos} minHeight={80} />
              </div>
              <div>
                <p className="label-title">Conclusiones técnicas</p>
                <TextBox value={detalle.conclusiones_tecnicas} minHeight={80} />
              </div>
            </div>
          </Section>

          <Section title="Equipo de trabajo / horas hombre">
            {tiempos.length > 0 ? (
              <table className="reception-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Término</th>
                    <th>Duración</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {tiempos.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.fecha)}</td>
                      <td>{labelOrDash(item.tipo_tiempo)}</td>
                      <td>{formatDateTime(item.hora_inicio)}</td>
                      <td>{formatDateTime(item.hora_termino)}</td>
                      <td>{formatMinutes(item.duracion_minutos)}</td>
                      <td>{labelOrDash(item.observacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <TextBox value={null} minHeight={60} />
            )}
          </Section>

          <Section title="Herramientas y materiales utilizados">
            <TextBox
              value={detalle.observaciones_cierre}
              minHeight={85}
            />
          </Section>

          <Section title="Recomendaciones de seguridad y observaciones">
            <TextBox value={detalle.recomendaciones} minHeight={90} />
          </Section>

          <Section title="Checklist de recepción del trabajo - Responsable Softys">
            <table className="reception-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Descripción</th>
                  <th className="checkbox-cell">Sí</th>
                  <th className="checkbox-cell">No</th>
                </tr>
              </thead>
              <tbody>
                {[
                  'Alcance del trabajo: ¿Se ejecutó todo lo solicitado?',
                  'Limpieza y orden: ¿Se retiraron residuos y herramientas, dejando la zona limpia?',
                  'Seguridad: ¿Se respetan las normas de seguridad y protocolos?',
                  'Tiempo de ejecución: ¿Se completó dentro del plazo acordado?',
                  'Funcionamiento y pruebas: ¿Se verificó el correcto funcionamiento de lo ejecutado dentro de lo posible?',
                ].map((item, index) => (
                  <tr key={item}>
                    <td>{index + 1}</td>
                    <td>{item}</td>
                    <td className="checkbox-cell">□</td>
                    <td className="checkbox-cell">□</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12 }}>
              <p className="label-title">Evaluación general</p>
              <table className="reception-table">
                <tbody>
                  <tr>
                    <td>Deficiente □</td>
                    <td>Malo □</td>
                    <td>Regular □</td>
                    <td>Bueno □</td>
                    <td>Excelente □</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Evidencias fotográficas">
            {evidenciasImagenes.length > 0 ? (
              <div className="evidence-grid">
                {evidenciasImagenes.map((item) => (
                  <div className="evidence-card" key={item.id}>
                    {item.archivo_url ? (
                      <img src={item.archivo_url} alt={item.descripcion || item.archivo_nombre || 'Evidencia'} />
                    ) : null}
                    <p>{item.descripcion || item.archivo_nombre || 'Evidencia'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <TextBox value={null} minHeight={70} />
            )}
          </Section>

          <Section title="Firmas">
            <div className="firma-grid">
              <FirmaBox
                title="Nombre y firma responsable Softys"
                nombre={firmaCliente?.nombre_firmante || detalle.cliente_nombre_firma}
                cargo={firmaCliente?.cargo_firmante || detalle.cliente_cargo_firma}
                firmaUrl={firmaCliente?.firma_url}
              />

              <FirmaBox
                title="Firma supervisor contratista"
                nombre={firmaSupervisor?.nombre_firmante || firmaTecnico?.nombre_firmante}
                cargo={firmaSupervisor?.cargo_firmante || firmaTecnico?.cargo_firmante || 'Supervisor / Técnico DyF'}
                firmaUrl={firmaSupervisor?.firma_url || firmaTecnico?.firma_url}
              />
            </div>
          </Section>

          <p className="footer-note">
            Informe generado desde Auren OT. Este documento respalda técnicamente la intervención indicada
            y debe ser revisado por el responsable del trabajo.
          </p>
        </div>
      </main>
    </ProtectedModuleRoute>
  )
}
