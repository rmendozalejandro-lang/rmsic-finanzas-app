'use client'

import { useEffect, useRef, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

const STORAGE_KEY = 'tralixia_ot_viva_avisos_voz'
const STABILIZE_MS = 4500
const REPEAT_GUARD_MS = 30000

type Props = {
  audioOcupado: boolean
}

export default function OTVivaConnectivityAlerts({ audioOcupado }: Props) {
  const { isOnline } = useNetworkStatus()
  const [vozActivada, setVozActivada] = useState(true)
  const [aviso, setAviso] = useState('')
  const [permisoVoz, setPermisoVoz] = useState(false)
  const initialRef = useRef(true)
  const lastConfirmedRef = useRef<boolean | null>(null)
  const lastSpokenRef = useRef(0)
  const pendingRef = useRef<string | null>(null)
  const busyRef = useRef(audioOcupado)
  const voiceRef = useRef(true)
  const voiceReadyRef = useRef(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        const enabled = saved !== 'false'
        setVozActivada(enabled)
        voiceRef.current = enabled
      }
    } catch {
      // Session-only preference if storage is unavailable.
    }
    setPermisoVoz(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  useEffect(() => {
    busyRef.current = audioOcupado
    if (!audioOcupado && pendingRef.current) {
      const message = pendingRef.current
      pendingRef.current = null
      if (voiceRef.current && voiceReadyRef.current && 'speechSynthesis' in window && document.visibilityState === 'visible') {
        try {
          const utterance = new SpeechSynthesisUtterance(message)
          utterance.lang = 'es-CL'
          utterance.rate = 1
          window.speechSynthesis.speak(utterance)
          lastSpokenRef.current = Date.now()
        } catch {
          // The visual notice remains available.
        }
      }
    }
  }, [audioOcupado])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (initialRef.current) {
        initialRef.current = false
        lastConfirmedRef.current = isOnline
        if (!isOnline) setAviso('Sin conexión. Puedes continuar escribiendo; conserva el borrador local antes de registrarlo.')
        return
      }
      if (lastConfirmedRef.current === isOnline) return
      lastConfirmedRef.current = isOnline
      const message = isOnline
        ? 'Tralixia recuperó la conexión. Revisa los registros pendientes de sincronización.'
        : 'Tralixia está sin conexión. Puedes continuar trabajando con los borradores locales.'
      setAviso(message)
      if (!voiceRef.current || !voiceReadyRef.current || !('speechSynthesis' in window)) return
      if (Date.now() - lastSpokenRef.current < REPEAT_GUARD_MS || busyRef.current || document.visibilityState !== 'visible') {
        pendingRef.current = busyRef.current ? message : null
        return
      }
      try {
        const utterance = new SpeechSynthesisUtterance(message)
        utterance.lang = 'es-CL'
        utterance.rate = 1
        window.speechSynthesis.speak(utterance)
        lastSpokenRef.current = Date.now()
      } catch {
        // Speech is best effort, not a confirmation of synchronization.
      }
    }, STABILIZE_MS)
    return () => window.clearTimeout(timer)
  }, [isOnline])

  useEffect(() => {
    return () => {
      pendingRef.current = null
    }
  }, [])

  function toggleVoz(enabled: boolean) {
    setVozActivada(enabled)
    voiceRef.current = enabled
    if (!enabled) pendingRef.current = null
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // Do not prevent field work if storage is restricted.
    }
  }

  function probarVoz() {
    if (!('speechSynthesis' in window) || audioOcupado) return
    try {
      voiceReadyRef.current = true
      const utterance = new SpeechSynthesisUtterance('Avisos de conectividad de Tralixia activados.')
      utterance.lang = 'es-CL'
      utterance.rate = 1
      window.speechSynthesis.speak(utterance)
      setAviso('Prueba de voz solicitada. En iPhone, manten la pagina visible para comprobar el audio.')
    } catch {
      setAviso('El navegador no permitió reproducir el aviso hablado. El indicador visual sigue disponible.')
    }
  }

  return (
    <section className={`rounded-2xl border px-4 py-3 ${isOnline ? 'border-sky-200 bg-sky-50' : 'border-amber-300 bg-amber-50'}`} aria-label="Avisos de conectividad OT Viva">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{isOnline ? 'OT Viva · Con conexión' : 'OT Viva · Sin conexión'}</p>
          <p className="text-xs text-slate-700">Avisos visuales siempre activos; la voz no confirma guardado ni sincronización.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={vozActivada} onChange={(e) => toggleVoz(e.target.checked)} />
            Avisos por voz
          </label>
          <button type="button" onClick={probarVoz} disabled={!vozActivada || !permisoVoz || audioOcupado} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Activar / probar voz
          </button>
        </div>
      </div>
      {aviso ? <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-800">{aviso}</p> : null}
      {vozActivada && <p className="mt-1 text-xs text-slate-600">En iPhone, toca «Activar / probar voz» una vez. Safari puede impedir avisos hablados en segundo plano o con la pantalla bloqueada.</p>}
    </section>
  )
}
