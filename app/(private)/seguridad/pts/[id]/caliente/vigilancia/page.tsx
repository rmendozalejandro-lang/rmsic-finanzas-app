'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PTSAccessGuard from '../../../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../../../lib/supabase/client'
import { VIGILANCIA_POST_CHECKLIST } from '../../../../../../../lib/pts/caliente-checklist'

const STORAGE_KEY = 'empresa_activa_id'
type Respuesta = 'si' | 'no' | ''
type Vigilancia = {
  id: string
  estado: string
  iniciado_at: string | null
  finalizado_at: string | null
  minutos_minimos: number
  verificaciones: { codigo: string; respuesta: string }[] | null
  vigia_incendios_nombre: string | null
  emisor_notificado_nombre: string | null
  incidencias: string | null
  conclusion: string | null
  acciones_correctivas: string | null
  responsable_mantencion: string | null
  responsable_prevencion: string | null
}

type Permiso = { estado: string }

export default function VigilanciaPostTrabajoPage() {
  const params = useParams<{ id: string }>()
  const permisoId = params.id
  const [permiso, setPermiso] = useState<Permiso | null>(null)
  const [vigilancia, setVigilancia] = useState<Vigilancia | null>(null)
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({})
  const [emisor, setEmisor] = useState('')
  const [incidencias, setIncidencias] = useState('')
  const [conclusion, setConclusion] = useState<'cumple' | 'requiere_acciones'>('cumple')
  const [acciones, setAcciones] = useState('')
  const [responsableMantencion, setResponsableMantencion] = useState('')
  const [responsablePrevencion, setResponsablePrevencion] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

      const permisoResp = await supabase.from('pts_permisos').select('estado').eq('id', permisoId).eq('empresa_id', empresaId).single()
      if (permisoResp.error) throw permisoResp.error

      const compResp = await supabase.from('pts_permisos_complementarios').select('id').eq('permiso_id', permisoId).eq('empresa_id', empresaId).eq('tipo', 'caliente').eq('requerido', true).maybeSingle()
      if (compResp.error) throw compResp.error
      if (!compResp.data) throw new Error('Este PTS no requiere Trabajo en Caliente.')

      const vigResp = await supabase.from('pts_vigilancia_post_trabajo').select('*').eq('permiso_complementario_id', compResp.data.id).eq('empresa_id', empresaId).maybeSingle()
      if (vigResp.error) throw vigResp.error

      const vig = vigResp.data as Vigilancia | null
      setPermiso(permisoResp.data as Permiso)
      setVigilancia(vig)
      if (vig) {
        const map: Record<string, Respuesta> = {}
        for (const item of vig.verificaciones ?? []) map[item.codigo] = item.respuesta as Respuesta
        setRespuestas(map)
        setEmisor(vig.emisor_notificado_nombre ?? '')
        setIncidencias(vig.incidencias ?? '')
        setConclusion((vig.conclusion as 'cumple' | 'requiere_acciones' | null) ?? 'cumple')
        setAcciones(vig.acciones_correctivas ?? '')
        setResponsableMantencion(vig.responsable_mantencion ?? '')
        setResponsablePrevencion(vig.responsable_prevencion ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la vigilancia post trabajo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [permisoId])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const segundosTranscurridos = vigilancia?.iniciado_at ? Math.max(0, Math.floor((now - new Date(vigilancia.iniciado_at).getTime()) / 1000)) : 0
  const minimoSegundos = Math.max(vigilancia?.minutos_minimos ?? 60, 60) * 60
  const segundosRestantes = Math.max(0, minimoSegundos - segundosTranscurridos)
  const puedeFinalizarTiempo = Boolean(vigilancia?.iniciado_at && segundosRestantes === 0)
  const respuestasCompletas = VIGILANCIA_POST_CHECKLIST.every((item) => Boolean(respuestas[item.codigo]))
  const existeNo = VIGILANCIA_POST_CHECKLIST.some((item) => respuestas[item.codigo] === 'no')
  const minutos = Math.floor(segundosRestantes / 60)
  const segundos = segundosRestantes % 60
  const vigilanciaCerrada = vigilancia?.estado === 'completa' || vigilancia?.estado === 'observada'

  const iniciar = async () => {
    try {
      setActing(true); setError(''); setSuccess('')
      const { error: rpcError } = await supabase.rpc('pts_iniciar_vigilancia_post_trabajo', { p_permiso_id: permisoId })
      if (rpcError) throw new Error(rpcError.message)
      setSuccess('Vigilancia post trabajo iniciada. El plazo mínimo de 60 minutos comenzó a contabilizarse en el servidor.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar la vigilancia.') }
    finally { setActing(false) }
  }

  const finalizar = async () => {
    setError(''); setSuccess('')
    if (!respuestasCompletas) return setError('Debes responder las 4 verificaciones antes de finalizar.')
    if (!puedeFinalizarTiempo) return setError('Aún no se cumplen los 60 minutos mínimos de vigilancia.')
    if (existeNo && incidencias.trim().length < 3) return setError('Registra las incidencias detectadas durante la vigilancia.')
    if (!emisor.trim()) return setError('Debes registrar a quién se notificó como emisor del permiso.')
    if ((existeNo || conclusion === 'requiere_acciones') && acciones.trim().length < 10) return setError('Las desviaciones requieren acciones correctivas detalladas.')
    if (!responsableMantencion.trim() || !responsablePrevencion.trim()) return setError('Debes identificar responsables de Mantención y Prevención.')

    try {
      setActing(true)
      const verificaciones = VIGILANCIA_POST_CHECKLIST.map((item) => ({ codigo: item.codigo, respuesta: respuestas[item.codigo] }))
      const { error: rpcError } = await supabase.rpc('pts_finalizar_vigilancia_post_trabajo', {
        p_permiso_id: permisoId,
        p_verificaciones: verificaciones,
        p_incidencias: incidencias.trim() || null,
        p_emisor_notificado_nombre: emisor.trim(),
        p_conclusion: conclusion,
        p_acciones_correctivas: acciones.trim() || null,
        p_responsable_mantencion: responsableMantencion.trim(),
        p_responsable_prevencion: responsablePrevencion.trim(),
      })
      if (rpcError) throw new Error(rpcError.message)
      setSuccess(conclusion === 'cumple' && !existeNo ? 'Vigilancia completada. El área quedó liberada para continuar con el cierre del PTS.' : 'Vigilancia registrada con observaciones. El PTS permanece bloqueado para cierre.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo finalizar la vigilancia.') }
    finally { setActing(false) }
  }

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <Link href={`/seguridad/pts/${permisoId}/caliente`} className="text-sm font-medium text-slate-500 hover:text-slate-900">← Volver al permiso de Trabajo en Caliente</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">SGSST-PO15-REG 02 · Versión 5</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Vigilancia post trabajo</h1>
          <p className="mt-2 text-sm text-slate-500">Control obligatorio posterior al trabajo en caliente. Duración mínima: 60 minutos reales.</p>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Cargando vigilancia...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}

        {!loading ? <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estado</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{vigilancia?.estado === 'completa' ? 'Completa' : vigilancia?.estado === 'observada' ? 'Observada' : vigilancia?.estado === 'en_curso' ? 'En curso' : 'Pendiente'}</p>
                {vigilancia?.vigia_incendios_nombre ? <p className="mt-1 text-sm text-slate-500">Vigía de Incendios: {vigilancia.vigia_incendios_nombre}</p> : null}
              </div>
              {!vigilancia?.iniciado_at ? <button onClick={iniciar} disabled={acting || permiso?.estado !== 'en_ejecucion'} className="rounded-xl bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{acting ? 'Procesando...' : 'Iniciar vigilancia'}</button> : null}
            </div>
            {permiso?.estado !== 'en_ejecucion' && !vigilancia?.iniciado_at ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">La vigilancia solo puede comenzar cuando el PTS se encuentre en ejecución y haya finalizado la labor en caliente.</p> : null}
            {vigilancia?.iniciado_at && !vigilanciaCerrada ? <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-5"><p className="text-sm font-semibold text-cyan-900">Tiempo mínimo restante</p><p className="mt-1 text-4xl font-semibold tabular-nums text-cyan-950">{String(minutos).padStart(2,'0')}:{String(segundos).padStart(2,'0')}</p><p className="mt-2 text-xs text-cyan-700">El tiempo definitivo se valida en el servidor; modificar el reloj del navegador no permite adelantar el cierre.</p></div> : null}
          </section>

          {vigilancia?.iniciado_at ? <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Verificaciones durante la vigilancia</h2>
              <div className="mt-5 space-y-4">{VIGILANCIA_POST_CHECKLIST.map((item) => <div key={item.codigo} className={`rounded-2xl border p-4 ${respuestas[item.codigo] === 'no' ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-xs font-semibold text-slate-400">{item.codigo}</span><p className="mt-1 text-sm font-medium text-slate-900">{item.pregunta}</p></div><div className="flex gap-2">{(['si','no'] as const).map((value) => <button key={value} type="button" onClick={() => setRespuestas((current) => ({...current,[item.codigo]:value}))} disabled={vigilanciaCerrada} className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60 ${respuestas[item.codigo] === value ? value === 'si' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{value === 'si' ? 'Sí' : 'No'}</button>)}</div></div></div>)}</div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Cierre de la verificación</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Notificación al emisor<input value={emisor} onChange={(e) => setEmisor(e.target.value)} disabled={vigilanciaCerrada} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <label className="text-sm font-medium text-slate-700">Responsable Mantención<input value={responsableMantencion} onChange={(e) => setResponsableMantencion(e.target.value)} disabled={vigilanciaCerrada} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <label className="text-sm font-medium text-slate-700">Responsable Prevención<input value={responsablePrevencion} onChange={(e) => setResponsablePrevencion(e.target.value)} disabled={vigilanciaCerrada} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <label className="text-sm font-medium text-slate-700">Conclusión<select value={conclusion} onChange={(e) => setConclusion(e.target.value as 'cumple' | 'requiere_acciones')} disabled={vigilanciaCerrada} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-50"><option value="cumple">Cumple condiciones de seguridad</option><option value="requiere_acciones">Requiere acciones correctivas</option></select></label>
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Incidencias<textarea value={incidencias} onChange={(e) => setIncidencias(e.target.value)} disabled={vigilanciaCerrada} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" /></label>
              <label className="mt-4 block text-sm font-medium text-slate-700">Acciones correctivas<textarea value={acciones} onChange={(e) => setAcciones(e.target.value)} disabled={vigilanciaCerrada} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" /></label>
              {!vigilanciaCerrada ? <button onClick={finalizar} disabled={acting || !puedeFinalizarTiempo} className="mt-5 rounded-xl bg-[#0B2947] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{acting ? 'Procesando...' : puedeFinalizarTiempo ? 'Finalizar vigilancia' : 'Esperando 60 minutos mínimos'}</button> : null}
            </section>

            {vigilancia.estado === 'completa' ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><strong>Área liberada:</strong> vigilancia post trabajo completada sin desviaciones bloqueantes. El PTS puede continuar a su cierre general.</section> : null}
            {vigilancia.estado === 'observada' ? <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><strong>Cierre bloqueado:</strong> la vigilancia terminó con desviaciones o acciones correctivas. El PTS no puede cerrarse hasta resolver la condición.</section> : null}
          </> : null}
        </> : null}
      </main>
    </PTSAccessGuard>
  )
}
