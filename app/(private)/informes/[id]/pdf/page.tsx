'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase/client'
import { buttonPrimary } from '../../../../../lib/styles/buttons'

const RMSIC_EMPRESA_ID = '557a054c-71ef-4c5f-8637-594755ad669b'
const STORAGE_ID_KEY = 'empresa_activa_id'
const RESPONSABLE_NOMBRE_DEFAULT = 'Raúl Mendoza Céledon'
const RESPONSABLE_CARGO_DEFAULT = 'Ingeniero de Proyecto / Magíster en Ingeniería Industrial'
const EMPRESA_EMISORA = 'RM Servicios de Ingeniería y Construcción SpA'

type Informe = {
  id: string
  empresa_id: string
  cliente_id: string
  codigo: string
  titulo: string
  tipo_informe: string
  subtipo_informe: string | null
  estado: string
  fecha_informe: string
  fecha_emision: string | null
  version: string | null
  es_version_actual: boolean | null
  motivo_version: string | null
  informe_origen_id: string | null
  version_anterior_id: string | null
  area_ubicacion: string | null
  equipo_tag: string | null
  resumen_ejecutivo: string | null
  antecedentes: string | null
  objetivo: string | null
  alcance: string | null
  metodologia: string | null
  desarrollo: string | null
  analisis_tecnico: string | null
  conclusiones: string | null
  responsable_nombre: string | null
  responsable_cargo: string | null
  responsable_email: string | null
  responsable_telefono: string | null
  destinatario_nombre: string | null
  destinatario_cargo: string | null
  destinatario_email: string | null
  destinatario_area: string | null
}

type Cliente = {
  id: string
  nombre: string | null
  rut: string | null
}

type Medicion = {
  id: string
  fecha_medicion: string | null
  punto_medicion: string | null
  fase: string | null
  parametro: string
  valor: number | null
  unidad: string | null
  observacion: string | null
  orden: number
}

type Hallazgo = {
  id: string
  titulo: string
  descripcion: string | null
  severidad: string | null
  evidencia: string | null
  orden: number
}

type Recomendacion = {
  id: string
  titulo: string
  descripcion: string | null
  prioridad: string | null
  plazo_sugerido: string | null
  requiere_cotizacion: boolean
  orden: number
}

type FotoInforme = {
  id: string
  archivo_url: string
  titulo: string | null
  descripcion: string | null
  fecha_foto: string | null
  visible_en_informe: boolean
  orden: number
  signedUrl?: string | null
}

type AnexoInforme = {
  id: string
  archivo_url: string
  nombre: string
  tipo_anexo: string | null
  descripcion: string | null
  visible_en_informe: boolean
  orden: number
  signedUrl?: string | null
}

function hasText(value?: string | null) {
  return Boolean(value && value.trim().length > 0)
}

function renderParrafosTecnicos(texto?: string | null) {
  if (!hasText(texto)) return null

  return texto
    .trim()
    .split(/(?:\r?\n)\s*(?:\r?\n)/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo, parrafoIndex) => {
      const lineas = parrafo.split(/\r?\n/)

      return (
        <p
          key={`${parrafoIndex}-${parrafo.slice(0, 24)}`}
          className="mb-4 text-justify text-sm leading-7 text-slate-700 last:mb-0 print:leading-[1.7]"
          style={{ textIndent: '1.5rem' }}
        >
          {lineas.map((linea, lineaIndex) => (
            <span key={`${lineaIndex}-${linea.slice(0, 16)}`}>
              {linea}
              {lineaIndex < lineas.length - 1 && <br />}
            </span>
          ))}
        </p>
      )
    })
}

function estadoLabel(estado: string) {
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    emitido: 'Emitido',
    anulado: 'Anulado',
    en_revision: 'En revisión',
    observado: 'Observado',
    aprobado: 'Aprobado',
  }

  return labels[estado] ?? estado
}

function tipoInformeLabel(tipo: string) {
  const labels: Record<string, string> = {
    levantamiento_tecnico: 'Levantamiento técnico',
    mediciones: 'Informe de mediciones',
    mantenimiento: 'Informe de mantenimiento',
    falla: 'Informe de falla',
    consultoria: 'Informe de consultoría',
    avance: 'Informe de avance',
    inspeccion: 'Informe de inspección',
    mejora_propuesta: 'Informe de mejora propuesta',
  }

  return labels[tipo] ?? tipo
}

function prioridadLabel(value?: string | null) {
  if (!value) return ''

  const labels: Record<string, string> = {
    baja: 'Baja',
    media: 'Media',
    alta: 'Alta',
    critica: 'Crítica',
  }

  return labels[value] ?? value
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return ''

  const partes = fecha.split('-')

  if (partes.length !== 3) return fecha

  const [anio, mes, dia] = partes

  return `${dia}-${mes}-${anio}`
}
function formatFechaHora(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-CL')
}

function versionLabel(version?: string | null) {
  if (!version || !version.trim()) return 'Sin versión'

  const versionLimpia = version.trim()

  return versionLimpia.toLowerCase().startsWith('v') ? versionLimpia : `v${versionLimpia}`
}

function fechaEmisionLabel(fechaEmision?: string | null) {
  if (!fechaEmision) return 'Pendiente de emisión'

  return formatFechaHora(fechaEmision)
}

function limpiarNombreArchivo(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:\"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

async function obtenerUrlFirmada(bucket: string, archivoUrl: string) {
  if (!archivoUrl) return null

  if (/^https?:\/\//i.test(archivoUrl)) {
    return archivoUrl
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(archivoUrl, 60 * 60)

  if (error) {
    console.error(`Error generando URL firmada para ${bucket}:`, error.message)
    return null
  }

  return data?.signedUrl || null
}

export default function InformePdfPage() {
  const params = useParams()
  const informeId = String(params.id)

  const [loading, setLoading] = useState(true)
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [informe, setInforme] = useState<Informe | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [mediciones, setMediciones] = useState<Medicion[]>([])
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([])
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([])
  const [fotos, setFotos] = useState<FotoInforme[]>([])
  const [anexos, setAnexos] = useState<AnexoInforme[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
        setEmpresaActivaId(empresaId)

        if (empresaId !== RMSIC_EMPRESA_ID) {
          setLoading(false)
          return
        }

        const { data: informeData, error: informeError } = await supabase
          .from('informes_tecnicos')
          .select('*')
          .eq('id', informeId)
          .eq('empresa_id', empresaId)
          .single()

        if (informeError) {
          setErrorMessage(informeError.message)
          setLoading(false)
          return
        }

        const informeCargado = informeData as Informe
        setInforme(informeCargado)

        const [
          clienteResult,
          medicionesResult,
          hallazgosResult,
          recomendacionesResult,
          fotosResult,
          anexosResult,
        ] = await Promise.all([
          supabase
            .from('clientes')
            .select('id, nombre, rut')
            .eq('id', informeCargado.cliente_id)
            .single(),

          supabase
            .from('informes_mediciones')
            .select('*')
            .eq('informe_id', informeId)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true }),

          supabase
            .from('informes_hallazgos')
            .select('*')
            .eq('informe_id', informeId)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true }),

          supabase
            .from('informes_recomendaciones')
            .select('*')
            .eq('informe_id', informeId)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true }),

          supabase
            .from('informes_fotos')
            .select('id, archivo_url, titulo, descripcion, fecha_foto, visible_en_informe, orden')
            .eq('informe_id', informeId)
            .eq('visible_en_informe', true)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true }),

          supabase
            .from('informes_anexos')
            .select('id, archivo_url, nombre, tipo_anexo, descripcion, visible_en_informe, orden')
            .eq('informe_id', informeId)
            .eq('visible_en_informe', true)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true }),
        ])

        if (!clienteResult.error) {
          setCliente(clienteResult.data as Cliente)
        }

        if (!medicionesResult.error) {
          setMediciones((medicionesResult.data ?? []) as Medicion[])
        }

        if (!hallazgosResult.error) {
          setHallazgos((hallazgosResult.data ?? []) as Hallazgo[])
        }

        if (!recomendacionesResult.error) {
          setRecomendaciones((recomendacionesResult.data ?? []) as Recomendacion[])
        }

        if (!fotosResult.error) {
          const fotosData = (fotosResult.data ?? []) as FotoInforme[]
          const fotosConUrl = await Promise.all(
            fotosData.map(async (foto) => ({
              ...foto,
              signedUrl: await obtenerUrlFirmada('informes-fotos', foto.archivo_url),
            }))
          )

          setFotos(fotosConUrl)
        } else {
          console.error('Error cargando fotos del informe:', fotosResult.error.message)
        }

        if (!anexosResult.error) {
          const anexosData = (anexosResult.data ?? []) as AnexoInforme[]
          const anexosConUrl = await Promise.all(
            anexosData.map(async (anexo) => ({
              ...anexo,
              signedUrl: await obtenerUrlFirmada('informes-anexos', anexo.archivo_url),
            }))
          )

          setAnexos(anexosConUrl)
        } else {
          console.error('Error cargando anexos del informe:', anexosResult.error.message)
        }
      } catch (error) {
        console.error('Error cargando vista PDF:', error)
        setErrorMessage('No se pudo cargar la vista PDF del informe.')
      } finally {
        setLoading(false)
      }
    }

    void cargarDatos()
  }, [informeId])

  const seccionesTexto = useMemo(() => {
    if (!informe) return []

    return [
      { titulo: 'Resumen ejecutivo', contenido: informe.resumen_ejecutivo },
      { titulo: 'Antecedentes', contenido: informe.antecedentes },
      { titulo: 'Objetivo', contenido: informe.objetivo },
      { titulo: 'Alcance', contenido: informe.alcance },
      { titulo: 'Metodología', contenido: informe.metodologia },
      { titulo: 'Desarrollo del levantamiento', contenido: informe.desarrollo },
      { titulo: 'Análisis técnico', contenido: informe.analisis_tecnico },
      { titulo: 'Conclusiones', contenido: informe.conclusiones },
    ].filter((item) => hasText(item.contenido))
  }, [informe])


  const nombreArchivoPdf = useMemo(() => {
    if (!informe) return 'Informe Tecnico RMSIC'

    const partesNombre = [
      'Informe Tecnico',
      informe.codigo,
      cliente?.nombre,
      informe.titulo,
    ].filter((parte): parte is string => hasText(parte))

    return limpiarNombreArchivo(partesNombre.join(' - '))
  }, [cliente, informe])

  useEffect(() => {
    if (!informe) return undefined

    const tituloAnterior = document.title
    document.title = nombreArchivoPdf

    return () => {
      document.title = tituloAnterior
    }
  }, [informe, nombreArchivoPdf])

  const handleImprimirPdf = () => {
    document.title = nombreArchivoPdf
    window.print()
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando vista PDF...</p>
      </section>
    )
  }

  if (empresaActivaId !== RMSIC_EMPRESA_ID) {
    return (
      <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-amber-700">Acceso restringido</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
          Módulo en desarrollo interno
        </h1>
        <Link href="/informes" className={`${buttonPrimary} mt-5`}>
          Volver
        </Link>
      </section>
    )
  }

  if (!informe) {
    return (
      <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">Informe no encontrado</p>
        {errorMessage && <p className="mt-2 text-sm text-red-700">{errorMessage}</p>}
        <Link href="/informes" className={`${buttonPrimary} mt-5`}>
          Volver
        </Link>
      </section>
    )
  }

  const informeVersionLabel = versionLabel(informe.version)
  const esHistorica = informe.es_version_actual === false
  const vigenciaLabel = esHistorica ? 'Histórica' : 'Actual'
  const informeFechaEmisionLabel = fechaEmisionLabel(informe.fecha_emision)

  let numeroSeccion = 1

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .pdf-page {
            min-height: auto !important;
            box-shadow: none !important;
          }

          .pdf-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .pdf-photo-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 1rem !important;
            align-items: start !important;
          }

          .pdf-photo-grid.single {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .pdf-photo-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href={`/informes/${informe.id}`} className={buttonPrimary}>
          Volver al informe
        </Link>

        <button type="button" onClick={handleImprimirPdf} className={buttonPrimary}>
          Imprimir / Guardar PDF
        </button>
      </div>

      <article className="pdf-page relative mx-auto max-w-5xl overflow-hidden bg-white px-12 py-10 text-slate-900 shadow-xl print:max-w-none print:overflow-visible print:px-0 print:py-0 print:shadow-none">
        <div className="relative z-10">
          <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white print:rounded-none print:border-slate-300">
            <div className="grid grid-cols-[1.2fr_0.8fr] print:grid-cols-[1.15fr_0.85fr]">
              <div className="border-r border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-32 shrink-0 items-center justify-center">
                    <img
                      src="/logos/rmsic-logo.png"
                      alt="Logo RMSIC"
                      className="max-h-28 w-auto object-contain"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#163A5F]">
                      Informe Técnico
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      RM Servicios de Ingeniería y Construcción SpA
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Mantenimiento industrial · Automatización · Mediciones técnicas · Diagnóstico operacional
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#F4FAFE] p-6 print:bg-[#F4FAFE]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#163A5F]">
                  Control del documento
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <dt className="font-semibold text-slate-500">Código</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{informe.codigo || 'Sin código'}</dd>
                  </div>

                  <div>
                    <dt className="font-semibold text-slate-500">Versión</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{informeVersionLabel}</dd>
                  </div>

                  <div>
                    <dt className="font-semibold text-slate-500">Estado</dt>
                    <dd className="mt-1 inline-flex rounded-full border border-[#B8D4EA] bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[#163A5F]">
                      {estadoLabel(informe.estado)}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-semibold text-slate-500">Vigencia</dt>
                    <dd className={`mt-1 inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide ${
                      esHistorica
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      {vigenciaLabel}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-semibold text-slate-500">Fecha informe</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{formatearFecha(informe.fecha_informe) || '-'}</dd>
                  </div>

                  <div>
                    <dt className="font-semibold text-slate-500">Fecha de emisión</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{informeFechaEmisionLabel}</dd>
                  </div>
                </dl>

                {esHistorica && (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 print:rounded-none">
                    Este documento corresponde a una versión histórica del informe y se conserva solo para trazabilidad documental.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Título del informe
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#163A5F] print:text-2xl">
                {informe.titulo}
              </h1>
            </div>
          </header>

          <section className="pdf-section mt-8 rounded-[24px] border border-slate-200 bg-white p-6 print:rounded-none print:border-slate-300">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <h2 className="text-base font-semibold uppercase tracking-[0.08em] text-[#163A5F]">
                Datos generales
              </h2>
              <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1 text-xs font-semibold text-[#163A5F]">
                {tipoInformeLabel(informe.tipo_informe)}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm print:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente / Empresa</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {cliente?.nombre || 'Cliente no cargado'}
                  {cliente?.rut ? ` - ${cliente.rut}` : ''}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha informe</dt>
                <dd className="mt-1 font-medium text-slate-900">{formatearFecha(informe.fecha_informe)}</dd>
              </div>

              {hasText(informe.destinatario_nombre) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dirigido a</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.destinatario_nombre}</dd>
                </div>
              )}

              {(hasText(informe.destinatario_cargo) || hasText(informe.destinatario_area)) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cargo / Área</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {[informe.destinatario_cargo, informe.destinatario_area].filter(hasText).join(' / ')}
                  </dd>
                </div>
              )}

              {hasText(informe.destinatario_email) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Correo destinatario</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.destinatario_email}</dd>
                </div>
              )}

              {hasText(informe.fecha_emision) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha emisión</dt>
                  <dd className="mt-1 font-medium text-slate-900">{formatFechaHora(informe.fecha_emision)}</dd>
                </div>
              )}

              {hasText(informe.subtipo_informe) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Subtipo</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.subtipo_informe}</dd>
                </div>
              )}

              {hasText(informe.area_ubicacion) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Área / ubicación</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.area_ubicacion}</dd>
                </div>
              )}

              {hasText(informe.equipo_tag) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Equipo / TAG</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.equipo_tag}</dd>
                </div>
              )}
            </dl>
          </section>

          {seccionesTexto.map((seccion) => (
            <section key={seccion.titulo} className="pdf-section mt-8">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4FAFE] text-sm font-semibold text-[#163A5F] ring-1 ring-[#B8D4EA]">
                  {numeroSeccion++}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">{seccion.titulo}</h2>
              </div>

              <div className="space-y-0">
                {renderParrafosTecnicos(seccion.contenido)}
              </div>
            </section>
          ))}

          {mediciones.length > 0 && (
            <section className="pdf-section mt-8">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4FAFE] text-sm font-semibold text-[#163A5F] ring-1 ring-[#B8D4EA]">
                  {numeroSeccion++}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Mediciones técnicas</h2>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 print:rounded-none">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-[#F4FAFE] text-[#163A5F] print:bg-[#F4FAFE]">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-left font-semibold">Punto</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-left font-semibold">Fase</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-left font-semibold">Parámetro</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-left font-semibold">Valor</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-left font-semibold">Unidad</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 text-left font-semibold">Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediciones.map((medicion) => (
                      <tr key={medicion.id} className="align-top even:bg-slate-50/60 print:even:bg-slate-50/60">
                        <td className="border-b border-slate-100 px-3 py-2.5">{medicion.punto_medicion || '-'}</td>
                        <td className="border-b border-slate-100 px-3 py-2.5">{medicion.fase || '-'}</td>
                        <td className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-900">{medicion.parametro}</td>
                        <td className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-900">
                          {medicion.valor !== null ? medicion.valor : '-'}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2.5">{medicion.unidad || '-'}</td>
                        <td className="border-b border-slate-100 px-3 py-2.5">{medicion.observacion || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {hallazgos.length > 0 && (
            <section className="pdf-section mt-8">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4FAFE] text-sm font-semibold text-[#163A5F] ring-1 ring-[#B8D4EA]">
                  {numeroSeccion++}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Hallazgos técnicos</h2>
              </div>

              <div className="space-y-4">
                {hallazgos.map((hallazgo, index) => (
                  <div key={hallazgo.id} className="rounded-2xl border border-slate-200 bg-white p-4 print:rounded-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {hallazgo.titulo}
                      </p>

                      {hasText(hallazgo.severidad) && (
                        <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1 text-xs font-medium text-[#163A5F]">
                          Severidad: {prioridadLabel(hallazgo.severidad)}
                        </span>
                      )}
                    </div>

                    {hasText(hallazgo.descripcion) && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {hallazgo.descripcion}
                      </p>
                    )}

                    {hasText(hallazgo.evidencia) && (
                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 print:rounded-none">
                        <span className="font-medium text-slate-900">Evidencia:</span> {hallazgo.evidencia}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {fotos.length > 0 && (
            <section className="pdf-section mt-8">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4FAFE] text-sm font-semibold text-[#163A5F] ring-1 ring-[#B8D4EA]">
                  {numeroSeccion++}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Evidencia fotográfica</h2>
              </div>

              <div className={`pdf-photo-grid grid ${fotos.length === 1 ? 'single grid-cols-1' : 'grid-cols-2'} gap-4`}>
                {fotos.map((foto, index) => (
                  <article
                    key={foto.id}
                    className="pdf-photo-card rounded-2xl border border-slate-200 bg-white p-3 shadow-sm print:rounded-none"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Foto {index + 1}
                        </p>

                        {hasText(foto.titulo) && (
                          <p className="mt-1 text-xs font-semibold leading-snug text-slate-900">
                            {foto.titulo}
                          </p>
                        )}
                      </div>

                      {hasText(foto.fecha_foto) && (
                        <span className="whitespace-nowrap rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-2 py-1 text-[10px] font-medium text-[#163A5F]">
                          {formatearFecha(foto.fecha_foto)}
                        </span>
                      )}
                    </div>

                    {foto.signedUrl && (
                      <div className="flex h-[205px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 print:h-[190px]">
                        <img
                          src={foto.signedUrl}
                          alt={foto.titulo || `Foto ${index + 1}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                    {hasText(foto.descripcion) && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {foto.descripcion}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {anexos.length > 0 && (
            <section className="pdf-section mt-8">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4FAFE] text-sm font-semibold text-[#163A5F] ring-1 ring-[#B8D4EA]">
                  {numeroSeccion++}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Anexos</h2>
              </div>

              <div className="space-y-3">
                {anexos.map((anexo, index) => (
                  <div key={anexo.id} className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4 print:rounded-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Anexo {index + 1}: {anexo.nombre}
                      </p>

                      {hasText(anexo.tipo_anexo) && (
                        <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1 text-xs font-medium text-[#163A5F]">
                          {anexo.tipo_anexo}
                        </span>
                      )}
                    </div>

                    {hasText(anexo.descripcion) && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {anexo.descripcion}
                      </p>
                    )}

                    {anexo.signedUrl && (
                      <a
                        href={anexo.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-xs font-semibold text-[#163A5F] underline print:no-underline"
                      >
                        Ver / descargar anexo
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {recomendaciones.length > 0 && (
            <section className="pdf-section mt-8">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4FAFE] text-sm font-semibold text-[#163A5F] ring-1 ring-[#B8D4EA]">
                  {numeroSeccion++}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Recomendaciones técnicas</h2>
              </div>

              <div className="space-y-4">
                {recomendaciones.map((recomendacion, index) => (
                  <div key={recomendacion.id} className="rounded-2xl border border-slate-200 bg-white p-4 print:rounded-none">
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {recomendacion.titulo}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-[#163A5F]">
                      {hasText(recomendacion.prioridad) && (
                        <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1">
                          Prioridad: {prioridadLabel(recomendacion.prioridad)}
                        </span>
                      )}

                      {hasText(recomendacion.plazo_sugerido) && (
                        <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1">
                          Plazo sugerido: {recomendacion.plazo_sugerido}
                        </span>
                      )}

                      {recomendacion.requiere_cotizacion && (
                        <span className="rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1">
                          Requiere cotización posterior
                        </span>
                      )}
                    </div>

                    {hasText(recomendacion.descripcion) && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {recomendacion.descripcion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="pdf-section mt-12 rounded-2xl border border-slate-200 bg-white p-6 print:rounded-none">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Emitido por
            </p>

            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm print:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Responsable técnico</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {informe.responsable_nombre || RESPONSABLE_NOMBRE_DEFAULT}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cargo / Formación</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {informe.responsable_cargo || RESPONSABLE_CARGO_DEFAULT}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Empresa emisora</dt>
                <dd className="mt-1 font-medium text-slate-900">{EMPRESA_EMISORA}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha de emisión</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {informeFechaEmisionLabel}
                </dd>
              </div>

              {hasText(informe.responsable_email) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Correo</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.responsable_email}</dd>
                </div>
              )}

              {hasText(informe.responsable_telefono) && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Teléfono</dt>
                  <dd className="mt-1 font-medium text-slate-900">{informe.responsable_telefono}</dd>
                </div>
              )}
            </div>

            <p className="mt-5 rounded-2xl bg-[#F4FAFE] px-4 py-3 text-xs leading-5 text-slate-600 print:rounded-none">
              Documento técnico emitido por RM Servicios de Ingeniería y Construcción SpA para el cliente y destinatario indicado en los datos generales del informe.
            </p>
          </section>

          <footer className="mt-10 border-t-4 border-[#163A5F] pt-4 text-xs leading-5 text-slate-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium text-slate-700">
                {informe.codigo || 'Sin código'} · Versión {informeVersionLabel} · {estadoLabel(informe.estado)} · Vigencia {vigenciaLabel}
              </p>
              <p>Documento generado desde Tralixia / RMSIC.</p>
            </div>
            <p className="mt-2">
              La información técnica contenida en este informe corresponde a una emisión formal de RMSIC y debe ser revisada por el responsable técnico antes de su envío al cliente.
            </p>
          </footer>
        </div>
      </article>
    </div>
  )
}
