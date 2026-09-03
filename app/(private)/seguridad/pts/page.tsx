'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import PTSAccessGuard from '../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

type PTSRow = {
  id: string
  folio: number | null
  estado: string
  trabajo_a_realizar: string
  tipo_actividad: string
  lugar_ejecucion: string
  empresa_contratista: string
  fecha_inicio: string
  fecha_termino: string | null
  created_at: string
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  observado: 'Observado',
  aprobado: 'Aprobado',
  en_ejecucion: 'En ejecución',
  cerrado: 'Cerrado',
  rechazado: 'Rechazado',
}

function estadoClass(estado: string) {
  if (estado === 'aprobado' || estado === 'cerrado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (estado === 'observado' || estado === 'rechazado') return 'border-red-200 bg-red-50 text-red-700'
  if (estado === 'en_revision' || estado === 'en_ejecucion') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export default function PTSPage() {
  const [rows, setRows] = useState<PTSRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('todos')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        if (active) {
          setLoading(true)
          setError('')
          setRows([])
        }

        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

        const { data, error: queryError } = await supabase
          .from('pts_permisos')
          .select('id, folio, estado, trabajo_a_realizar, tipo_actividad, lugar_ejecucion, empresa_contratista, fecha_inicio, fecha_termino, created_at')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })

        if (queryError) throw queryError
        if (active) setRows((data ?? []) as PTSRow[])
      } catch (err) {
        if (active) {
          setRows([])
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los PTS.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    const reload = () => void load()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) reload()
    }

    reload()
    window.addEventListener('empresa-activa-cambiada', reload)
    window.addEventListener('storage', handleStorage)

    return () => {
      active = false
      window.removeEventListener('empresa-activa-cambiada', reload)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const filtered = useMemo(
    () => (filter === 'todos' ? rows : rows.filter((item) => item.estado === filter)),
    [filter, rows]
  )

  const pendientes = rows.filter((item) => item.estado === 'en_revision').length
  const observados = rows.filter((item) => item.estado === 'observado').length
  const aprobados = rows.filter((item) => item.estado === 'aprobado').length
  const cerrados = rows.filter((item) => item.estado === 'cerrado').length

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="overflow-hidden rounded-3xl bg-[#0B2947] p-7 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Seguridad y contratistas</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Permisos de Trabajo Seguro</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">Gestiona solicitudes, revisión, aprobación y trazabilidad de trabajos de contratistas desde una única bandeja.</p>
            </div>
            <Link href="/seguridad/pts/nuevo" className="inline-flex items-center justify-center rounded-2xl bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#11998E]">
              + Nuevo permiso de trabajo
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['Pendientes de revisión', pendientes], ['Observados', observados], ['Aprobados', aprobados], ['Cerrados', cerrados]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bandeja de permisos</h2>
              <p className="mt-1 text-sm text-slate-500">Visualiza rápidamente dónde está detenido cada permiso.</p>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="todos">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="en_revision">En revisión</option>
              <option value="observado">Observado</option>
              <option value="aprobado">Aprobado</option>
              <option value="en_ejecucion">En ejecución</option>
              <option value="cerrado">Cerrado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>

          {loading ? <div className="p-8 text-sm text-slate-500">Cargando permisos...</div> : null}
          {error ? <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-medium text-slate-700">Aún no hay permisos registrados.</p>
              <p className="mt-1 text-sm text-slate-500">Crea el primero para iniciar el piloto PTS.</p>
            </div>
          ) : null}

          {!loading && !error && filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">PTS</th>
                    <th className="px-5 py-3">Trabajo</th>
                    <th className="px-5 py-3">Contratista</th>
                    <th className="px-5 py-3">Lugar</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-semibold text-slate-900">PTS-{String(item.folio ?? 0).padStart(6, '0')}</td>
                      <td className="px-5 py-4"><div className="font-medium text-slate-800">{item.trabajo_a_realizar}</div><div className="mt-1 text-xs text-slate-500">{item.tipo_actividad}</div></td>
                      <td className="px-5 py-4 text-slate-700">{item.empresa_contratista}</td>
                      <td className="px-5 py-4 text-slate-700">{item.lugar_ejecucion}</td>
                      <td className="px-5 py-4 text-slate-700">{item.fecha_inicio}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClass(item.estado)}`}>{ESTADO_LABEL[item.estado] ?? item.estado}</span></td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {item.estado === 'observado' ? (
                            <Link href={`/seguridad/pts/${item.id}/editar`} className="inline-flex rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600">Corregir</Link>
                          ) : null}
                          <Link href={`/seguridad/pts/${item.id}`} className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#18B7A8] hover:text-[#168F86]">Abrir PTS</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </PTSAccessGuard>
  )
}
