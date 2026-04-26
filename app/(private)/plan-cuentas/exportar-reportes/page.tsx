'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type ReportType =
  | 'balance'
  | 'estado_resultados'
  | 'libro_mayor'
  | 'asientos'
  | 'movimientos'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const reportes: Record<ReportType, { label: string; view: string; file: string }> = {
  balance: {
    label: 'Balance General',
    view: 'v_balance_general_inicial',
    file: 'balance-general',
  },
  estado_resultados: {
    label: 'Estado de Resultados',
    view: 'v_estado_resultados_contable',
    file: 'estado-resultados',
  },
  libro_mayor: {
    label: 'Libro Mayor',
    view: 'v_libro_mayor_cuenta_contable',
    file: 'libro-mayor',
  },
  asientos: {
    label: 'Asientos Contables',
    view: 'v_asientos_contables_resumen',
    file: 'asientos-contables',
  },
  movimientos: {
    label: 'Movimientos con estado de asiento',
    view: 'v_movimientos_estado_asiento',
    file: 'movimientos-contables',
  },
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getFirstDayOfYearISO() {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/"/g, '""')
  return `"${text}"`
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return ''

  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(csvEscape).join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';')),
  ]

  return lines.join('\n')
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([`\ufeff${content}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExportarReportesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')

  const [reporte, setReporte] = useState<ReportType>('balance')
  const [desde, setDesde] = useState(getFirstDayOfYearISO())
  const [hasta, setHasta] = useState(getTodayISO())
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const accesoPermitido = [
    'admin',
    'gerencia',
    'finanzas',
    'administracion_financiera',
  ].includes(usuarioRol)

  const loadUserContext = async (empresaId: string) => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      setUsuarioRol('')
      return
    }

    const { data: rolData } = await supabase
      .from('usuario_empresas')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .maybeSingle()

    setUsuarioRol(rolData?.rol || '')
  }

  const buildQuery = (reportType: ReportType) => {
    const config = reportes[reportType]
    let query = supabase.from(config.view).select('*').eq('empresa_id', empresaActivaId)

    if (
      reportType === 'estado_resultados' ||
      reportType === 'libro_mayor' ||
      reportType === 'asientos' ||
      reportType === 'movimientos'
    ) {
      if (desde) query = query.gte('fecha', desde)
      if (hasta) query = query.lte('fecha', hasta)
    }

    return query.limit(5000)
  }

  const loadReport = async () => {
    if (!empresaActivaId) {
      setRows([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data, error: reportError } = await buildQuery(reporte)

      if (reportError) throw new Error(reportError.message)

      setRows((data || []) as Record<string, unknown>[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const syncEmpresaActiva = async () => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)

    if (id) {
      await loadUserContext(id)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    void syncEmpresaActiva()

    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  useEffect(() => {
    if (empresaActivaId) void loadReport()
  }, [empresaActivaId, reporte])

  const headers = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0])
  }, [rows])

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      setError('')

      const { data, error: exportError } = await buildQuery(reporte)

      if (exportError) throw new Error(exportError.message)

      const exportRows = (data || []) as Record<string, unknown>[]
      const csv = toCsv(exportRows)

      if (!csv) {
        setError('No hay datos para exportar.')
        return
      }

      const config = reportes[reporte]
      downloadText(`${config.file}-${empresaActivaNombre || 'empresa'}-${getTodayISO()}.csv`, csv)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el reporte.')
    } finally {
      setExporting(false)
    }
  }

  if (!accesoPermitido && !loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para exportar reportes contables.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Contabilidad</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Exportar reportes contables
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Exporta reportes a CSV compatible con Excel o usa imprimir para generar PDF.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || 'Sin empresa activa'}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row print:hidden">
            <Link
              href="/plan-cuentas"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Plan de cuentas
            </Link>

            <Link
              href="/plan-cuentas/dashboard-contable"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 print:hidden">
          {error}
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="grid gap-4 xl:grid-cols-[260px_160px_160px_auto_auto_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reporte
            </label>
            <select
              value={reporte}
              onChange={(event) => setReporte(event.target.value as ReportType)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              {Object.entries(reportes).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
              disabled={reporte === 'balance'}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90] disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
              disabled={reporte === 'balance'}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90] disabled:bg-slate-100"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadReport()}
              className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || rows.length === 0}
              className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? 'Exportando...' : 'Exportar CSV/Excel'}
            </button>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={rows.length === 0}
              className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Imprimir / PDF
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {reportes[reporte].label}
          </h2>
          <p className="text-sm text-slate-500">
            Registros: {rows.length}
            {reporte !== 'balance' ? ` · Período: ${desde} a ${hasta}` : ''}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando reporte...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No hay datos para este reporte.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-3">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.slice(0, 300).map((row, index) => (
                    <tr key={index}>
                      {headers.map((header) => (
                        <td key={header} className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {String(row[header] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length > 300 && (
          <p className="mt-3 text-xs text-slate-500 print:hidden">
            Vista previa limitada a 300 filas. La exportación CSV incluye hasta 5.000 filas.
          </p>
        )}
      </section>
    </main>
  )
}
