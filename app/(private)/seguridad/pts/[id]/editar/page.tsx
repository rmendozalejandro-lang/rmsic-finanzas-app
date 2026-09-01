'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import PTSAccessGuard from '../../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

const EPP_BASE = [
  'Casco de seguridad', 'Arnés de seguridad', 'Calzado de seguridad', 'Máscara para soldar',
  'Cuerda de vida', 'Protector auditivo', 'Guantes de cuero', 'Lentes de seguridad',
  'Extintor', 'Iluminación', 'Bota de goma', 'Guante dieléctrico',
  'Equipo respiratorio autónomo', 'Conos / cinta', 'Biombo', 'Chaleco reflectante',
  'Buzo Tyvek', 'Barbiquejo', 'Traje para soldar', 'Careta facial',
]

type RiesgoRow = { actividad: string; peligros: string; riesgos: string; medidas_preventivas: string }
type PersonaRow = { nombre_apellido: string; rut: string; induccion_ingreso_ok: boolean; charla_5_min_ok: boolean; examen_altura_vigente_hasta: string }

const emptyRisk = (): RiesgoRow => ({ actividad: '', peligros: '', riesgos: '', medidas_preventivas: '' })
const emptyPerson = (): PersonaRow => ({ nombre_apellido: '', rut: '', induccion_ingreso_ok: false, charla_5_min_ok: false, examen_altura_vigente_hasta: '' })

export default function EditarPTSPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const permisoId = params.id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState('')
  const [form, setForm] = useState({ trabajo_a_realizar: '', tipo_actividad: '', lugar_ejecucion: '', empresa_contratista: '', fecha_inicio: '', fecha_termino: '', hora_inicio: '', hora_termino: '', observaciones: '' })
  const [riesgos, setRiesgos] = useState<RiesgoRow[]>([emptyRisk()])
  const [personal, setPersonal] = useState<PersonaRow[]>([emptyPerson()])
  const [epp, setEpp] = useState<string[]>([])
  const [correccion, setCorreccion] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

        const [permisoResp, riesgosResp, personalResp, eppResp] = await Promise.all([
          supabase.from('pts_permisos').select('estado,trabajo_a_realizar,tipo_actividad,lugar_ejecucion,empresa_contratista,fecha_inicio,fecha_termino,hora_inicio,hora_termino,observaciones').eq('id', permisoId).eq('empresa_id', empresaId).single(),
          supabase.from('pts_analisis_riesgos').select('actividad,peligros,riesgos,medidas_preventivas').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
          supabase.from('pts_personal').select('nombre_apellido,rut,induccion_ingreso_ok,charla_5_min_ok,examen_altura_vigente_hasta').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
          supabase.from('pts_epp').select('nombre').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
        ])
        const firstError = [permisoResp, riesgosResp, personalResp, eppResp].find((r) => r.error)?.error
        if (firstError) throw firstError
        if (!permisoResp.data) throw new Error('No se encontró el PTS solicitado.')
        const permisoData = permisoResp.data
        if (permisoData.estado !== 'observado') throw new Error('Solo se puede editar un PTS observado.')
        if (!active) return
        setEstado(permisoData.estado)
        setForm({
          trabajo_a_realizar: permisoData.trabajo_a_realizar || '',
          tipo_actividad: permisoData.tipo_actividad || '',
          lugar_ejecucion: permisoData.lugar_ejecucion || '',
          empresa_contratista: permisoData.empresa_contratista || '',
          fecha_inicio: permisoData.fecha_inicio || '',
          fecha_termino: permisoData.fecha_termino || '',
          hora_inicio: (permisoData.hora_inicio || '').slice(0, 5),
          hora_termino: (permisoData.hora_termino || '').slice(0, 5),
          observaciones: permisoData.observaciones || '',
        })
        setRiesgos((riesgosResp.data ?? []) as RiesgoRow[])
        setPersonal(((personalResp.data ?? []) as PersonaRow[]).map((p) => ({ ...p, examen_altura_vigente_hasta: p.examen_altura_vigente_hasta || '' })))
        setEpp((eppResp.data ?? []).map((item) => item.nombre))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el PTS observado.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [permisoId])

  const riesgosValidos = useMemo(() => riesgos.filter((r) => r.actividad.trim() && r.peligros.trim() && r.riesgos.trim() && r.medidas_preventivas.trim()), [riesgos])
  const personalValido = useMemo(() => personal.filter((p) => p.nombre_apellido.trim() && p.rut.trim()), [personal])
  const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100'

  const updateRisk = (index: number, key: keyof RiesgoRow, value: string) => setRiesgos((rows) => rows.map((r, i) => i === index ? { ...r, [key]: value } : r))
  const updatePerson = (index: number, key: keyof PersonaRow, value: string | boolean) => setPersonal((rows) => rows.map((p, i) => i === index ? { ...p, [key]: value } : p))
  const toggleEpp = (name: string) => setEpp((items) => items.includes(name) ? items.filter((x) => x !== name) : [...items, name])

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!correccion.trim()) { setError('Describe brevemente qué se corrigió antes de guardar.'); return }
    if (!form.trabajo_a_realizar.trim() || !form.tipo_actividad.trim() || !form.lugar_ejecucion.trim() || !form.empresa_contratista.trim() || !form.fecha_inicio) { setError('Completa los datos obligatorios de identificación.'); return }
    if (!riesgosValidos.length || riesgosValidos.length !== riesgos.length) { setError('Todos los pasos del análisis de riesgos deben estar completos.'); return }
    if (!personalValido.length || personalValido.length !== personal.length) { setError('Nombre y RUT son obligatorios para todo el personal.'); return }
    if (!epp.length) { setError('Selecciona al menos un EPP o elemento de seguridad.'); return }

    try {
      setSaving(true)
      const { error: rpcError } = await supabase.rpc('pts_guardar_correccion', {
        p_permiso_id: permisoId,
        p_identificacion: form,
        p_riesgos: riesgos,
        p_personal: personal,
        p_epp: epp,
        p_correccion: correccion.trim(),
      })
      if (rpcError) throw new Error(rpcError.message)
      router.push(`/seguridad/pts/${permisoId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la corrección.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">PTS observado</p><h1 className="mt-1 text-3xl font-semibold text-slate-900">Corregir permiso de trabajo</h1><p className="mt-2 text-sm text-slate-500">Realiza los cambios solicitados y deja trazabilidad de la corrección.</p></div>
          <Link href={`/seguridad/pts/${permisoId}`} className="text-sm font-medium text-slate-600 hover:text-slate-900">← Volver al PTS</Link>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando PTS observado...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!loading && estado === 'observado' ? (
          <form onSubmit={guardar} className="space-y-6">
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-amber-900">Corrección realizada *</h2>
              <p className="mt-1 text-sm text-amber-800">Indica qué cambiaste para responder a la observación de Seguridad.</p>
              <textarea value={correccion} onChange={(e) => setCorreccion(e.target.value)} rows={3} placeholder="Ej.: Se agregó verificación explícita de bloqueo y etiquetado antes de intervenir el motor." className={inputClass} />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">I. Identificación</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Trabajo a realizar *<textarea rows={2} value={form.trabajo_a_realizar} onChange={(e) => setForm({ ...form, trabajo_a_realizar: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Tipo de actividad *<input value={form.tipo_actividad} onChange={(e) => setForm({ ...form, tipo_actividad: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Empresa contratista *<input value={form.empresa_contratista} onChange={(e) => setForm({ ...form, empresa_contratista: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Lugar de ejecución *<input value={form.lugar_ejecucion} onChange={(e) => setForm({ ...form, lugar_ejecucion: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Fecha de inicio *<input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Fecha de término<input type="date" value={form.fecha_termino} onChange={(e) => setForm({ ...form, fecha_termino: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Hora de inicio<input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Hora de término<input type="time" value={form.hora_termino} onChange={(e) => setForm({ ...form, hora_termino: e.target.value })} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Observaciones<textarea rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={inputClass} /></label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">II. Análisis de riesgos</h2><button type="button" onClick={() => setRiesgos([...riesgos, emptyRisk()])} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">+ Agregar paso</button></div>
              <div className="mt-5 space-y-4">{riesgos.map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Paso {index + 1}</span>{riesgos.length > 1 ? <button type="button" onClick={() => setRiesgos(riesgos.filter((_, i) => i !== index))} className="text-xs font-medium text-red-600">Eliminar</button> : null}</div><div className="grid gap-3 lg:grid-cols-4"><label className="text-xs font-semibold uppercase text-slate-500">Actividad<textarea rows={3} value={item.actividad} onChange={(e) => updateRisk(index, 'actividad', e.target.value)} className={inputClass} /></label><label className="text-xs font-semibold uppercase text-slate-500">Peligros<textarea rows={3} value={item.peligros} onChange={(e) => updateRisk(index, 'peligros', e.target.value)} className={inputClass} /></label><label className="text-xs font-semibold uppercase text-slate-500">Riesgos<textarea rows={3} value={item.riesgos} onChange={(e) => updateRisk(index, 'riesgos', e.target.value)} className={inputClass} /></label><label className="text-xs font-semibold uppercase text-slate-500">Medidas preventivas<textarea rows={3} value={item.medidas_preventivas} onChange={(e) => updateRisk(index, 'medidas_preventivas', e.target.value)} className={inputClass} /></label></div></div>)}</div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">III. Personal participante</h2><button type="button" onClick={() => setPersonal([...personal, emptyPerson()])} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">+ Agregar persona</button></div>
              <div className="mt-5 space-y-3">{personal.map((item, index) => <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-5 md:items-end"><label className="text-sm font-medium text-slate-700 md:col-span-2">Nombre y apellido<input value={item.nombre_apellido} onChange={(e) => updatePerson(index, 'nombre_apellido', e.target.value)} className={inputClass} /></label><label className="text-sm font-medium text-slate-700">RUT<input value={item.rut} onChange={(e) => updatePerson(index, 'rut', e.target.value)} className={inputClass} /></label><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={item.induccion_ingreso_ok} onChange={(e) => updatePerson(index, 'induccion_ingreso_ok', e.target.checked)} />Inducción</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={item.charla_5_min_ok} onChange={(e) => updatePerson(index, 'charla_5_min_ok', e.target.checked)} />Charla 5 min.</label><label className="text-sm font-medium text-slate-700 md:col-span-2">Examen altura vigente hasta<input type="date" value={item.examen_altura_vigente_hasta} onChange={(e) => updatePerson(index, 'examen_altura_vigente_hasta', e.target.value)} className={inputClass} /></label>{personal.length > 1 ? <button type="button" onClick={() => setPersonal(personal.filter((_, i) => i !== index))} className="text-sm font-medium text-red-600 md:col-span-3 md:justify-self-end">Eliminar persona</button> : null}</div>)}</div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">IV. EPP y elementos de seguridad</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{EPP_BASE.map((name) => <label key={name} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${epp.includes(name) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}><input type="checkbox" checked={epp.includes(name)} onChange={() => toggleEpp(name)} />{name}</label>)}</div>
            </section>

            <div className="flex flex-wrap justify-end gap-3"><Link href={`/seguridad/pts/${permisoId}`} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Cancelar</Link><button type="submit" disabled={saving} className="rounded-xl bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar corrección'}</button></div>
          </form>
        ) : null}
      </main>
    </PTSAccessGuard>
  )
}