'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

const STORAGE_ID_KEY = 'empresa_activa_id'

type UltimaImportacionRow = {
  importacion_id: string
  empresa_id: string
  cuenta_bancaria_id: string
  banco: string | null
  nombre_cuenta: string | null
  numero_cuenta: string | null
  tipo_cuenta: string | null
  formato: string | null
  nombre_archivo: string | null
  hash_archivo: string | null
  fecha_desde: string | null
  fecha_hasta: string | null
  fecha_minima_real?: string | null
  fecha_maxima_real?: string | null
  total_filas: number | null
  total_validas: number | null
  total_duplicadas: number | null
  total_importadas: number | null
  total_cargos: number | null
  total_abonos: number | null
  estado: string | null
  observacion: string | null
  created_at: string | null
  filas_pendientes: number | null
  filas_conciliadas: number | null
  filas_marcadas_duplicadas: number | null
}

type ImportacionResumenRow = UltimaImportacionRow

type EstadoCarga = 'idle' | 'loading' | 'ready' | 'error'

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'

  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value

  return `${day}-${month}-${year}`
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('es-CL').format(Number(value ?? 0))
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function getCuentaLabel(row: Pick<UltimaImportacionRow, 'banco' | 'nombre_cuenta' | 'numero_cuenta'>) {
  const banco = row.banco || 'Banco sin identificar'
  const cuenta = row.nombre_cuenta || 'Cuenta bancaria'
  const numero = row.numero_cuenta ? ` · ${row.numero_cuenta}` : ''
  return `${banco} · ${cuenta}${numero}`
}

function getFechaDesde(row: Pick<UltimaImportacionRow, 'fecha_desde' | 'fecha_minima_real'>) {
  return row.fecha_desde || row.fecha_minima_real || null
}

function getFechaHasta(row: Pick<UltimaImportacionRow, 'fecha_hasta' | 'fecha_maxima_real'>) {
  return row.fecha_hasta || row.fecha_maxima_real || null
}

function getEstadoLabel(estado?: string | null) {
  if (!estado) return 'Sin estado'

  const labels: Record<string, string> = {
    vista_previa: 'Vista previa',
    pendiente_revision: 'Pendiente revisión',
    procesada: 'Procesada',
    procesada_con_duplicados: 'Procesada con duplicados',
    sin_movimientos: 'Sin movimientos',
    rechazada: 'Rechazada',
    anulada: 'Anulada',
  }

  return labels[estado] || estado.replaceAll('_', ' ')
}

function getEstadoClass(estado?: string | null) {
  if (estado === 'procesada') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (estado === 'sin_movimientos') return 'border-slate-200 bg-slate-50 text-slate-600'
  if (estado === 'rechazada' || estado === 'anulada') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (estado === 'procesada_con_duplicados') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function BancoImportacionesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('idle')
  const [error, setError] = useState('')
  const [ultimasImportaciones, setUltimasImportaciones] = useState<UltimaImportacionRow[]>([])
  const [historial, setHistorial] = useState<ImportacionResumenRow[]>([])

  const cargarDatos = async (empresaId: string) => {
    if (!empresaId) return

    setEstadoCarga('loading')
    setError('')

    const [ultimasResp, historialResp] = await Promise.all([
      supabase
        .from('v_banco_ultima_importacion_por_cuenta')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('banco', { ascending: true })
        .order('nombre_cuenta', { ascending: true }),
      supabase
        .from('v_banco_importaciones_resumen')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (ultimasResp.error || historialResp.error) {
      const message = ultimasResp.error?.message || historialResp.error?.message || 'No se pudo cargar el historial.'
      setError(message)
      setEstadoCarga('error')
      return
    }

    setUltimasImportaciones((ultimasResp.data ?? []) as UltimaImportacionRow[])
    setHistorial((historialResp.data ?? []) as ImportacionResumenRow[])
    setEstadoCarga('ready')
  }

  useEffect(() => {
    const storedEmpresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    setEmpresaActivaId(storedEmpresaId)

    if (storedEmpresaId) {
      void cargarDatos(storedEmpresaId)
    } else {
      setEstadoCarga('ready')
    }
  }, [])

  const resumenGlobal = useMemo(() => {
    return historial.reduce(
      (acc, row) => {
        acc.totalArchivos += 1
        acc.totalFilas += Number(row.total_filas ?? 0)
        acc.totalDuplicadas += Number(row.total_duplicadas ?? row.filas_marcadas_duplicadas ?? 0)
        acc.totalPendientes += Number(row.filas_pendientes ?? 0)
        acc.totalConciliadas += Number(row.filas_conciliadas ?? 0)
        return acc
      },
      {
        totalArchivos: 0,
        totalFilas: 0,
        totalDuplicadas: 0,
        totalPendientes: 0,
        totalConciliadas: 0,
      }
    )
  }, [historial])

  const hayDuplicados = resumenGlobal.totalDuplicadas > 0
  const hayPendientes = resumenGlobal.totalPendientes > 0

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Bancos
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Historial de importaciones bancarias
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Revisa qué archivos bancarios fueron cargados, qué rango de fechas contienen,
                cuántos movimientos quedaron pendientes, conciliados o marcados como duplicados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/bancos"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Volver a bancos
              </Link>
              <button
                type="button"
                onClick={() => empresaActivaId && cargarDatos(empresaActivaId)}
                disabled={estadoCarga === 'loading' || !empresaActivaId}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {estadoCarga === 'loading' ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </section>

        {!empresaActivaId && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            No hay empresa activa seleccionada. Selecciona una empresa para ver sus importaciones bancarias.
          </section>
        )}

        {error && (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {error}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Archivos</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatNumber(resumenGlobal.totalArchivos)}</p>
            <p className="mt-1 text-xs text-slate-500">Últimos 100 registros</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Movimientos</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatNumber(resumenGlobal.totalFilas)}</p>
            <p className="mt-1 text-xs text-slate-500">Filas importadas o revisadas</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Duplicados</p>
            <p className={hayDuplicados ? 'mt-3 text-3xl font-semibold text-amber-600' : 'mt-3 text-3xl font-semibold text-slate-950'}>
              {formatNumber(resumenGlobal.totalDuplicadas)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Detectados por importación</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pendientes</p>
            <p className={hayPendientes ? 'mt-3 text-3xl font-semibold text-blue-600' : 'mt-3 text-3xl font-semibold text-slate-950'}>
              {formatNumber(resumenGlobal.totalPendientes)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Por conciliar</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Conciliados</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-600">{formatNumber(resumenGlobal.totalConciliadas)}</p>
            <p className="mt-1 text-xs text-slate-500">Ya vinculados</p>
          </div>
        </section>

        {hayDuplicados && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            Hay movimientos marcados como duplicados en el historial. Antes de volver a subir una cartola,
            revisa el rango de fechas de la última carga por cuenta para evitar reprocesar archivos antiguos.
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Última importación válida por cuenta
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Úsalo como referencia antes de descargar o subir nuevas cartolas.
              </p>
            </div>
          </div>

          {estadoCarga === 'loading' ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Cargando información...</p>
          ) : ultimasImportaciones.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              Todavía no hay importaciones bancarias registradas para esta empresa.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {ultimasImportaciones.map((row) => {
                const fechaDesde = getFechaDesde(row)
                const fechaHasta = getFechaHasta(row)
                const duplicadas = Number(row.total_duplicadas ?? row.filas_marcadas_duplicadas ?? 0)

                return (
                  <article
                    key={row.importacion_id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">
                          {getCuentaLabel(row)}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Última carga: {formatDateTime(row.created_at)}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getEstadoClass(row.estado)}`}>
                        {getEstadoLabel(row.estado)}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white p-3">
                        <dt className="text-xs text-slate-500">Rango cargado</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(fechaDesde)} al {formatDate(fechaHasta)}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <dt className="text-xs text-slate-500">Archivo</dt>
                        <dd className="mt-1 truncate text-sm font-semibold text-slate-900" title={row.nombre_archivo || ''}>
                          {row.nombre_archivo || 'Sin nombre de archivo'}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <dt className="text-xs text-slate-500">Movimientos</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">
                          {formatNumber(row.total_filas)} filas · {formatNumber(row.filas_conciliadas)} conciliadas · {formatNumber(row.filas_pendientes)} pendientes
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <dt className="text-xs text-slate-500">Duplicados</dt>
                        <dd className={duplicadas > 0 ? 'mt-1 text-sm font-semibold text-amber-700' : 'mt-1 text-sm font-semibold text-slate-900'}>
                          {formatNumber(duplicadas)} detectados
                        </dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Historial de archivos importados
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Revisión de las últimas 100 importaciones registradas en la empresa activa.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Fecha carga</th>
                  <th className="px-5 py-3">Cuenta</th>
                  <th className="px-5 py-3">Archivo</th>
                  <th className="px-5 py-3">Rango</th>
                  <th className="px-5 py-3 text-right">Filas</th>
                  <th className="px-5 py-3 text-right">Duplicadas</th>
                  <th className="px-5 py-3 text-right">Pendientes</th>
                  <th className="px-5 py-3 text-right">Conciliadas</th>
                  <th className="px-5 py-3 text-right">Cargos</th>
                  <th className="px-5 py-3 text-right">Abonos</th>
                  <th className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {estadoCarga === 'loading' ? (
                  <tr>
                    <td className="px-5 py-6 text-slate-500" colSpan={11}>Cargando historial...</td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-slate-500" colSpan={11}>No hay importaciones registradas.</td>
                  </tr>
                ) : (
                  historial.map((row) => {
                    const fechaDesde = getFechaDesde(row)
                    const fechaHasta = getFechaHasta(row)
                    const duplicadas = Number(row.total_duplicadas ?? row.filas_marcadas_duplicadas ?? 0)

                    return (
                      <tr key={row.importacion_id} className="align-top hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="min-w-64 px-5 py-4">
                          <div className="font-medium text-slate-900">{row.banco || 'Banco sin identificar'}</div>
                          <div className="text-xs text-slate-500">{row.nombre_cuenta || 'Cuenta bancaria'} {row.numero_cuenta ? `· ${row.numero_cuenta}` : ''}</div>
                        </td>
                        <td className="max-w-72 px-5 py-4">
                          <div className="truncate font-medium text-slate-900" title={row.nombre_archivo || ''}>
                            {row.nombre_archivo || 'Sin nombre'}
                          </div>
                          <div className="text-xs text-slate-500">{row.formato || 'Formato no definido'}</div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatDate(fechaDesde)} al {formatDate(fechaHasta)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-slate-900">
                          {formatNumber(row.total_filas)}
                        </td>
                        <td className={duplicadas > 0 ? 'whitespace-nowrap px-5 py-4 text-right font-semibold text-amber-700' : 'whitespace-nowrap px-5 py-4 text-right text-slate-600'}>
                          {formatNumber(duplicadas)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                          {formatNumber(row.filas_pendientes)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                          {formatNumber(row.filas_conciliadas)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                          {formatMoney(row.total_cargos)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                          {formatMoney(row.total_abonos)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getEstadoClass(row.estado)}`}>
                            {getEstadoLabel(row.estado)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
