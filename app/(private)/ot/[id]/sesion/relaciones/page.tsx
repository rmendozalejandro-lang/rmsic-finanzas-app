'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'
import { guardarOTVivaIndexedDB } from '@/lib/offline/ot-viva-indexeddb'
import { supabase } from '@/lib/supabase/client'

type TipoRelacion =
  | 'origina'
  | 'sustenta'
  | 'confirma'
  | 'descarta'
  | 'contradice'
  | 'resultado_de'
  | 'causa_de'
  | 'recomendacion_de'
  | 'decision_sobre'
  | 'seguimiento_de'
  | 'relacionado_con'

type EventoLocal = {
  id: string
  tipo_evento: string
  nivel_certeza: string
  texto_original: string
  ocurrido_at: string
}

type SesionLocal = {
  id: string
  estado: 'en_curso' | 'pausada' | 'interrumpida' | 'finalizada'
  estado_sync: 'local' | 'pendiente_sync' | 'sincronizada' | 'error'
  iniciado_at: string
  finalizado_at: string | null
  eventos: EventoLocal[]
}

type RelacionLocal = {
  id: string
  evento_origen_id: string
  evento_destino_id: string
  tipo_relacion: TipoRelacion
  observacion: string
  created_at: string
}

type StoreV2 = {
  version: 2
  sesiones: SesionLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
  relaciones?: RelacionLocal[]
  updated_at: string
}

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  titulo: string
}

const RELACIONES: Array<{ value: TipoRelacion; label: string; ayuda: string }> = [
  { value: 'sustenta', label: 'Sustenta', ayuda: 'El origen aporta evidencia o fundamento al destino.' },
  { value: 'confirma', label: 'Confirma', ayuda: 'El origen confirma técnicamente el destino.' },
  { value: 'descarta', label: 'Descarta', ayuda: 'El origen permite descartar el destino.' },
  { value: 'contradice', label: 'Contradice', ayuda: 'El origen aporta evidencia incompatible con el destino.' },
  { value: 'resultado_de', label: 'Resultado de', ayuda: 'El origen es resultado de una prueba o acción destino.' },
  { value: 'origina', label: 'Origina', ayuda: 'El origen conduce o da lugar al destino.' },
  { value: 'causa_de', label: 'Causa de', ayuda: 'El origen representa una causa del destino.' },
  { value: 'recomendacion_de', label: 'Recomendación de', ayuda: 'El origen es una recomendación derivada del destino.' },
  { value: 'decision_sobre', label: 'Decisión sobre', ayuda: 'El origen registra una decisión respecto del destino.' },
  { value: 'seguimiento_de', label: 'Seguimiento de', ayuda: 'El origen continúa una observación o acción previa.' },
  { value: 'relacionado_con', label: 'Relacionado con', ayuda: 'Relación técnica general.' },
]

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

function localTime(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function shortText(value: string, max = 84) {
  const limpio = value.trim().replace(/\s+/g, ' ')
  return limpio.length <= max ? limpio : `${limpio.slice(0, max)}…`
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    hallazgo: 'Hallazgo', medicion: 'Medición', hipotesis: 'Hipótesis', prueba: 'Prueba', accion: 'Acción',
    resultado: 'Resultado', recomendacion: 'Recomendación', pendiente: 'Pendiente', decision_cliente: 'Decisión cliente', observacion: 'Observación',
  }
  return labels[value] ?? value
}

export default function RelacionesTecnicasPage() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [userId, setUserId] = useState('')
  const [store, setStore] = useState<StoreV2 | null>(null)
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [tipoRelacion, setTipoRelacion] = useState<TipoRelacion>('sustenta')
  const [observacion, setObservacion] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const user = authData.user
        if (!user) throw new Error('No hay usuario autenticado.')

        const { data: ot, error: otError } = await supabase
          .from('ot_ordenes_trabajo')
          .select('id, folio, empresa_id, titulo')
          .eq('id', otId)
          .maybeSingle()
        if (otError) throw otError
        if (!ot?.empresa_id) throw new Error('No se encontró la OT.')

        const key = storageKeyV2(ot.empresa_id as string, otId, user.id)
        const raw = window.localStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) as StoreV2 : null
        if (parsed && parsed.version !== 2) throw new Error('Formato local OT Viva no reconocido.')

        if (!mounted) return
        setDetalle(ot as OTDetalle)
        setUserId(user.id)
        setStore(parsed ? { ...parsed, relaciones: parsed.relaciones ?? [] } : null)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'No se pudieron cargar las relaciones técnicas.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (otId) void load()
    return () => { mounted = false }
  }, [otId])

  const eventos = useMemo(() => {
    if (!store) return []
    return store.sesiones.flatMap((sesion, index) => sesion.eventos.map((evento) => ({
      ...evento,
      sesion_id: sesion.id,
      sesion_numero: index + 1,
    })))
  }, [store])

  const eventoMap = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos])
  const relaciones = store?.relaciones ?? []

  const persistir = async (next: StoreV2) => {
    if (!detalle || !userId) return
    const normalized = { ...next, version: 2 as const, updated_at: new Date().toISOString() }
    const key = storageKeyV2(detalle.empresa_id, otId, userId)
    const raw = JSON.stringify(normalized)
    window.localStorage.setItem(key, raw)
    setStore(normalized)
    window.dispatchEvent(new Event('tralixia:ot-viva-local-updated'))
    try { await guardarOTVivaIndexedDB(key, raw) } catch { /* localStorage remains source for this action */ }
  }

  const crearRelacion = () => {
    if (!store || !origenId || !destinoId || origenId === destinoId) return
    const existe = relaciones.some((r) => r.evento_origen_id === origenId && r.evento_destino_id === destinoId && r.tipo_relacion === tipoRelacion)
    if (existe) return
    const nueva: RelacionLocal = {
      id: crypto.randomUUID(),
      evento_origen_id: origenId,
      evento_destino_id: destinoId,
      tipo_relacion: tipoRelacion,
      observacion: observacion.trim(),
      created_at: new Date().toISOString(),
    }
    void persistir({ ...store, relaciones: [...relaciones, nueva] })
    setOrigenId('')
    setDestinoId('')
    setObservacion('')
  }

  const eliminarRelacion = (id: string) => {
    if (!store) return
    void persistir({ ...store, relaciones: relaciones.filter((r) => r.id !== id) })
  }

  const hipotesis = eventos.filter((e) => e.tipo_evento === 'hipotesis')
  const estadoHipotesis = (id: string) => {
    const vinculadas = relaciones.filter((r) => r.evento_destino_id === id)
    if (vinculadas.some((r) => r.tipo_relacion === 'confirma')) return 'confirmada'
    if (vinculadas.some((r) => r.tipo_relacion === 'descarta')) return 'descartada'
    return 'abierta'
  }

  if (loading) return <ProtectedModuleRoute moduleKey="ot"><div className="mx-auto max-w-6xl rounded-2xl border bg-white p-6">Cargando relaciones técnicas...</div></ProtectedModuleRoute>

  if (error || !detalle) return <ProtectedModuleRoute moduleKey="ot"><div className="mx-auto max-w-6xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'No se encontró la OT.'}</div></ProtectedModuleRoute>

  if (!store || eventos.length === 0) return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="mx-auto max-w-6xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-black text-slate-900">Relaciones técnicas</h1>
        <p className="mt-2 text-sm text-slate-700">Primero registra eventos en una sesión de terreno.</p>
        <Link href={`/ot/${otId}/sesion`} className="mt-4 inline-flex rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-black text-white">Ir al registro</Link>
      </div>
    </ProtectedModuleRoute>
  )

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">OT Viva · Memoria Técnica</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Relaciones entre eventos</h1>
          <p className="mt-2 text-sm text-slate-600">{detalle.folio || 'Sin folio'} · {detalle.titulo}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Vincula evidencia, hipótesis, pruebas, resultados y recomendaciones aunque pertenezcan a sesiones distintas de la misma OT.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Memoria causal</p><h2 className="mt-1 text-lg font-black text-slate-900">Crear relación técnica</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{eventos.length} eventos · {relaciones.length} relaciones</span></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Evento origen</label><select value={origenId} onChange={(e) => setOrigenId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Selecciona evento</option>{eventos.map((e) => <option key={e.id} value={e.id}>S{e.sesion_numero} · {localTime(e.ocurrido_at)} · {eventLabel(e.tipo_evento)} · {shortText(e.texto_original, 50)}</option>)}</select></div>
            <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Relación</label><select value={tipoRelacion} onChange={(e) => setTipoRelacion(e.target.value as TipoRelacion)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">{RELACIONES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select><p className="mt-1 text-xs text-slate-500">{RELACIONES.find((r) => r.value === tipoRelacion)?.ayuda}</p></div>
            <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Evento destino</label><select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Selecciona evento</option>{eventos.map((e) => <option key={e.id} value={e.id} disabled={e.id === origenId}>S{e.sesion_numero} · {localTime(e.ocurrido_at)} · {eventLabel(e.tipo_evento)} · {shortText(e.texto_original, 50)}</option>)}</select></div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación opcional sobre la relación" className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><button type="button" onClick={crearRelacion} disabled={!origenId || !destinoId || origenId === destinoId} className="rounded-xl bg-[#163A5F] px-5 py-2.5 text-sm font-black text-white disabled:opacity-45">Guardar relación</button></div>
        </section>

        {hipotesis.length > 0 ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-900">Estado de hipótesis</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{hipotesis.map((h) => { const estado = estadoHipotesis(h.id); return <div key={h.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase text-slate-500">Hipótesis</span><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${estado === 'confirmada' ? 'bg-emerald-50 text-emerald-700' : estado === 'descartada' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{estado}</span></div><p className="mt-2 text-sm font-semibold text-slate-800">{h.texto_original}</p></div> })}</div></section> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Relaciones registradas</h2>
          {relaciones.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Todavía no hay relaciones técnicas.</p> : <div className="mt-4 space-y-3">{[...relaciones].reverse().map((r) => { const o = eventoMap.get(r.evento_origen_id); const d = eventoMap.get(r.evento_destino_id); return <article key={r.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-black text-slate-900">{o ? `${eventLabel(o.tipo_evento)} · ${shortText(o.texto_original)}` : 'Evento no disponible'}</p><p className="my-2 text-xs font-black uppercase tracking-wide text-[#163A5F]">{RELACIONES.find((x) => x.value === r.tipo_relacion)?.label ?? r.tipo_relacion}</p><p className="text-sm font-semibold text-slate-700">{d ? `${eventLabel(d.tipo_evento)} · ${shortText(d.texto_original)}` : 'Evento no disponible'}</p>{r.observacion ? <p className="mt-2 text-xs text-slate-500">{r.observacion}</p> : null}</div><button type="button" onClick={() => eliminarRelacion(r.id)} className="text-xs font-bold text-red-600">Eliminar</button></div></article> })}</div>}
        </section>
      </div>
    </ProtectedModuleRoute>
  )
}
