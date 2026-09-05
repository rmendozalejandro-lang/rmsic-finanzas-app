'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { guardarOTVivaIndexedDB } from '@/lib/offline/ot-viva-indexeddb'
import { supabase } from '@/lib/supabase/client'

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
  motivo_pausa?: string | null
  interrumpido_at?: string | null
  reanudado_at?: string | null
  eventos: EventoLocal[]
}

type StoreV2 = {
  version: 2
  sesiones: SesionLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
  updated_at: string
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default function OTVivaInterruptionCard() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const [store, setStore] = useState<StoreV2 | null>(null)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    let intervalId = 0

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
          if (mounted) setStore(parsed)
        } catch {
          if (mounted) setError('No se pudo leer la sesión activa.')
        }
      }

      leer()
      intervalId = window.setInterval(leer, 500)
      window.addEventListener('tralixia:ot-viva-local-updated', leer)

      return () => {
        window.clearInterval(intervalId)
        window.removeEventListener('tralixia:ot-viva-local-updated', leer)
      }
    }

    let cleanup: (() => void) | undefined
    void cargar().then((fn) => { cleanup = fn })

    return () => {
      mounted = false
      if (intervalId) window.clearInterval(intervalId)
      cleanup?.()
    }
  }, [otId])

  const activa = useMemo(() => {
    if (!store?.sesion_activa_id) return null
    return store.sesiones.find((item) => item.id === store.sesion_activa_id && item.estado !== 'finalizada') ?? null
  }, [store])

  const checkpoint = useMemo(() => {
    if (!activa) return null
    const ultimo = activa.eventos.at(-1) ?? null
    const hipotesis = activa.eventos.filter((item) => item.tipo_evento === 'hipotesis' && item.nivel_certeza === 'hipotesis').at(-1) ?? null
    const pendiente = activa.eventos.filter((item) => item.tipo_evento === 'pendiente' || item.tipo_evento === 'recomendacion').at(-1) ?? null
    return { ultimo, hipotesis, pendiente }
  }, [activa])

  const persistir = async (next: StoreV2) => {
    if (!key) return
    const normalized = { ...next, version: 2 as const, updated_at: new Date().toISOString() }
    const raw = JSON.stringify(normalized)
    window.localStorage.setItem(key, raw)
    setStore(normalized)
    window.dispatchEvent(new Event('tralixia:ot-viva-local-updated'))
    try {
      await guardarOTVivaIndexedDB(key, raw)
      setError('')
    } catch {
      setError('El cambio quedó local, pero no se pudo actualizar el respaldo IndexedDB.')
    }
  }

  const interrumpir = async () => {
    if (!store || !activa || activa.estado !== 'en_curso') return
    const motivo = window.prompt('Motivo de la interrupción (opcional):', 'Llamada / atención externa')
    if (motivo === null) return
    const ahora = new Date().toISOString()
    await persistir({
      ...store,
      sesiones: store.sesiones.map((item) => item.id === activa.id ? {
        ...item,
        estado: 'interrumpida',
        estado_sync: 'local',
        motivo_pausa: motivo.trim() || 'Interrupción de terreno',
        interrumpido_at: ahora,
      } : item),
    })
    window.location.reload()
  }

  const reanudar = async () => {
    if (!store || !activa || activa.estado !== 'interrumpida') return
    const ahora = new Date().toISOString()
    await persistir({
      ...store,
      sesiones: store.sesiones.map((item) => item.id === activa.id ? {
        ...item,
        estado: 'en_curso',
        estado_sync: 'local',
        reanudado_at: ahora,
      } : item),
    })
    window.location.reload()
  }

  if (!activa || (activa.estado !== 'en_curso' && activa.estado !== 'interrumpida')) return null

  return (
    <section className={`mx-auto max-w-6xl rounded-2xl border p-4 shadow-sm ${activa.estado === 'interrumpida' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Continuidad de terreno</p>
          <h2 className="mt-1 text-base font-black text-slate-900">
            {activa.estado === 'interrumpida' ? 'Sesión interrumpida · checkpoint guardado' : 'Sesión activa · preparada para interrupciones'}
          </h2>
          {activa.estado === 'interrumpida' ? (
            <p className="mt-1 text-sm text-amber-800">
              {activa.motivo_pausa || 'Interrupción de terreno'} · {formatTime(activa.interrumpido_at)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Si una llamada o atención externa te corta el trabajo, guarda el punto exacto antes de continuar.</p>
          )}
        </div>

        <div className="shrink-0">
          {activa.estado === 'interrumpida' ? (
            <button type="button" onClick={() => void reanudar()} className="rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-black text-white hover:bg-[#245C90]">Reanudar sesión</button>
          ) : (
            <button type="button" onClick={() => void interrumpir()} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800 hover:bg-amber-100">Marcar interrupción</button>
          )}
        </div>
      </div>

      {activa.estado === 'interrumpida' && checkpoint ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Último registro</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{checkpoint.ultimo?.texto_original || 'Sin eventos previos.'}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Hipótesis abierta</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{checkpoint.hipotesis?.texto_original || 'Ninguna registrada.'}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pendiente / recomendación</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{checkpoint.pendiente?.texto_original || 'Ninguno registrado.'}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
    </section>
  )
}
