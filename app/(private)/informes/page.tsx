'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import { buttonIconCircle, buttonPrimary, buttonSmall } from '../../../lib/styles/buttons'

const RMSIC_EMPRESA_ID = '557a054c-71ef-4c5f-8637-594755ad669b'
const STORAGE_ID_KEY = 'empresa_activa_id'

type InformeRow = {
  id: string
  codigo: string
  titulo: string
  tipo_informe: string
  subtipo_informe: string | null
  estado: string
  fecha_informe: string
  version: string
  es_version_actual: boolean | null
  cliente_id: string
  ot_id: string | null
  created_at: string
}

function estadoInformeLabel(estado: string) {
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    en_revision: 'En revisión',
    observado: 'Observado',
    aprobado: 'Aprobado',
    emitido: 'Emitido',
    anulado: 'Anulado',
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

function vigenciaInformeLabel(esVersionActual: boolean | null) {
  return esVersionActual === false ? 'Histórica' : 'Actual'
}

function vigenciaInformeClass(esVersionActual: boolean | null) {
  return esVersionActual === false
    ? 'border-slate-200 bg-slate-50 text-slate-600'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function estadoInformeClass(estado: string) {
  const styles: Record<string, string> = {
    borrador: 'border-amber-200 bg-amber-50 text-amber-700',
    emitido: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    anulado: 'border-red-200 bg-red-50 text-red-700',
    en_revision: 'border-sky-200 bg-sky-50 text-sky-700',
    observado: 'border-orange-200 bg-orange-50 text-orange-700',
    aprobado: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  }

  return styles[estado] ?? 'border-slate-200 bg-slate-50 text-slate-600'
}

export default function InformesPage() {
  const [loading, setLoading] = useState(true)
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [informes, setInformes] = useState<InformeRow[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const cargarInformes = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
        setEmpresaActivaId(empresaId)

        if (empresaId !== RMSIC_EMPRESA_ID) {
          setInformes([])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('informes_tecnicos')
          .select(`
            id,
            codigo,
            titulo,
            tipo_informe,
            subtipo_informe,
            estado,
            fecha_informe,
            version,
            es_version_actual,
            cliente_id,
            ot_id,
            created_at
          `)
          .eq('empresa_id', empresaId)
          .order('fecha_informe', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error cargando informes técnicos:', error.message)
          setErrorMessage(error.message)
          setInformes([])
          return
        }

        setInformes((data ?? []) as InformeRow[])
      } catch (error) {
        console.error('Error inesperado cargando informes técnicos:', error)
        setErrorMessage('No se pudieron cargar los informes técnicos.')
      } finally {
        setLoading(false)
      }
    }

    void cargarInformes()
  }, [])

  if (loading) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando informes técnicos...</p>
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
        <p className="mt-3 text-sm leading-6 text-amber-800">
          El módulo Informes Técnicos se encuentra habilitado inicialmente solo para RMSIC.
        </p>
        <Link href="/" className={`${buttonPrimary} mt-5`}>
          Volver al dashboard
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">RMSIC</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Informes Técnicos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Gestión de informes técnicos, levantamientos, mediciones, hallazgos,
            recomendaciones y documentación profesional asociada a servicios técnicos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/informes/plantillas"
            className={`${buttonPrimary} shrink-0 whitespace-nowrap`}
          >
            Administrar plantillas
          </Link>

          <Link
            href="/informes/nuevo"
            className={`${buttonPrimary} shrink-0 gap-2 whitespace-nowrap`}
          >
            <span className={buttonIconCircle}>+</span>
            Nuevo informe
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Listado de informes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Informes registrados para la empresa activa.
          </p>
        </div>

        {informes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              Todavía no existen informes técnicos registrados.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Cuando creemos el primer informe, aparecerá en este listado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Código</th>
                  <th className="px-6 py-3 text-left font-semibold">Versión</th>
                  <th className="px-6 py-3 text-left font-semibold">Vigencia</th>
                  <th className="px-6 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-6 py-3 text-left font-semibold">Título</th>
                  <th className="px-6 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-6 py-3 text-left font-semibold">Estado</th>
                  <th className="px-6 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {informes.map((informe) => (
                  <tr key={informe.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{informe.codigo}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {informe.es_version_actual === false ? 'Versión histórica' : 'Versión vigente'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full border border-[#B8D4EA] bg-[#F4FAFE] px-3 py-1 text-xs font-semibold text-[#163A5F]">
                        v{informe.version}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${vigenciaInformeClass(
                          informe.es_version_actual,
                        )}`}
                      >
                        {vigenciaInformeLabel(informe.es_version_actual)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {informe.fecha_informe}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {informe.titulo}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {tipoInformeLabel(informe.tipo_informe)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${estadoInformeClass(
                          informe.estado,
                        )}`}
                      >
                        {estadoInformeLabel(informe.estado)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/informes/${informe.id}`}
                        className={`${buttonSmall} whitespace-nowrap`}
                      >
                        {informe.es_version_actual === false ? 'Ver histórico' : 'Ver informe'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}