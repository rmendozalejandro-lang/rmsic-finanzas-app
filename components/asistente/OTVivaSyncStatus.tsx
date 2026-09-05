'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import SyncStatusCard from '@/components/asistente/SyncStatusCard'
import { supabase } from '@/lib/supabase/client'

type EventoLocal = { id?: string }
type SesionLocal = {
  id?: string
  estado_sync?: 'local' | 'pendiente_sync' | 'sincronizada' | 'error'
  eventos?: EventoLocal[]
}
type StoreV2 = {
  version?: number
  sesiones?: SesionLocal[]
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

export default function OTVivaSyncStatus() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const [store, setStore] = useState<StoreV2>({ sesiones: [] })

  useEffect(() => {
    let mounted = true

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

      const leer = () => {
        const raw = window.localStorage.getItem(storageKeyV2(empresaId, otId, userId))
        if (!raw) {
          if (mounted) setStore({ sesiones: [] })
          return
        }

        try {
          const parsed = JSON.parse(raw) as StoreV2
          if (mounted) setStore(parsed)
        } catch {
          if (mounted) setStore({ sesiones: [] })
        }
      }

      leer()

      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKeyV2(empresaId, otId, userId)) leer()
      }
      const onLocalUpdate = () => leer()

      window.addEventListener('storage', onStorage)
      window.addEventListener('tralixia:ot-viva-local-updated', onLocalUpdate)

      return () => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('tralixia:ot-viva-local-updated', onLocalUpdate)
      }
    }

    let cleanup: (() => void) | undefined
    void cargar().then((fn) => { cleanup = fn })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [otId])

  const resumen = useMemo(() => {
    const sesiones = store.sesiones ?? []
    return {
      sesiones: sesiones.length,
      eventos: sesiones.reduce((total, sesion) => total + (sesion.eventos?.length ?? 0), 0),
      pendientesSync: sesiones.filter((sesion) => sesion.estado_sync !== 'sincronizada').length,
    }
  }, [store])

  return (
    <div className="mx-auto max-w-6xl px-0 pb-0">
      <SyncStatusCard
        sesiones={resumen.sesiones}
        eventos={resumen.eventos}
        pendientesSync={resumen.pendientesSync}
      />
    </div>
  )
}
