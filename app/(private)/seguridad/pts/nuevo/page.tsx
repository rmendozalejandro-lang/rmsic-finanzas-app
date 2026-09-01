'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PTSAccessGuard from '../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

const EPP_BASE = [
  'Casco de seguridad',
  'Arnés de seguridad',
  'Calzado de seguridad',
  'Máscara para soldar',
  'Cuerda de vida',
  'Protector auditivo',
  'Guantes de cuero',
  'Lentes de seguridad',
  'Extintor',
  'Iluminación',
  'Bota de goma',
  'Guante dieléctrico',
  'Equipo respiratorio autónomo',
  'Conos / cinta',
  'Biombo',
  'Chaleco reflectante',
  'Buzo Tyvek',
  'Barbiquejo',
  'Traje para soldar',
  'Careta facial',
]

type RiesgoRow = {
  actividad: string
  peligros: string
  riesgos: string
  medidas_preventivas: string
}

type PersonaRow = {
  nombre_apellido: string
  rut: string
  induccion_ingreso_ok: boolean
  charla_5_min_ok: boolean
  examen_altura_vigente_hasta: string
}

const emptyRisk = (): RiesgoRow => ({
  actividad: '',
  peligros: '',
  riesgos: '',
  medidas_preventivas: '',
})

const emptyPerson = (): PersonaRow => ({
  nombre_apellido: '',
  rut: '',
  induccion_ingreso_ok: false,
  charla_5_min_ok: false,
  examen_altura_vigente_hasta: '',
})

export default function NuevoPTSPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    trabajo_a_realizar: '',
    tipo_actividad: '',
    lugar_ejecucion: '',
    empresa_contratista: '',
    fecha_inicio: '',
    fecha_termino: '',
    hora_inicio: '',
    hora_termino: '',
    observaciones: '',
  })
  const [riesgos, setRiesgos] = useState<RiesgoRow[]>([emptyRisk(), emptyRisk(), emptyRisk(), emptyRisk()])
  const [personal, setPersonal] = useState<PersonaRow[]>([emptyPerson(), emptyPerson()])
  const [epp, setEpp] = useState<string[]>([])

  const riesgosCompletos = useMemo(
    () => riesgos.filter((item) => item.actividad.trim() && item.peligros.trim() && item.riesgos.trim() && item.medidas_preventivas.trim()),
    [riesgos]
  )

  const personalCompleto = useMemo(
    () => personal.filter((item) => item.nombre_apellido.trim() && item.rut.trim()),
    [personal]
  )

  const updateRisk = (index: number, key: keyof RiesgoRow, value: string) => {
    setRiesgos((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
  }

  const updatePerson = (index: number, key: keyof PersonaRow, value: string | boolean) => {
    setPersonal((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
  }

  const toggleEpp = (name: string) => {
    setEpp((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!form.trabajo_a_realizar.trim() || !form.tipo_actividad.trim() || !form.lugar_ejecucion.trim() || !form.empresa_contratista.trim() || !form.fecha_inicio) {
      setError('Completa los datos obligatorios de identificación del trabajo.')
      return
    }

    if (riesgosCompletos.length === 0) {
      setError('Debes registrar al menos un paso completo del análisis de riesgos.')
      return
    }

    if (personalCompleto.length === 0) {
      setError('Debes registrar al menos una persona participante.')
      return
    }

    try {
      setSaving(true)
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

      const { data: permiso, error: permisoError } = await supabase
        .from('pts_permisos')
        .insert({
          empresa_id: empresaId,
          estado: 'borrador',
          trabajo_a_realizar: form.trabajo_a_realizar.trim(),
          tipo_actividad: form.tipo_actividad.trim(),
          lugar_ejecucion: form.lugar_ejecucion.trim(),
          empresa_contratista: form.empresa_contratista.trim(),
          fecha_inicio: form.fecha_inicio,
          fecha_termino: form.fecha_termino || null,
          hora_inicio: form.hora_inicio || null,
          hora_termino: form.hora_termino || null,
          observaciones: form.observaciones.trim() || null,
        })
        .select('id')
        .single()

      if (permisoError || !permiso) throw permisoError || new Error('No se pudo crear el PTS.')

      const riskRows = riesgosCompletos.map((item, index) => ({
        permiso_id: permiso.id,
        empresa_id: empresaId,
        paso: index + 1,
        orden: index + 1,
        ...item,
      }))

      const personRows = personalCompleto.map((item, index) => ({
        permiso_id: permiso.id,
        empresa_id: empresaId,
        orden: index + 1,
        nombre_apellido: item.nombre_apellido.trim(),
        rut: item.rut.trim(),
        induccion_ingreso_ok: item.induccion_ingreso_ok,
        charla_5_min_ok: item.charla_5_min_ok,
        examen_altura_vigente_hasta: item.examen_altura_vigente_hasta || null,
      }))

      const eppRows = epp.map((nombre, index) => ({
        permiso_id: permiso.id,
        empresa_id: empresaId,
        codigo: `EPP-${String(index + 1).padStart(2, '0')}`,
        nombre,
        requerido: true,
        orden: index + 1,
      }))

      const approvals = [
        ['supervisor_contratista', 1],
        ['coordinador_contratista', 2],
        ['jefatura_area', 3],
        ['seguridad', 4],
      ].map(([etapa, orden]) => ({
        permiso_id: permiso.id,
        empresa_id: empresaId,
        etapa,
        orden,
      }))

      const childResults = await Promise.all([
        supabase.from('pts_analisis_riesgos').insert(riskRows),
        supabase.from('pts_personal').insert(personRows),
        eppRows.length > 0 ? supabase.from('pts_epp').insert(eppRows) : Promise.resolve({ error: null }),
        supabase.from('pts_aprobaciones').insert(approvals),
        supabase.from('pts_historial').insert({ permiso_id: permiso.id, empresa_id: empresaId, evento: 'pts_creado', detalle: 'Permiso creado en estado borrador.' }),
      ])

      const childError = childResults.find((result) => result.error)?.error
      if (childError) throw childError

      router.push('/seguridad/pts')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el PTS.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#18B7A8] focus:ring-4 focus:ring-cyan-100'

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">Nuevo permiso</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Permiso de Trabajo Seguro (PTS)</h1>
            <p className="mt-2 text-sm text-slate-500">Primera versión digital basada en el formato físico utilizado actualmente.</p>
          </div>
          <Link href="/seguridad/pts" className="text-sm font-medium text-slate-600 hover:text-slate-900">← Volver a la bandeja</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">I. Identificación</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 md:col-span-2">Trabajo a realizar *<textarea value={form.trabajo_a_realizar} onChange={(e) => setForm({ ...form, trabajo_a_realizar: e.target.value })} rows={2} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Tipo de actividad *<input value={form.tipo_actividad} onChange={(e) => setForm({ ...form, tipo_actividad: e.target.value })} placeholder="Soldadura, corte, altura, excavación, electricidad..." className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Empresa contratista *<input value={form.empresa_contratista} onChange={(e) => setForm({ ...form, empresa_contratista: e.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">Lugar de ejecución *<input value={form.lugar_ejecucion} onChange={(e) => setForm({ ...form, lugar_ejecucion: e.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Fecha de inicio *<input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Fecha de término<input type="date" value={form.fecha_termino} onChange={(e) => setForm({ ...form, fecha_termino: e.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Hora de inicio<input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Hora de término<input type="time" value={form.hora_termino} onChange={(e) => setForm({ ...form, hora_termino: e.target.value })} className={inputClass} /></label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">II. Análisis de riesgos del trabajo</h2><p className="mt-1 text-sm text-slate-500">Dividir el trabajo en etapas, identificar peligros y definir medidas preventivas.</p></div><button type="button" onClick={() => setRiesgos([...riesgos, emptyRisk()])} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">+ Agregar paso</button></div>
            <div className="mt-5 space-y-4">
              {riesgos.map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-700">Paso {index + 1}</div>
                  <div className="grid gap-3 lg:grid-cols-4">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad<textarea rows={3} value={item.actividad} onChange={(e) => updateRisk(index, 'actividad', e.target.value)} className={inputClass} /></label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peligros<textarea rows={3} value={item.peligros} onChange={(e) => updateRisk(index, 'peligros', e.target.value)} className={inputClass} /></label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Incidentes / riesgos<textarea rows={3} value={item.riesgos} onChange={(e) => updateRisk(index, 'riesgos', e.target.value)} className={inputClass} /></label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medidas preventivas<textarea rows={3} value={item.medidas_preventivas} onChange={(e) => updateRisk(index, 'medidas_preventivas', e.target.value)} className={inputClass} /></label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">III. Personal participante</h2><p className="mt-1 text-sm text-slate-500">Registro obligatorio de trabajadores incluidos en el permiso.</p></div><button type="button" onClick={() => setPersonal([...personal, emptyPerson()])} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">+ Agregar persona</button></div>
            <div className="mt-5 space-y-3">
              {personal.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-5 md:items-end">
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">Nombre y apellido<input value={item.nombre_apellido} onChange={(e) => updatePerson(index, 'nombre_apellido', e.target.value)} className={inputClass} /></label>
                  <label className="text-sm font-medium text-slate-700">RUT<input value={item.rut} onChange={(e) => updatePerson(index, 'rut', e.target.value)} className={inputClass} /></label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={item.induccion_ingreso_ok} onChange={(e) => updatePerson(index, 'induccion_ingreso_ok', e.target.checked)} />Inducción ingreso</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={item.charla_5_min_ok} onChange={(e) => updatePerson(index, 'charla_5_min_ok', e.target.checked)} />Charla 5 min.</label>
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">Examen de altura vigente hasta<input type="date" value={item.examen_altura_vigente_hasta} onChange={(e) => updatePerson(index, 'examen_altura_vigente_hasta', e.target.value)} className={inputClass} /></label>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">IV. Equipos y elementos de protección personal</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EPP_BASE.map((name) => (
                <label key={name} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${epp.includes(name) ? 'border-[#18B7A8] bg-cyan-50 text-slate-900' : 'border-slate-200 text-slate-700'}`}><input type="checkbox" checked={epp.includes(name)} onChange={() => toggleEpp(name)} />{name}</label>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Observaciones</h2>
            <textarea rows={4} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Indicar condiciones, recomendaciones o restricciones adicionales..." className={inputClass} />
          </section>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/seguridad/pts" className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700">Cancelar</Link>
            <button type="submit" disabled={saving} className="inline-flex justify-center rounded-xl bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#11998E] disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar PTS como borrador'}</button>
          </div>
        </form>
      </main>
    </PTSAccessGuard>
  )
}
