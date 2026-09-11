'use client'

import { useCallback, useEffect, useState } from 'react'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import { supabase } from '../../../../lib/supabase/client'

type Recordatorio = {
  id: string
  movimiento_id: string | null
  cliente_id: string | null
  destinatario: string | null
  asunto: string | null
  estado: string | null
  error: string | null
  enviado_por: string | null
  created_at: string | null
}

type Cliente = {
  id: string
  nombre: string
}

type Movimiento = {
  id: string
  numero_documento: string | null
}

const STORAGE_KEY = 'empresa_activa_id'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function estadoClass(estado: string | null | undefined) {
  return (estado || '').toLowerCase() === 'enviado'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700'
}

function HistorialCobranzaContent() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [rows, setRows] = useState<Recordatorio[]>([])
  const [clientes, setClientes] = useState<Record<string, string>>({})
  const [movimientos, setMovimientos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      setEmpresaActivaId(window.localStorage.getItem(STORAGE_KEY) || '')
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    return () => window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
  }, [])

  const loadData = useCallback(async () => {
    if (!empresaActivaId) return

    try {
      setLoading(true)
      setError('')

      const recordatoriosResp = await supabase
        .from('cobranza_recordatorios')
        .select('id, movimiento_id, cliente_id, destinatario, asunto, estado, error, enviado_por, created_at')
        .eq('empresa_id', empresaActivaId)
        .order('created_at', { ascending: false })

      if (recordatoriosResp.error) {
        throw new Error(`No se pudo cargar el historial: ${recordatoriosResp.error.message}`)
      }

      const recordatorios = (recordatoriosResp.data ?? []) as Recordatorio[]
      setRows(recordatorios)

      const clienteIds = [...new Set(recordatorios.map((r) => r.cliente_id).filter(Boolean))] as string[]
      const movimientoIds = [...new Set(recordatorios.map((r) => r.movimiento_id).filter(Boolean))] as string[]

      const [clientesResp, movimientosResp] = await Promise.all([
        clienteIds.length
          ? supabase.from('clientes').select('id, nombre').in('id', clienteIds)
          : Promise.resolve({ data: [], error: null }),
        movimientoIds.length
          ? supabase.from('movimientos').select('id, numero_documento').in('id', movimientoIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (clientesResp.error) {
        throw new Error(`No se pudieron cargar los clientes: ${clientesResp.error.message}`)
      }

      if (movimientosResp.error) {
        throw new Error(`No se pudieron cargar los documentos: ${movimientosResp.error.message}`)
      }

      const clientesMap: Record<string, string> = {}
      for (const cliente of (clientesResp.data ?? []) as Cliente[]) {
        clientesMap[cliente.id] = cliente.nombre
      }

      const movimientosMap: Record<string, string> = {}
      for (const movimiento of (movimientosResp.data ?? []) as Movimiento[]) {
        movimientosMap[movimiento.id] = movimiento.numero_documento || '-'
      }

      setClientes(clientesMap)
      setMovimientos(movimientosMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }, [empresaActivaId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Historial de recordatorios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registro de correos de cobranza enviados desde Tralixia para la empresa activa.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Cargando historial...</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">{error}</div>
      ) : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Aún no hay recordatorios registrados.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-4 py-3 font-semibold">Fecha / hora</th>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Documento</th>
                      <th className="px-4 py-3 font-semibold">Destinatario</th>
                      <th className="px-4 py-3 font-semibold">Asunto</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 text-slate-700">
                        <td className="whitespace-nowrap px-4 py-3">{formatDateTime(row.created_at)}</td>
                        <td className="px-4 py-3">{row.cliente_id ? clientes[row.cliente_id] || '-' : '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.movimiento_id ? movimientos[row.movimiento_id] || '-' : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[280px] whitespace-normal break-words">{row.destinatario || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[360px] whitespace-normal break-words">{row.asunto || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoClass(row.estado)}`}>
                            {row.estado || '-'}
                          </span>
                          {row.error ? (
                            <div className="mt-1 max-w-[280px] text-xs text-red-600">{row.error}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </main>
  )
}

export default function HistorialCobranzaPage() {
  return (
    <ProtectedModuleRoute moduleKey="cobranza">
      <HistorialCobranzaContent />
    </ProtectedModuleRoute>
  )
}
