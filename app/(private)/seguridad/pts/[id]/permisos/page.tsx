'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import PTSAccessGuard from '../../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

type Complementario = {
  id: string
  tipo: string
  nombre: string
  codigo_fuente: string | null
  estado: string
  requerido: boolean
}

const TIPO_LABEL: Record<string, string> = {
  general: 'Trabajo General',
  altura: 'Trabajo en Altura',
  izaje: 'Maniobras de Izaje',
  excavacion: 'Excavación',
  caliente: 'Trabajo en Caliente',
  otro: 'Otro permiso',
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  completo: 'Completo',
  observado: 'Observado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cerrado: 'Cerrado',
}

function estadoClass(estado: string) {
  if (estado === 'completo' || estado === 'aprobado' || estado === 'cerrado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (estado === 'observado' || estado === 'rechazado') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function PermisosComplementariosPage() {
  const params = useParams<{ id: string }>()
  const permisoId = params.id
  const [rows, setRows] = useState<Complementario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

        const { data, error: queryError } = await supabase
          .from('pts_permisos_complementarios')
          .select('id,tipo,nombre,codigo_fuente,estado,requerido')
          .eq('permiso_id', permisoId)
          .eq('empresa_id', empresaId)
          .eq('requerido', true)
          .order('created_at')

        if (queryError) throw queryError
        if (active) setRows((data ?? []) as Complementario[])
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar los permisos complementarios.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [permisoId])

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">Expediente de seguridad</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Permisos complementarios</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Estos permisos fueron definidos como requeridos durante el AST. Todos deben quedar completos antes de que el expediente pueda pasar a revisión de Seguridad.</p>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando permisos...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="font-semibold text-slate-800">El AST no exige permisos complementarios</h2>
            <p className="mt-2 text-sm text-slate-500">El expediente puede continuar con sus controles generales, análisis de riesgos, personal y EPP.</p>
            <Link href={`/seguridad/pts/${permisoId}`} className="mt-5 inline-flex rounded-xl bg-[#18B7A8] px-4 py-2.5 text-sm font-semibold text-white">Volver al resumen</Link>
          </section>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2">
            {rows.map((item) => {
              const habilitado = item.tipo === 'general'
              const href = item.tipo === 'general' ? `/seguridad/pts/${permisoId}/general` : '#'
              return (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{TIPO_LABEL[item.tipo] ?? item.tipo}</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">{item.nombre}</h2>
                      <p className="mt-1 text-sm text-slate-500">{item.codigo_fuente || 'Sin código documental'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClass(item.estado)}`}>{ESTADO_LABEL[item.estado] ?? item.estado}</span>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    {habilitado ? (
                      <Link href={href} className="inline-flex w-full items-center justify-center rounded-xl bg-[#18B7A8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#11998E]">
                        {item.estado === 'completo' ? 'Revisar / actualizar permiso' : 'Completar permiso'}
                      </Link>
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-500">Formulario específico en siguiente etapa de desarrollo</div>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        ) : null}
      </main>
    </PTSAccessGuard>
  )
}
