'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  construirPlanSyncOTViva,
  type RelacionOTVivaLocal,
  type SesionOTVivaLocal,
} from '@/lib/asistente/ot-viva-sync'
import { supabase } from '@/lib/supabase/client'

type StoreV2 = {
  version: 2
  sesiones: SesionOTVivaLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
  relaciones?: RelacionOTVivaLocal[]
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

export default function OTVivaSyncPreview() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const [store, setStore] = useState<StoreV2 | null>(null)
  const [contexto, setContexto] = useState<ContextoOT | null>(null)
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    const cargar = async () => {
      if (!otId) return

      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData.user?.id
      if (!currentUserId) return

      const { data: ot, error: otError } = await supabase
        .from('ot_ordenes_trabajo')
        .select('empresa_id, cliente_id, titulo, descripcion_solicitud, problema_reportado')
        .eq('id', otId)
        .maybeSingle()

      if (otError) {
        if (mounted) setError(`No se pudo preparar la vista previa: ${otError.message}`)
        return
      }
      if (!ot?.empresa_id || !ot.cliente_id) return

      const empresaId = ot.empresa_id as string
      const key = storageKeyV2(empresaId, otId, currentUserId)

      if (mounted) {
        setUserId(currentUserId)
        setContexto({
          empresa_id: empresaId,
          cliente_id: ot.cliente_id as string,
          titulo: (ot.titulo as string) || 'OT sin título',
          descripcion_solicitud: (ot.descripcion_solicitud as string | null) ?? null,
          problema_reportado: (ot.problema_reportado as string | null) ?? null,
        })
      }

      const leer = () => {
        const raw = window.localStorage.getItem(key)
        if (!raw) {
          if (mounted) setStore(null)
          return
        }
        try {
          const parsed = JSON.parse(raw) as StoreV2
          if (parsed.version !== 2 || !Array.isArray(parsed.sesiones)) {
            throw new Error('Formato local no reconocido.')
          }
          if (mounted) {
            setStore({ ...parsed, relaciones: Array.isArray(parsed.relaciones) ? parsed.relaciones : [] })
            setError('')
          }
        } catch (err) {
          if (mounted) setError(err instanceof Error ? err.message : 'No se pudo leer el historial local.')
        }
      }

      leer()
      const onUpdate = () => leer()
      const intervalId = window.setInterval(leer, 750)
      window.addEventListener('tralixia:ot-viva-local-updated', onUpdate)

      cleanup = () => {
        window.clearInterval(intervalId)
        window.removeEventListener('tralixia:ot-viva-local-updated', onUpdate)
      }
    }

    void cargar()
    return () => {
      mounted = false
      cleanup?.()
    }
  }, [otId])

  const plan = useMemo(() => {
    if (!store || !contexto || !userId || store.sesiones.length === 0) return null
    try {
      return construirPlanSyncOTViva(
        {
          empresa_id: contexto.empresa_id,
          cliente_id: contexto.cliente_id,
          ot_id: otId,
          titulo: contexto.titulo,
          descripcion_inicial: contexto.descripcion_solicitud,
          problema_reportado: contexto.problema_reportado,
          usuario_id: userId,
        },
        store.sesiones,
        store.relaciones ?? [],
      )
    } catch {
      return null
    }
  }, [store, contexto, userId, otId])

  const resumen = useMemo(() => {
    if (!plan) return null
    const eventos = plan.sesiones.reduce((total, sesion) => total + sesion.eventos.length, 0)
    const interrumpidas = plan.sesiones.filter((sesion) => sesion.sesion.estado === 'interrumpida').length
    const finalizadas = plan.sesiones.filter((sesion) => sesion.sesion.estado === 'finalizada').length
    return {
      sesiones: plan.sesiones.length,
      eventos,
      relaciones: plan.relaciones.length,
      interrumpidas,
      finalizadas,
    }
  }, [plan])

  if (!plan || !resumen) return null

  return (
    <section className="mx-auto max-w-6xl rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Vista previa segura</p>
          <h2 className="mt-1 text-base font-black text-slate-900">Plan de sincronización OT Viva → Asistente Tralixia</h2>
          <p className="mt-1 text-sm text-slate-600">Construye el plan localmente para validar estructura y conteos. No escribe nada en Supabase.</p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((actual) => !actual)}
          className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-black text-blue-800 hover:bg-blue-100"
        >
          {abierto ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-xl border border-blue-200 bg-white p-3 text-center"><p className="text-lg font-black text-slate-900">{resumen.sesiones}</p><p className="text-[10px] font-black uppercase text-slate-500">Sesiones</p></div>
        <div className="rounded-xl border border-blue-200 bg-white p-3 text-center"><p className="text-lg font-black text-slate-900">{resumen.eventos}</p><p className="text-[10px] font-black uppercase text-slate-500">Eventos</p></div>
        <div className="rounded-xl border border-blue-200 bg-white p-3 text-center"><p className="text-lg font-black text-slate-900">{resumen.relaciones}</p><p className="text-[10px] font-black uppercase text-slate-500">Relaciones</p></div>
        <div className="rounded-xl border border-blue-200 bg-white p-3 text-center"><p className="text-lg font-black text-slate-900">{resumen.interrumpidas}</p><p className="text-[10px] font-black uppercase text-slate-500">Interrumpidas</p></div>
        <div className="rounded-xl border border-blue-200 bg-white p-3 text-center"><p className="text-lg font-black text-slate-900">{resumen.finalizadas}</p><p className="text-[10px] font-black uppercase text-slate-500">Finalizadas</p></div>
      </div>

      {abierto ? (
        <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-white p-4 text-sm text-slate-700">
          <div><span className="font-black text-slate-900">Caso:</span> {plan.caso.titulo}</div>
          <div><span className="font-black text-slate-900">Dominio:</span> {plan.caso.dominio} · <span className="font-black text-slate-900">Tipo:</span> {plan.caso.tipo_caso}</div>
          <div><span className="font-black text-slate-900">Estado del caso:</span> {plan.caso.estado} <span className="text-slate-500">(finalizar una sesión no cierra automáticamente el caso)</span></div>
          <div><span className="font-black text-slate-900">Vínculo OT:</span> {plan.vinculo_ot.rol}</div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-black text-slate-900">Sesiones incluidas</p>
            <div className="mt-2 space-y-1">
              {plan.sesiones.map((sesion, index) => (
                <p key={sesion.local_session_id} className="text-xs text-slate-600">
                  Sesión {index + 1}: {sesion.sesion.estado} · {sesion.eventos.length} evento(s) · checkpoint {Object.keys(sesion.sesion.checkpoint ?? {}).length > 0 ? 'incluido' : 'vacío'}
                </p>
              ))}
            </div>
          </div>
          <p className="text-xs font-bold text-blue-800">Vista previa únicamente. No se ejecutan INSERT, UPDATE, UPSERT ni DELETE.</p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
    </section>
  )
}
