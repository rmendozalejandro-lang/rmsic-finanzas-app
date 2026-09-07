'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  claseEstadoSesionOTViva,
  etiquetaEstadoSesionOTViva,
  type EstadoSesionOTViva,
} from '@/lib/asistente/ot-viva-session-state'
import { supabase } from '@/lib/supabase/client'

type SesionLocal = {
  id: string
  estado: EstadoSesionOTViva
  iniciado_at: string
  finalizado_at: string | null
}

type StoreV2 = {
  version: 2
  sesiones: SesionLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

export default function OTVivaSessionStateStrip() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const [store, setStore] = useState<StoreV2 | null>(null)

  useEffect(() => {
    let mounted = true
    let intervalId = 0
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

      const key = storageKeyV2(empresaId, otId, userId)
      const leer = () => {
        const raw = window.localStorage.getItem(key)
        if (!raw) {
          if (mounted) setStore(null)
          return
        }
        try {
          const parsed = JSON.parse(raw) as StoreV2
          if (mounted) setStore(parsed)
        } catch {
          if (mounted) setStore(null)
        }
      }

      leer()
      intervalId = window.setInterval(leer, 500)
      window.addEventListener('tralixia:ot-viva-local-updated', leer)
      cleanup = () => {
        if (intervalId) window.clearInterval(intervalId)
        window.removeEventListener('tralixia:ot-viva-local-updated', leer)
      }
    }

    void cargar()
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

  if (!activa) return null

  return (
    <section className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Estado unificado de sesión</p>
        <p className="mt-1 text-sm font-bold text-slate-800">La sesión activa se encuentra en estado:</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${claseEstadoSesionOTViva(activa.estado)}`}>
        {etiquetaEstadoSesionOTViva(activa.estado)}
      </span>
    </section>
  )
}
