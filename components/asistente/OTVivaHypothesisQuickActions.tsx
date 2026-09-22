'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { guardarOTVivaIndexedDB } from '@/lib/offline/ot-viva-indexeddb'
import { supabase } from '@/lib/supabase/client'

type EventoLocal = {
  id: string
  tipo_evento: string
  nivel_certeza: string
  texto_original: string
  descripcion_tecnica?: string
  componente?: string
  prioridad?: 'baja' | 'media' | 'alta' | 'critica' | null
  visible_cliente?: boolean
  incluir_ot?: boolean
  ocurrido_at: string
}

type RelacionLocal = {
  id: string
  evento_origen_id: string
  evento_destino_id: string
  tipo_relacion: string
  observacion: string
  created_at: string
  estado_sync?: 'local' | 'pendiente_sync' | 'sincronizada' | 'error'
}

type SesionLocal = {
  id: string
  estado: 'en_curso' | 'pausada' | 'interrumpida' | 'finalizada'
  estado_sync: 'local' | 'pendiente_sync' | 'sincronizada' | 'error'
  iniciado_at: string
  finalizado_at: string | null
  eventos: EventoLocal[]
}

type StoreV2 = {
  version: 2
  sesiones: SesionLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
  relaciones?: RelacionLocal[]
  updated_at: string
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

function shortText(value: string, max = 95) {
  const limpio = value.trim().replace(/\s+/g, ' ')
  return limpio.length <= max ? limpio : `${limpio.slice(0, max)}…`
}

function etiquetaEvento(tipo: string) {
  const labels: Record<string, string> = {
    hallazgo: 'Hallazgo',
    medicion: 'Medición',
    hipotesis: 'Hipótesis',
    prueba: 'Prueba',
    accion: 'Acción',
    resultado: 'Resultado',
    recomendacion: 'Recomendación',
    pendiente: 'Pendiente',
    decision_cliente: 'Decisión cliente',
    observacion: 'Observación',
  }
  return labels[tipo] ?? tipo
}

export default function OTVivaHypothesisQuickActions() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const otId = params?.id || ''
  const [store, setStore] = useState<StoreV2 | null>(null)
  const [key, setKey] = useState('')
  const [evidenciaSeleccionada, setEvidenciaSeleccionada] = useState<Record<string, string>>({})
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    const cargar = async () => {
      if (!otId) return
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) return

      const { data: ot } = await supabase
        .from('ot_ordenes_trabajo')
        .select('empresa_id')
        .eq('id', otId)
        .maybeSingle()

      const empresaId = ot?.empresa_id as string | undefined
      if (!empresaId) return

      const storageKey = storageKeyV2(empresaId, otId, userId)
      if (mounted) setKey(storageKey)

      const leer = () => {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) {
          if (mounted) setStore(null)
          return
        }
        try {
          const parsed = JSON.parse(raw) as StoreV2
          if (mounted) setStore({ ...parsed, relaciones: parsed.relaciones ?? [] })
        } catch {
          if (mounted) setStore(null)
        }
      }

      leer()
      const intervalId = window.setInterval(leer, 500)
      window.addEventListener('tralixia:ot-viva-local-updated', leer)
      cleanup = () => {
        window.clearInterval(intervalId)
        window.removeEventListener('tralixia:ot-viva-local-updated', leer)
      }
    }

    void cargar()
    return () => {
      mounted = false
      cleanup?.()
    }
  }, [otId])

  const eventos = useMemo(() => store?.sesiones.flatMap((sesion) => sesion.eventos) ?? [], [store])
  const relaciones = store?.relaciones ?? []
  const hipotesis = useMemo(() => eventos.filter((evento) => evento.tipo_evento === 'hipotesis'), [eventos])
  const evidencias = useMemo(
    () => eventos.filter((evento) => ['resultado', 'prueba', 'medicion', 'hallazgo'].includes(evento.tipo_evento)),
    [eventos],
  )

  const estadoHipotesis = (id: string) => {
    const vinculadas = relaciones.filter((relacion) => relacion.evento_destino_id === id)
    const tieneConfirma = vinculadas.some((relacion) => relacion.tipo_relacion === 'confirma')
    const tieneDescarta = vinculadas.some((relacion) => relacion.tipo_relacion === 'descarta')

    const decisionesHumanas = vinculadas
      .filter((relacion) => relacion.tipo_relacion === 'decision_sobre')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const ultimaDecision = decisionesHumanas.at(-1)
    if (ultimaDecision) {
      const eventoDecision = eventos.find((evento) => evento.id === ultimaDecision.evento_origen_id)
      if (eventoDecision?.nivel_certeza === 'confirmado') return 'confirmada'
      if (eventoDecision?.nivel_certeza === 'descartado') return 'descartada'
    }

    if (tieneConfirma && tieneDescarta) return 'conflicto'
    if (tieneConfirma) return 'confirmada'
    if (tieneDescarta) return 'descartada'
    return 'abierta'
  }

  const tieneConflictoHistorico = (id: string) => {
    const vinculadas = relaciones.filter((relacion) => relacion.evento_destino_id === id)
    return vinculadas.some((relacion) => relacion.tipo_relacion === 'confirma')
      && vinculadas.some((relacion) => relacion.tipo_relacion === 'descarta')
  }

  const tieneResolucionHumana = (id: string) =>
    relaciones.some((relacion) => relacion.evento_destino_id === id && relacion.tipo_relacion === 'decision_sobre')

  const persistir = async (next: StoreV2) => {
    if (!key) return
    const normalized = { ...next, version: 2 as const, updated_at: new Date().toISOString() }
    const raw = JSON.stringify(normalized)
    window.localStorage.setItem(key, raw)
    setStore(normalized)
    window.dispatchEvent(new Event('tralixia:ot-viva-local-updated'))
    try { await guardarOTVivaIndexedDB(key, raw) } catch { /* localStorage remains available */ }
  }

  const resolver = async (hipotesisId: string, tipoRelacion: 'confirma' | 'descarta') => {
    if (!store) return
    const eventoOrigenId = evidenciaSeleccionada[hipotesisId]
    if (!eventoOrigenId) {
      setMensaje('Selecciona primero la evidencia que confirma o descarta la hipótesis.')
      return
    }

    const existe = relaciones.some(
      (relacion) => relacion.evento_origen_id === eventoOrigenId && relacion.evento_destino_id === hipotesisId && relacion.tipo_relacion === tipoRelacion,
    )
    if (existe) return

    const nueva: RelacionLocal = {
      id: crypto.randomUUID(),
      evento_origen_id: eventoOrigenId,
      evento_destino_id: hipotesisId,
      tipo_relacion: tipoRelacion,
      observacion: 'Validación rápida desde cronología OT Viva',
      created_at: new Date().toISOString(),
      estado_sync: 'local',
    }

    await persistir({ ...store, relaciones: [...relaciones, nueva] })
    setMensaje(tipoRelacion === 'confirma' ? 'Hipótesis confirmada localmente. Queda pendiente de sincronización.' : 'Hipótesis descartada localmente. Queda pendiente de sincronización.')
  }

  const resolverConflicto = async (hipotesisId: string, decision: 'confirmado' | 'descartado') => {
    if (!store) return
    const sesionActivaId = store.sesion_activa_id
    const sesionActiva = store.sesiones.find((sesion) => sesion.id === sesionActivaId && sesion.estado === 'en_curso')
    if (!sesionActiva) {
      setMensaje('Inicia o reanuda una sesión de terreno para registrar la decisión humana que resuelve el conflicto.')
      return
    }

    const hipotesisObjetivo = hipotesis.find((item) => item.id === hipotesisId)
    const ahora = new Date().toISOString()
    const eventoDecision: EventoLocal = {
      id: crypto.randomUUID(),
      tipo_evento: 'resultado',
      nivel_certeza: decision,
      texto_original: decision === 'confirmado'
        ? 'Decisión humana: se confirma la hipótesis después de revisar la evidencia contradictoria.'
        : 'Decisión humana: se descarta la hipótesis después de revisar la evidencia contradictoria.',
      descripcion_tecnica: hipotesisObjetivo
        ? `Resolución humana explícita del conflicto sobre la hipótesis: ${hipotesisObjetivo.texto_original}`
        : 'Resolución humana explícita de conflicto de hipótesis.',
      componente: '',
      prioridad: null,
      visible_cliente: false,
      incluir_ot: true,
      ocurrido_at: ahora,
    }

    const relacionDecision: RelacionLocal = {
      id: crypto.randomUUID(),
      evento_origen_id: eventoDecision.id,
      evento_destino_id: hipotesisId,
      tipo_relacion: 'decision_sobre',
      observacion: decision === 'confirmado'
        ? 'Resolución humana explícita: prevalece la confirmación sin eliminar la evidencia contradictoria.'
        : 'Resolución humana explícita: prevalece el descarte sin eliminar la evidencia contradictoria.',
      created_at: ahora,
      estado_sync: 'local',
    }

    const sesiones = store.sesiones.map((sesion) =>
      sesion.id === sesionActiva.id
        ? { ...sesion, estado_sync: 'local' as const, eventos: [...sesion.eventos, eventoDecision] }
        : sesion
    )

    await persistir({ ...store, sesiones, relaciones: [...relaciones, relacionDecision] })
    setMensaje(
      decision === 'confirmado'
        ? 'Conflicto resuelto por decisión humana como CONFIRMADA. Las evidencias previas se conservan.'
        : 'Conflicto resuelto por decisión humana como DESCARTADA. Las evidencias previas se conservan.'
    )
  }

  if (pathname.endsWith('/relaciones') || !store || hipotesis.length === 0) return null

  const sesionActivaDisponible = Boolean(
    store.sesion_activa_id &&
    store.sesiones.some((sesion) => sesion.id === store.sesion_activa_id && sesion.estado === 'en_curso')
  )
  const abiertas = hipotesis.filter((h) => estadoHipotesis(h.id) === 'abierta').length
  const conflictos = hipotesis.filter((h) => estadoHipotesis(h.id) === 'conflicto').length

  return (
    <section className="mx-auto max-w-6xl rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-violet-600">Hipótesis técnicas</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Validación rápida desde terreno</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Selecciona la evidencia que sustenta tu decisión y confirma o descarta la hipótesis sin salir del registro de terreno.</p>
        </div>
        <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black text-violet-700">{abiertas} ABIERTAS · {conflictos} EN CONFLICTO · {hipotesis.length} TOTAL</span>
      </div>

      <div className="mt-4 space-y-3">
        {[...hipotesis].reverse().map((hipotesis) => {
          const estado = estadoHipotesis(hipotesis.id)
          const abierta = estado === 'abierta'
          const conflicto = estado === 'conflicto'
          const conflictoHistorico = tieneConflictoHistorico(hipotesis.id)
          const resolucionHumana = tieneResolucionHumana(hipotesis.id)
          return (
            <article key={hipotesis.id} className="rounded-xl border border-violet-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Hipótesis</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${estado === 'confirmada' ? 'bg-emerald-50 text-emerald-700' : estado === 'descartada' ? 'bg-slate-100 text-slate-600' : estado === 'conflicto' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{estado === 'conflicto' ? 'EN CONFLICTO' : estado}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{hipotesis.texto_original}</p>
                </div>
              </div>

              {abierta ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Evidencia para decidir</label>
                    <select
                      value={evidenciaSeleccionada[hipotesis.id] ?? ''}
                      onChange={(event) => setEvidenciaSeleccionada((prev) => ({ ...prev, [hipotesis.id]: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    >
                      <option value="">Selecciona prueba, resultado, medición o hallazgo</option>
                      {[...evidencias].reverse().map((evento) => (
                        <option key={evento.id} value={evento.id}>{etiquetaEvento(evento.tipo_evento)} · {shortText(evento.texto_original)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void resolver(hipotesis.id, 'confirma')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-100">Confirmar</button>
                    <button type="button" onClick={() => void resolver(hipotesis.id, 'descarta')} className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-200">Descartar</button>
                  </div>
                </div>
              ) : null}

              {conflicto ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-rose-700">Evidencia contradictoria · requiere revisión humana</p>
                  <p className="mt-1 text-sm leading-6 text-rose-800">Existen relaciones que confirman y descartan esta misma hipótesis. Tralixia conserva ambas y no decide automáticamente cuál prevalece.</p>
                  {!sesionActivaDisponible ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      Para registrar una resolución humana trazable, inicia o reanuda una sesión de terreno en esta OT.
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!sesionActivaDisponible}
                      onClick={() => void resolverConflicto(hipotesis.id, 'confirmado')}
                      className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resolver como confirmada
                    </button>
                    <button
                      type="button"
                      disabled={!sesionActivaDisponible}
                      onClick={() => void resolverConflicto(hipotesis.id, 'descartado')}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resolver como descartada
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-rose-700">La resolución crea una decisión humana trazable. Las evidencias anteriores no se eliminan.</p>
                </div>
              ) : null}

              {!conflicto && conflictoHistorico && resolucionHumana ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600">
                  Antecedente: existió evidencia contradictoria. El estado actual fue resuelto mediante una decisión humana explícita.
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {mensaje ? <p className="mt-3 text-xs font-bold text-violet-700">{mensaje}</p> : null}
    </section>
  )
}
