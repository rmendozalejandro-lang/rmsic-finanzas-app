'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PTSAccessGuard from '../../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../../lib/supabase/client'
import {
  PERMISO_CALIENTE_CHECKLIST,
  PERMISO_CALIENTE_TIPOS,
} from '../../../../../../lib/pts/caliente-checklist'

const STORAGE_KEY = 'empresa_activa_id'

type Respuesta = 'si' | 'no' | 'na' | ''
type ChecklistState = Record<string, { respuesta: Respuesta; observacion: string }>
type DatosEspecificos = { tipos_trabajo?: string[]; otro_tipo?: string; vigia_incendios_nombre?: string }
type PermisoComplementario = {
  id: string
  estado: string
  nombre: string
  codigo_fuente: string | null
  datos_especificos: DatosEspecificos | null
}

export default function PermisoCalientePage() {
  const params = useParams<{ id: string }>()
  const permisoId = params.id
  const [empresaId, setEmpresaId] = useState('')
  const [permiso, setPermiso] = useState<PermisoComplementario | null>(null)
  const [respuestas, setRespuestas] = useState<ChecklistState>({})
  const [tiposTrabajo, setTiposTrabajo] = useState<string[]>([])
  const [otroTipo, setOtroTipo] = useState('')
  const [vigiaNombre, setVigiaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const activeEmpresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        if (!activeEmpresaId) throw new Error('No hay empresa activa seleccionada.')
        if (active) setEmpresaId(activeEmpresaId)

        const { data: complementario, error: complementarioError } = await supabase
          .from('pts_permisos_complementarios')
          .select('id,estado,nombre,codigo_fuente,datos_especificos')
          .eq('permiso_id', permisoId)
          .eq('empresa_id', activeEmpresaId)
          .eq('tipo', 'caliente')
          .eq('requerido', true)
          .maybeSingle()
        if (complementarioError) throw complementarioError
        if (!complementario) throw new Error('Este expediente no tiene un Permiso de Trabajo en Caliente requerido.')

        const { data: existentes, error: existentesError } = await supabase
          .from('pts_checklist_respuestas')
          .select('codigo_item,respuesta,observacion')
          .eq('permiso_complementario_id', complementario.id)
          .eq('empresa_id', activeEmpresaId)
        if (existentesError) throw existentesError

        const initial: ChecklistState = {}
        for (const item of PERMISO_CALIENTE_CHECKLIST) {
          const existente = (existentes ?? []).find((row) => row.codigo_item === item.codigo)
          initial[item.codigo] = {
            respuesta: (existente?.respuesta as Respuesta | null) ?? '',
            observacion: existente?.observacion ?? '',
          }
        }

        const datos = (complementario.datos_especificos ?? {}) as DatosEspecificos
        if (active) {
          setPermiso(complementario as PermisoComplementario)
          setRespuestas(initial)
          setTiposTrabajo(datos.tipos_trabajo ?? [])
          setOtroTipo(datos.otro_tipo ?? '')
          setVigiaNombre(datos.vigia_incendios_nombre ?? '')
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el Permiso de Trabajo en Caliente.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [permisoId])

  const pendientes = useMemo(() => PERMISO_CALIENTE_CHECKLIST.filter((item) => !respuestas[item.codigo]?.respuesta).length, [respuestas])
  const bloqueantesNo = useMemo(() => PERMISO_CALIENTE_CHECKLIST.filter((item) => item.bloqueanteSiNo && respuestas[item.codigo]?.respuesta === 'no').length, [respuestas])
  const naInvalidos = useMemo(() => PERMISO_CALIENTE_CHECKLIST.filter((item) => respuestas[item.codigo]?.respuesta === 'na' && !item.permiteNA).length, [respuestas])
  const naSinJustificacion = useMemo(() => PERMISO_CALIENTE_CHECKLIST.filter((item) => item.permiteNA && respuestas[item.codigo]?.respuesta === 'na' && !respuestas[item.codigo]?.observacion.trim()).length, [respuestas])
  const datosCompletos = tiposTrabajo.length > 0 && vigiaNombre.trim().length >= 3 && (!tiposTrabajo.includes('otro') || otroTipo.trim().length >= 3)
  const completos = PERMISO_CALIENTE_CHECKLIST.length - pendientes
  const porcentaje = Math.round((completos / PERMISO_CALIENTE_CHECKLIST.length) * 100)
  const listo = pendientes === 0 && bloqueantesNo === 0 && naInvalidos === 0 && naSinJustificacion === 0 && datosCompletos

  const toggleTipo = (codigo: string) => setTiposTrabajo((current) => current.includes(codigo) ? current.filter((item) => item !== codigo) : [...current, codigo])
  const setRespuesta = (codigo: string, respuesta: Respuesta) => {
    const item = PERMISO_CALIENTE_CHECKLIST.find((row) => row.codigo === codigo)
    if (respuesta === 'na' && item && !item.permiteNA) return
    setRespuestas((current) => ({ ...current, [codigo]: { respuesta, observacion: current[codigo]?.observacion ?? '' } }))
  }
  const setObservacion = (codigo: string, observacion: string) => setRespuestas((current) => ({ ...current, [codigo]: { respuesta: current[codigo]?.respuesta ?? '', observacion } }))

  const guardar = async () => {
    if (!permiso || !empresaId) return
    setError('')
    setSuccess('')
    if (!tiposTrabajo.length) return setError('Selecciona al menos un tipo de trabajo en caliente.')
    if (tiposTrabajo.includes('otro') && otroTipo.trim().length < 3) return setError('Especifica el tipo de trabajo en caliente seleccionado como Otro.')
    if (vigiaNombre.trim().length < 3) return setError('Debes identificar al Vigía de Incendios antes de guardar.')
    if (naInvalidos > 0) return setError('Hay controles esenciales marcados como N/A. Deben responderse Sí o No.')
    if (naSinJustificacion > 0) return setError(`Debes justificar técnicamente ${naSinJustificacion} respuesta(s) N/A antes de guardar.`)

    try {
      setSaving(true)
      const rows = PERMISO_CALIENTE_CHECKLIST.map((item) => ({
        permiso_complementario_id: permiso.id,
        empresa_id: empresaId,
        codigo_item: item.codigo,
        seccion: item.seccion,
        pregunta: item.pregunta,
        respuesta: respuestas[item.codigo]?.respuesta || null,
        bloqueante_si_no: item.bloqueanteSiNo,
        observacion: respuestas[item.codigo]?.observacion.trim() || null,
        orden: item.orden,
      }))
      const { error: upsertError } = await supabase.from('pts_checklist_respuestas').upsert(rows, { onConflict: 'permiso_complementario_id,codigo_item' })
      if (upsertError) throw upsertError

      const nuevoEstado = listo ? 'completo' : bloqueantesNo > 0 ? 'observado' : 'borrador'
      const datos: DatosEspecificos = {
        tipos_trabajo: tiposTrabajo,
        otro_tipo: tiposTrabajo.includes('otro') ? otroTipo.trim() : '',
        vigia_incendios_nombre: vigiaNombre.trim(),
      }
      const { error: estadoError } = await supabase
        .from('pts_permisos_complementarios')
        .update({ estado: nuevoEstado, datos_especificos: datos })
        .eq('id', permiso.id)
        .eq('empresa_id', empresaId)
      if (estadoError) throw estadoError

      const { error: historialError } = await supabase.from('pts_historial').insert({
        permiso_id: permisoId,
        empresa_id: empresaId,
        evento: 'permiso_caliente_guardado',
        detalle: listo
          ? 'Permiso de Trabajo en Caliente completado sin respuestas bloqueantes.'
          : bloqueantesNo > 0
            ? `Permiso de Trabajo en Caliente guardado con ${bloqueantesNo} respuesta(s) NO bloqueante(s).`
            : `Permiso de Trabajo en Caliente guardado con ${pendientes} respuesta(s) pendiente(s).`,
      })
      if (historialError) throw historialError
      setPermiso({ ...permiso, estado: nuevoEstado, datos_especificos: datos })
      setSuccess(listo ? 'Permiso de Trabajo en Caliente completo. La vigilancia post trabajo será obligatoria al finalizar la ejecución.' : bloqueantesNo > 0 ? 'Guardado. El trabajo en caliente permanece bloqueado por respuestas NO.' : 'Borrador guardado. Aún quedan controles pendientes.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el Permiso de Trabajo en Caliente.')
    } finally {
      setSaving(false)
    }
  }

  const secciones = Array.from(new Set(PERMISO_CALIENTE_CHECKLIST.map((item) => item.seccion)))

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href={`/seguridad/pts/${permisoId}/permisos`} className="text-sm font-medium text-slate-500 hover:text-slate-900">← Volver a permisos complementarios</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">Permiso complementario</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Permiso de Trabajo en Caliente</h1>
            <p className="mt-2 text-sm text-slate-500">SG-SST-PO15-REG 01 · Versión 5 · Todos los prerrequisitos deben quedar conformes antes de ejecutar.</p>
          </div>
          {permiso ? <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${permiso.estado === 'completo' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : permiso.estado === 'observado' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{permiso.estado === 'completo' ? 'Completo' : permiso.estado === 'observado' ? 'Bloqueado' : 'Borrador'}</span> : null}
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando permiso...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}

        {!loading && permiso ? <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Avance</p><p className="mt-2 text-3xl font-semibold text-slate-900">{porcentaje}%</p><p className="mt-1 text-sm text-slate-500">{completos} de {PERMISO_CALIENTE_CHECKLIST.length} controles respondidos</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pendientes</p><p className="mt-2 text-3xl font-semibold text-slate-900">{pendientes}</p><p className="mt-1 text-sm text-slate-500">Deben quedar en cero antes de revisión</p></div>
            <div className={`rounded-2xl border p-5 shadow-sm ${bloqueantesNo > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}><p className={`text-xs font-semibold uppercase tracking-[0.12em] ${bloqueantesNo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Respuestas NO</p><p className={`mt-2 text-3xl font-semibold ${bloqueantesNo > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{bloqueantesNo}</p><p className="mt-1 text-sm text-slate-600">{bloqueantesNo > 0 ? 'Trabajo bloqueado' : 'Sin bloqueos registrados'}</p></div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Datos específicos del trabajo en caliente</h2>
            <p className="mt-1 text-sm text-slate-500">Selecciona el tipo de labor e identifica al Vigía de Incendios.</p>
            <div className="mt-5 flex flex-wrap gap-2">{PERMISO_CALIENTE_TIPOS.map((tipo) => <button key={tipo.codigo} type="button" onClick={() => toggleTipo(tipo.codigo)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${tiposTrabajo.includes(tipo.codigo) ? 'border-[#18B7A8] bg-[#18B7A8] text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{tipo.nombre}</button>)}</div>
            {tiposTrabajo.includes('otro') ? <input value={otroTipo} onChange={(e) => setOtroTipo(e.target.value)} placeholder="Especificar otro tipo de trabajo" className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#18B7A8]" /> : null}
            <label className="mt-5 block text-sm font-semibold text-slate-700">Vigía de Incendios</label>
            <input value={vigiaNombre} onChange={(e) => setVigiaNombre(e.target.value)} placeholder="Nombre completo del vigía" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#18B7A8]" />
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>Criterio de hiperseguridad:</strong> una respuesta NO bloquea el permiso. N/A solo se habilita en controles realmente condicionados por el equipo, el tipo de trabajo o la infraestructura del área, y siempre exige justificación técnica.</section>

          {secciones.map((seccion) => <section key={seccion} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{seccion}</h2>
            <div className="mt-5 space-y-4">{PERMISO_CALIENTE_CHECKLIST.filter((item) => item.seccion === seccion).map((item) => {
              const row = respuestas[item.codigo] ?? { respuesta: '', observacion: '' }
              const bloqueado = row.respuesta === 'no'
              const naSinDetalle = row.respuesta === 'na' && item.permiteNA && !row.observacion.trim()
              return <div key={item.codigo} className={`rounded-2xl border p-4 ${bloqueado || naSinDetalle ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-2xl"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{item.codigo}</span><span className="text-[11px] font-semibold uppercase tracking-wide text-red-500">Bloqueante si es NO</span>{item.permiteNA ? <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">N/A requiere justificación</span> : <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">N/A no permitido</span>}</div><p className="mt-2 text-sm font-medium text-slate-900">{item.pregunta}</p></div>
                <div className="flex gap-2">{(['si','no','na'] as const).map((value) => { if (value === 'na' && !item.permiteNA) return null; const selected = row.respuesta === value; return <button key={value} type="button" onClick={() => setRespuesta(item.codigo, value)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${selected ? value === 'no' ? 'border-red-500 bg-red-600 text-white' : value === 'si' ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-500 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{value === 'si' ? 'Sí' : value === 'no' ? 'No' : 'N/A'}</button> })}</div></div>
                <textarea value={row.observacion} onChange={(e) => setObservacion(item.codigo, e.target.value)} rows={2} placeholder={row.respuesta === 'na' ? 'Justifica técnicamente por qué este control no aplica...' : bloqueado ? 'Indica la condición insegura y la corrección requerida...' : 'Observación opcional...'} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#18B7A8]" />
                {naSinDetalle ? <p className="mt-2 text-xs font-semibold text-red-600">Debes justificar el N/A antes de guardar.</p> : null}
              </div>
            })}</div>
          </section>)}

          <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-900"><strong>Vigilancia post trabajo:</strong> al finalizar una labor de trabajo en caliente se deberá realizar el registro SG-SST-PO15-REG 02 durante un mínimo de 60 minutos. El PTS no podrá cerrarse mientras esa vigilancia esté pendiente o incompleta.</section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><Link href={`/seguridad/pts/${permisoId}/permisos`} className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700">Volver</Link><button type="button" onClick={guardar} disabled={saving} className="inline-flex justify-center rounded-xl bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#11998E] disabled:opacity-60">{saving ? 'Guardando...' : listo ? 'Guardar permiso completo' : 'Guardar avance'}</button></div>
        </> : null}
      </main>
    </PTSAccessGuard>
  )
}
