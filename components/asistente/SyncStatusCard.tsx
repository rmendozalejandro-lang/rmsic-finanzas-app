'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  descripcionPreparacionSync,
  type EstadoPreparacionSync,
  verificarPreparacionSyncAsistente,
} from '@/lib/asistente/sync-readiness'

type Props = {
  sesiones: number
  eventos: number
  pendientesSync: number
}

type EstadoUI = 'revisando' | 'disponible' | 'bloqueada'

export default function SyncStatusCard({ sesiones, eventos, pendientesSync }: Props) {
  const [estado, setEstado] = useState<EstadoPreparacionSync | null>(null)
  const [revisando, setRevisando] = useState(true)

  useEffect(() => {
    let mounted = true

    const revisar = async () => {
      setRevisando(true)
      try {
        const resultado = await verificarPreparacionSyncAsistente(supabase)
        if (mounted) setEstado(resultado)
      } finally {
        if (mounted) setRevisando(false)
      }
    }

    void revisar()
    return () => { mounted = false }
  }, [])

  const estadoUI: EstadoUI = revisando ? 'revisando' : estado?.disponible ? 'disponible' : 'bloqueada'
  const texto = revisando
    ? 'Verificando disponibilidad del núcleo Asistente Tralixia...'
    : estado
      ? descripcionPreparacionSync(estado)
      : 'Sincronización no disponible.'

  const detalle = useMemo(() => {
    if (!estado || revisando) return null
    if (estado.tablas_faltantes.length > 0) {
      return `Faltan: ${estado.tablas_faltantes.join(', ')}`
    }
    if (estado.errores.length > 0) {
      return `Validación pendiente por acceso/permisos en ${estado.errores.map((item) => item.tabla).join(', ')}`
    }
    return 'El núcleo mínimo requerido está disponible.'
  }, [estado, revisando])

  const tono = estadoUI === 'disponible'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : estadoUI === 'revisando'
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${tono}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-70">Estado de sincronización</p>
          <h2 className="mt-1 text-lg font-black">{texto}</h2>
          {detalle ? <p className="mt-2 text-xs font-semibold opacity-75">{detalle}</p> : null}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-current/15 bg-white/60 px-3 py-2">
            <p className="text-lg font-black">{sesiones}</p>
            <p className="text-[10px] font-black uppercase tracking-wide opacity-65">Sesiones</p>
          </div>
          <div className="rounded-xl border border-current/15 bg-white/60 px-3 py-2">
            <p className="text-lg font-black">{eventos}</p>
            <p className="text-[10px] font-black uppercase tracking-wide opacity-65">Eventos</p>
          </div>
          <div className="rounded-xl border border-current/15 bg-white/60 px-3 py-2">
            <p className="text-lg font-black">{pendientesSync}</p>
            <p className="text-[10px] font-black uppercase tracking-wide opacity-65">Pend. sync</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-wide">
          {estadoUI === 'disponible' ? 'Lista para habilitar' : estadoUI === 'revisando' ? 'Verificando' : 'Solo local'}
        </span>
        <button
          type="button"
          disabled
          className="rounded-xl border border-current/20 bg-white/60 px-4 py-2 text-xs font-black opacity-60 disabled:cursor-not-allowed"
          title="La escritura real se habilitará solo después de aplicar y validar el núcleo asistente_* en Supabase."
        >
          Sincronizar con Tralixia
        </button>
        <span className="text-xs font-semibold opacity-70">El botón permanece bloqueado por seguridad.</span>
      </div>
    </section>
  )
}
