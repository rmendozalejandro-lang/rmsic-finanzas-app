'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import PTSAccessGuard from '../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

type Permiso = {
  id: string
  folio: number | null
  estado: string
  trabajo_a_realizar: string
  tipo_actividad: string
  lugar_ejecucion: string
  empresa_contratista: string
  fecha_inicio: string
  fecha_termino: string | null
  hora_inicio: string | null
  hora_termino: string | null
  observaciones: string | null
}

type Riesgo = {
  id: string
  paso: number
  actividad: string
  peligros: string
  riesgos: string
  medidas_preventivas: string
}

type Persona = {
  id: string
  nombre_apellido: string
  rut: string
  induccion_ingreso_ok: boolean
  charla_5_min_ok: boolean
  examen_altura_vigente_hasta: string | null
}

type Epp = { id: string; nombre: string; requerido: boolean }
type Aprobacion = {
  etapa: string
  estado: string
  observacion: string | null
  nombre_firmante: string | null
  cargo_firmante: string | null
  firmado_at: string | null
}
type Historial = { id: string; evento: string; detalle: string | null; created_at: string }

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  observado: 'Observado',
  aprobado: 'Aprobado',
  en_ejecucion: 'En ejecución',
  cerrado: 'Cerrado',
  rechazado: 'Rechazado',
}

const ETAPA_LABEL: Record<string, string> = {
  supervisor_contratista: 'Supervisor contratista',
  coordinador_contratista: 'Coordinador contratista',
  jefatura_area: 'Jefatura del área',
  seguridad: 'Seguridad y Salud en el Trabajo',
}

export default function PTSDetallePage() {
  const params = useParams<{ id: string }>()
  const permisoId = params.id
  const [permiso, setPermiso] = useState<Permiso | null>(null)
  const [riesgos, setRiesgos] = useState<Riesgo[]>([])
  const [personal, setPersonal] = useState<Persona[]>([])
  const [epp, setEpp] = useState<Epp[]>([])
  const [aprobaciones, setAprobaciones] = useState<Aprobacion[]>([])
  const [historial, setHistorial] = useState<Historial[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [observacionRevision, setObservacionRevision] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

      const [permisoResp, riesgosResp, personalResp, eppResp, aprobResp, historialResp] = await Promise.all([
        supabase.from('pts_permisos').select('*').eq('id', permisoId).eq('empresa_id', empresaId).single(),
        supabase.from('pts_analisis_riesgos').select('id,paso,actividad,peligros,riesgos,medidas_preventivas').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
        supabase.from('pts_personal').select('id,nombre_apellido,rut,induccion_ingreso_ok,charla_5_min_ok,examen_altura_vigente_hasta').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
        supabase.from('pts_epp').select('id,nombre,requerido').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
        supabase.from('pts_aprobaciones').select('etapa,estado,observacion,nombre_firmante,cargo_firmante,firmado_at').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
        supabase.from('pts_historial').select('id,evento,detalle,created_at').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      ])

      const firstError = [permisoResp, riesgosResp, personalResp, eppResp, aprobResp, historialResp].find((result) => result.error)?.error
      if (firstError) throw firstError

      setPermiso(permisoResp.data as Permiso)
      setRiesgos((riesgosResp.data ?? []) as Riesgo[])
      setPersonal((personalResp.data ?? []) as Persona[])
      setEpp((eppResp.data ?? []) as Epp[])
      setAprobaciones((aprobResp.data ?? []) as Aprobacion[])
      setHistorial((historialResp.data ?? []) as Historial[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el PTS.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisoId])

  const checks = useMemo(() => {
    if (!permiso) return []
    return [
      { label: 'Identificación del trabajo', ok: Boolean(permiso.trabajo_a_realizar && permiso.tipo_actividad && permiso.lugar_ejecucion && permiso.empresa_contratista && permiso.fecha_inicio) },
      { label: 'Análisis de riesgos', ok: riesgos.length > 0 && riesgos.every((item) => item.actividad && item.peligros && item.riesgos && item.medidas_preventivas) },
      { label: 'Personal participante', ok: personal.length > 0 && personal.every((item) => item.nombre_apellido && item.rut) },
      { label: 'EPP / elementos de seguridad', ok: epp.some((item) => item.requerido) },
    ]
  }, [permiso, riesgos, personal, epp])

  const completitud = checks.length ? Math.round((checks.filter((item) => item.ok).length / checks.length) * 100) : 0

  const correccionPosterior = useMemo(() => {
    const ultimaObservacion = historial.find((item) => item.evento === 'revision_observada')
    const ultimaCorreccion = historial.find((item) => item.evento === 'correccion_guardada')
    if (!ultimaCorreccion) return false
    if (!ultimaObservacion) return true
    return new Date(ultimaCorreccion.created_at).getTime() > new Date(ultimaObservacion.created_at).getTime()
  }, [historial])

  const puedeEnviar = Boolean(
    permiso &&
      completitud === 100 &&
      (permiso.estado === 'borrador' || (permiso.estado === 'observado' && correccionPosterior))
  )
  const puedeResolver = permiso?.estado === 'en_revision'

  const enviarRevision = async () => {
    try {
      setActing(true)
      setError('')
      setSuccess('')
      const { error: rpcError } = await supabase.rpc('pts_enviar_revision', { p_permiso_id: permisoId })
      if (rpcError) throw new Error(rpcError.message)
      setSuccess('PTS enviado a revisión de Seguridad.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el PTS a revisión.')
    } finally {
      setActing(false)
    }
  }

  const resolver = async (decision: 'aprobar' | 'observar' | 'rechazar') => {
    if ((decision === 'observar' || decision === 'rechazar') && !observacionRevision.trim()) {
      setSuccess('')
      setError('Debes registrar una observación antes de observar o rechazar el PTS.')
      return
    }

    try {
      setActing(true)
      setError('')
      setSuccess('')
      const { error: rpcError } = await supabase.rpc('pts_resolver_revision', {
        p_permiso_id: permisoId,
        p_decision: decision,
        p_observacion: observacionRevision.trim() || null,
      })
      if (rpcError) throw new Error(rpcError.message)
      setSuccess(decision === 'aprobar' ? 'PTS aprobado.' : decision === 'observar' ? 'PTS devuelto con observaciones.' : 'PTS rechazado.')
      setObservacionRevision('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver la revisión.')
    } finally {
      setActing(false)
    }
  }

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/seguridad/pts" className="text-sm font-medium text-slate-500 hover:text-slate-900">← Volver a permisos</Link>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{permiso ? `PTS-${String(permiso.folio ?? 0).padStart(6, '0')}` : 'Permiso de Trabajo Seguro'}</h1>
            {permiso ? <p className="mt-1 text-sm text-slate-500">{permiso.trabajo_a_realizar}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {permiso?.estado === 'observado' ? (
              <Link href={`/seguridad/pts/${permisoId}/editar`} className="inline-flex rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600">Corregir PTS</Link>
            ) : null}
            {permiso ? <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{ESTADO_LABEL[permiso.estado] ?? permiso.estado}</span> : null}
          </div>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando PTS...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}

        {!loading && permiso ? (
          <>
            {permiso.estado === 'observado' && !correccionPosterior ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Este PTS fue observado. Debes corregirlo y guardar la corrección antes de poder reenviarlo a revisión.
              </section>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">I. Identificación</h2>
                <dl className="mt-5 grid gap-4 md:grid-cols-2">
                  <Info label="Trabajo" value={permiso.trabajo_a_realizar} />
                  <Info label="Tipo de actividad" value={permiso.tipo_actividad} />
                  <Info label="Empresa contratista" value={permiso.empresa_contratista} />
                  <Info label="Lugar de ejecución" value={permiso.lugar_ejecucion} />
                  <Info label="Fecha" value={`${permiso.fecha_inicio}${permiso.fecha_termino ? ` → ${permiso.fecha_termino}` : ''}`} />
                  <Info label="Horario" value={`${permiso.hora_inicio || '—'}${permiso.hora_termino ? ` → ${permiso.hora_termino}` : ''}`} />
                </dl>
                {permiso.observaciones ? <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><span className="font-semibold">Observaciones:</span> {permiso.observaciones}</div> : null}
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Prevalidación</p><p className="mt-1 text-3xl font-semibold text-slate-900">{completitud}%</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completitud === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{completitud === 100 ? 'Listo' : 'Incompleto'}</span></div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#18B7A8] transition-all" style={{ width: `${completitud}%` }} /></div>
                <div className="mt-5 space-y-2">{checks.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{item.label}</span><span className={item.ok ? 'text-emerald-600' : 'text-amber-600'}>{item.ok ? '✓' : 'Pendiente'}</span></div>)}</div>
                {permiso.estado === 'observado' && !correccionPosterior ? (
                  <Link href={`/seguridad/pts/${permisoId}/editar`} className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600">Corregir PTS</Link>
                ) : null}
                {puedeEnviar ? <button onClick={enviarRevision} disabled={acting} className="mt-6 w-full rounded-2xl bg-[#18B7A8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#11998E] disabled:opacity-60">{acting ? 'Procesando...' : 'Enviar a revisión'}</button> : null}
              </aside>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">II. Análisis de riesgos</h2>
              <div className="mt-5 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Paso</th><th className="px-4 py-3">Actividad</th><th className="px-4 py-3">Peligros</th><th className="px-4 py-3">Incidentes / riesgos</th><th className="px-4 py-3">Medidas preventivas</th></tr></thead><tbody className="divide-y divide-slate-100">{riesgos.map((item) => <tr key={item.id}><td className="px-4 py-4 font-semibold">{item.paso}</td><td className="px-4 py-4">{item.actividad}</td><td className="px-4 py-4">{item.peligros}</td><td className="px-4 py-4">{item.riesgos}</td><td className="px-4 py-4">{item.medidas_preventivas}</td></tr>)}</tbody></table></div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">III. Personal participante</h2><div className="mt-4 space-y-3">{personal.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="font-medium text-slate-900">{item.nombre_apellido}</div><div className="mt-1 text-sm text-slate-500">RUT {item.rut}</div><div className="mt-3 flex flex-wrap gap-2 text-xs"><Tag ok={item.induccion_ingreso_ok}>Inducción</Tag><Tag ok={item.charla_5_min_ok}>Charla 5 min.</Tag><Tag ok={Boolean(item.examen_altura_vigente_hasta)}>Examen altura {item.examen_altura_vigente_hasta || ''}</Tag></div></div>)}</div></div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">IV. EPP y elementos requeridos</h2><div className="mt-4 flex flex-wrap gap-2">{epp.map((item) => <span key={item.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">✓ {item.nombre}</span>)}</div></div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">V. Aprobaciones</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{aprobaciones.map((item) => <div key={item.etapa} className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">{ETAPA_LABEL[item.etapa] ?? item.etapa}</p><p className="mt-2 text-sm capitalize text-slate-600">{item.estado.replace('_', ' ')}</p>{item.observacion ? <p className="mt-2 text-xs text-slate-500">{item.observacion}</p> : null}</div>)}</div>

              {puedeResolver ? <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5"><h3 className="font-semibold text-slate-900">Revisión de Seguridad</h3><p className="mt-1 text-sm text-slate-600">Aprueba el permiso o devuelve una observación al solicitante.</p><textarea value={observacionRevision} onChange={(e) => setObservacionRevision(e.target.value)} rows={3} placeholder="Observación (obligatoria al observar o rechazar)" className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18B7A8]" /><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => resolver('aprobar')} disabled={acting} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Aprobar</button><button onClick={() => resolver('observar')} disabled={acting} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Observar</button><button onClick={() => resolver('rechazar')} disabled={acting} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Rechazar</button></div></div> : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Trazabilidad</h2><div className="mt-4 space-y-3">{historial.map((item) => <div key={item.id} className="border-l-2 border-slate-200 pl-4"><div className="text-sm font-medium text-slate-800">{item.evento.replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('es-CL')}</div>{item.detalle ? <p className="mt-1 text-sm text-slate-600">{item.detalle}</p> : null}</div>)}</div></section>
          </>
        ) : null}
      </main>
    </PTSAccessGuard>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900">{value || '—'}</dd></div>
}

function Tag({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{ok ? '✓ ' : ''}{children}</span>
}