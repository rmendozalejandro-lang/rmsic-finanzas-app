'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import SyncStatusCard from '@/components/asistente/SyncStatusCard'
import {
  construirPlanSyncOTViva,
  type RelacionOTVivaLocal,
  type SesionOTVivaLocal,
} from '@/lib/asistente/ot-viva-sync'
import { sincronizarPlanOTVivaSupabase } from '@/lib/asistente/ot-viva-sync-supabase'
import { guardarOTVivaIndexedDB, leerOTVivaIndexedDB } from '@/lib/offline/ot-viva-indexeddb'
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

type RelacionLocal = {
  id: string
  evento_origen_id: string
  evento_destino_id: string
  tipo_relacion: string
  observacion?: string | null
  created_at: string
  estado_sync?: 'local' | 'pendiente_sync' | 'sincronizada' | 'error'
}

type StoreV2 = {
  version: 2
  sesiones: SesionLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
  relaciones?: RelacionLocal[]
  updated_at: string
}

type ContextoOT = {
  empresa_id: string
  cliente_id: string
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

function storeVacio(): StoreV2 {
  return {
    version: 2,
    sesiones: [],
    sesion_activa_id: null,
    sesion_seleccionada_id: null,
    relaciones: [],
    updated_at: new Date().toISOString(),
  }
}

function parseStore(raw: string): StoreV2 {
  const parsed = JSON.parse(raw) as StoreV2
  if (parsed.version !== 2 || !Array.isArray(parsed.sesiones)) {
    throw new Error('Formato local OT Viva no reconocido.')
  }
  return { ...parsed, relaciones: Array.isArray(parsed.relaciones) ? parsed.relaciones : [] }
}

export default function OTVivaSyncStatus() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const [store, setStore] = useState<StoreV2>(storeVacio)
  const [userId, setUserId] = useState('')
  const [contextoOT, setContextoOT] = useState<ContextoOT | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorSync, setErrorSync] = useState('')
  const [offlineProtegido, setOfflineProtegido] = useState(false)

  useEffect(() => {
    let mounted = true

    const cargar = async () => {
      if (!otId) return

      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData.user?.id
      if (!currentUserId) return

      const { data: ot } = await supabase
        .from('ot_ordenes_trabajo')
        .select('empresa_id, cliente_id, titulo, descripcion_solicitud, problema_reportado')
        .eq('id', otId)
        .maybeSingle()

      if (!ot?.empresa_id || !ot.cliente_id) return

      const empresaId = ot.empresa_id as string
      const key = storageKeyV2(empresaId, otId, currentUserId)

      if (mounted) {
        setUserId(currentUserId)
        setContextoOT({
          empresa_id: empresaId,
          cliente_id: ot.cliente_id as string,
          titulo: (ot.titulo as string) || 'OT sin título',
          descripcion_solicitud: (ot.descripcion_solicitud as string | null) ?? null,
          problema_reportado: (ot.problema_reportado as string | null) ?? null,
        })
      }

      const leerLocal = () => {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        try {
          const parsed = parseStore(raw)
          if (mounted) setStore(parsed)
          return { raw, parsed }
        } catch {
          if (mounted) setErrorSync('No se pudo leer el historial local de esta OT.')
          return null
        }
      }

      const respaldar = async (raw: string) => {
        try {
          await guardarOTVivaIndexedDB(key, raw)
          if (mounted) setOfflineProtegido(true)
        } catch {
          if (mounted) setOfflineProtegido(false)
        }
      }

      const actual = leerLocal()
      if (actual) {
        await respaldar(actual.raw)
      } else {
        try {
          const respaldo = await leerOTVivaIndexedDB(key)
          if (respaldo?.payload) {
            const recovered = parseStore(respaldo.payload)
            window.localStorage.setItem(key, respaldo.payload)
            if (mounted) {
              setStore(recovered)
              setOfflineProtegido(true)
              setMensaje('Historial local recuperado desde almacenamiento offline protegido.')
            }
            window.dispatchEvent(new Event('tralixia:ot-viva-local-updated'))
            window.setTimeout(() => window.location.reload(), 80)
          } else if (mounted) {
            setStore(storeVacio())
          }
        } catch {
          if (mounted) setStore(storeVacio())
        }
      }

      const leerYRespaldar = () => {
        const value = leerLocal()
        if (value) void respaldar(value.raw)
      }

      const onStorage = (event: StorageEvent) => {
        if (event.key === key) leerYRespaldar()
      }
      const onLocalUpdate = () => leerYRespaldar()
      const onPageHide = () => leerYRespaldar()
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') leerYRespaldar()
      }
      const intervalId = window.setInterval(leerYRespaldar, 250)

      window.addEventListener('storage', onStorage)
      window.addEventListener('tralixia:ot-viva-local-updated', onLocalUpdate)
      window.addEventListener('pagehide', onPageHide)
      document.addEventListener('visibilitychange', onVisibilityChange)

      return () => {
        window.clearInterval(intervalId)
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('tralixia:ot-viva-local-updated', onLocalUpdate)
        window.removeEventListener('pagehide', onPageHide)
        document.removeEventListener('visibilitychange', onVisibilityChange)
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
    const relaciones = store.relaciones ?? []
    const sesionesPendientes = sesiones.filter((sesion) => sesion.estado_sync !== 'sincronizada').length
    const relacionesPendientes = relaciones.filter((relacion) => relacion.estado_sync !== 'sincronizada').length
    return {
      sesiones: sesiones.length,
      eventos: sesiones.reduce((total, sesion) => total + (sesion.eventos?.length ?? 0), 0),
      relaciones: relaciones.length,
      sesionesPendientes,
      relacionesPendientes,
      pendientesSync: sesionesPendientes + relacionesPendientes,
    }
  }, [store])

  const persistirStore = (next: StoreV2) => {
    if (!contextoOT || !userId) return
    const normalized: StoreV2 = {
      ...next,
      relaciones: next.relaciones ?? [],
      version: 2,
      updated_at: new Date().toISOString(),
    }
    const key = storageKeyV2(contextoOT.empresa_id, otId, userId)
    const raw = JSON.stringify(normalized)
    window.localStorage.setItem(key, raw)
    void guardarOTVivaIndexedDB(key, raw)
      .then(() => setOfflineProtegido(true))
      .catch(() => setOfflineProtegido(false))
    setStore(normalized)
    window.dispatchEvent(new Event('tralixia:ot-viva-local-updated'))
  }

  const sincronizar = async () => {
    if (!contextoOT || !userId || resumen.pendientesSync === 0 || sincronizando) return

    const relacionesPendientes = (store.relaciones ?? []).filter((relacion) => relacion.estado_sync !== 'sincronizada')
    const sesionesPendientes = store.sesiones.filter((sesion) => sesion.estado_sync !== 'sincronizada')
    const sesionesParaPlan = relacionesPendientes.length > 0 ? store.sesiones : sesionesPendientes
    const totalEventos = sesionesParaPlan.reduce((total, sesion) => total + sesion.eventos.length, 0)

    const confirmado = window.confirm(
      `Se sincronizarán ${sesionesParaPlan.length} sesión(es), ${totalEventos} evento(s) y ${relacionesPendientes.length} relación(es) técnica(s) con Tralixia. Los datos locales se conservarán. ¿Continuar?`,
    )
    if (!confirmado) return

    setSincronizando(true)
    setMensaje('')
    setErrorSync('')

    persistirStore({
      ...store,
      sesiones: store.sesiones.map((sesion) =>
        sesionesParaPlan.some((item) => item.id === sesion.id) && sesion.estado_sync !== 'sincronizada'
          ? { ...sesion, estado_sync: 'pendiente_sync' as const }
          : sesion,
      ),
      relaciones: (store.relaciones ?? []).map((relacion) =>
        relacion.estado_sync === 'sincronizada'
          ? relacion
          : { ...relacion, estado_sync: 'pendiente_sync' as const },
      ),
    })

    try {
      const plan = construirPlanSyncOTViva(
        {
          empresa_id: contextoOT.empresa_id,
          cliente_id: contextoOT.cliente_id,
          ot_id: otId,
          titulo: contextoOT.titulo,
          descripcion_inicial: contextoOT.descripcion_solicitud,
          problema_reportado: contextoOT.problema_reportado,
          usuario_id: userId,
        },
        sesionesParaPlan as SesionOTVivaLocal[],
        relacionesPendientes as RelacionOTVivaLocal[],
      )

      const resultado = await sincronizarPlanOTVivaSupabase(supabase, plan)
      const syncedSessionIds = new Set(sesionesParaPlan.map((sesion) => sesion.id))
      const syncedRelationIds = new Set(relacionesPendientes.map((relacion) => relacion.id))

      const key = storageKeyV2(contextoOT.empresa_id, otId, userId)
      const rawActual = window.localStorage.getItem(key)
      const base = rawActual ? parseStore(rawActual) : store

      persistirStore({
        ...base,
        sesiones: base.sesiones.map((sesion) =>
          syncedSessionIds.has(sesion.id)
            ? { ...sesion, estado_sync: 'sincronizada' as const }
            : sesion,
        ),
        relaciones: (base.relaciones ?? []).map((relacion) =>
          syncedRelationIds.has(relacion.id)
            ? { ...relacion, estado_sync: 'sincronizada' as const }
            : relacion,
        ),
      })

      setMensaje(`Sincronización completada: ${resultado.sesiones_procesadas} sesión(es), ${resultado.eventos_procesados} evento(s) y ${resultado.relaciones_procesadas} relación(es).${offlineProtegido ? ' Respaldo offline activo.' : ''}`)
    } catch (err) {
      const key = storageKeyV2(contextoOT.empresa_id, otId, userId)
      const rawActual = window.localStorage.getItem(key)
      const base = rawActual ? parseStore(rawActual) : store
      const failedSessionIds = new Set(sesionesParaPlan.map((sesion) => sesion.id))
      const failedRelationIds = new Set(relacionesPendientes.map((relacion) => relacion.id))

      persistirStore({
        ...base,
        sesiones: base.sesiones.map((sesion) =>
          failedSessionIds.has(sesion.id) && sesion.estado_sync !== 'sincronizada'
            ? { ...sesion, estado_sync: 'error' as const }
            : sesion,
        ),
        relaciones: (base.relaciones ?? []).map((relacion) =>
          failedRelationIds.has(relacion.id)
            ? { ...relacion, estado_sync: 'error' as const }
            : relacion,
        ),
      })
      setErrorSync(err instanceof Error ? err.message : 'La sincronización falló. Los datos locales permanecen intactos.')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-0 pb-0">
      <SyncStatusCard
        sesiones={resumen.sesiones}
        eventos={resumen.eventos}
        pendientesSync={resumen.pendientesSync}
        sincronizando={sincronizando}
        mensaje={mensaje || (offlineProtegido ? `Respaldo offline protegido activo. ${resumen.relaciones} relación(es) técnica(s) local(es).` : '')}
        errorSync={errorSync}
        onSync={sincronizar}
      />
    </div>
  )
}
