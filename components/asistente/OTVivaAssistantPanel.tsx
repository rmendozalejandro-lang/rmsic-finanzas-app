'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type EventoLocal = {
  id: string
  tipo_evento: string
  nivel_certeza: string
  texto_original: string
  ocurrido_at?: string
}

type RelacionLocal = {
  evento_origen_id: string
  evento_destino_id: string
  tipo_relacion: string
}

type StoreV2 = {
  version: 2
  sesiones: Array<{ eventos: EventoLocal[] }>
  relaciones?: RelacionLocal[]
}

type OTInfo = {
  empresa_id: string
  folio: string | null
  titulo: string | null
  cliente_id: string | null
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

function renderInline(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return partes.filter(Boolean).map((parte, index) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={index} className="font-black text-slate-900">{parte.slice(2, -2)}</strong>
    }
    return <Fragment key={index}>{parte}</Fragment>
  })
}

function RespuestaFormateada({ texto }: { texto: string }) {
  const lineas = texto.split(/\r?\n/)
  const bloques: ReactNode[] = []
  let lista: string[] = []

  const vaciarLista = () => {
    if (!lista.length) return
    bloques.push(
      <ul key={`lista-${bloques.length}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-800">
        {lista.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
      </ul>,
    )
    lista = []
  }

  lineas.forEach((linea, index) => {
    const limpia = linea.trim()
    if (!limpia) {
      vaciarLista()
      return
    }

    if (/^[-*]\s+/.test(limpia)) {
      lista.push(limpia.replace(/^[-*]\s+/, ''))
      return
    }

    vaciarLista()

    const heading = limpia.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      bloques.push(
        <h3 key={`h-${index}`} className="mb-1 mt-4 text-sm font-black text-slate-950 first:mt-0">
          {renderInline(heading[2])}
        </h3>,
      )
      return
    }

    bloques.push(
      <p key={`p-${index}`} className="my-1 text-sm leading-6 text-slate-800">
        {renderInline(limpia)}
      </p>,
    )
  })

  vaciarLista()
  return <div>{bloques}</div>
}

export default function OTVivaAssistantPanel() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const otId = params?.id || ''
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [store, setStore] = useState<StoreV2 | null>(null)
  const [ot, setOt] = useState<OTInfo | null>(null)
  const [clienteNombre, setClienteNombre] = useState<string | null>(null)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    const cargar = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const uid = authData.user?.id
      if (!uid || !otId) return

      const { data: otData } = await supabase
        .from('ot_ordenes_trabajo')
        .select('empresa_id, folio, titulo, cliente_id')
        .eq('id', otId)
        .maybeSingle()

      if (!otData?.empresa_id) return

      if (mounted) {
        setUserId(uid)
        setOt(otData as OTInfo)
      }

      if (otData.cliente_id) {
        const { data: cliente } = await supabase
          .from('clientes')
          .select('nombre')
          .eq('id', otData.cliente_id)
          .maybeSingle()
        if (mounted) setClienteNombre((cliente?.nombre as string | undefined) ?? null)
      }

      const key = storageKeyV2(otData.empresa_id as string, otId, uid)
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
      const intervalId = window.setInterval(leer, 700)
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
  const eventoMap = useMemo(() => new Map(eventos.map((evento) => [evento.id, evento])), [eventos])
  const relaciones = useMemo(() => {
    return (store?.relaciones ?? []).map((relacion) => ({
      tipo_relacion: relacion.tipo_relacion,
      origen_texto: eventoMap.get(relacion.evento_origen_id)?.texto_original,
      destino_texto: eventoMap.get(relacion.evento_destino_id)?.texto_original,
    }))
  }, [store, eventoMap])

  const consultar = async () => {
    const texto = pregunta.trim()
    if (!texto || cargando || !ot || !userId) return

    setCargando(true)
    setError('')
    setRespuesta('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No hay una sesión válida para consultar al asistente.')

      const response = await fetch('/api/asistente/rmsic', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pregunta: texto,
          ot: {
            folio: ot.folio,
            titulo: ot.titulo,
            cliente: clienteNombre,
          },
          eventos: eventos.map((evento) => ({
            tipo_evento: evento.tipo_evento,
            nivel_certeza: evento.nivel_certeza,
            texto_original: evento.texto_original,
            ocurrido_at: evento.ocurrido_at,
          })),
          relaciones,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'No se pudo consultar al Asistente RMSIC.')
      setRespuesta(String(data?.respuesta || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al consultar al asistente.')
    } finally {
      setCargando(false)
    }
  }

  if (pathname.endsWith('/relaciones')) return null

  return (
    <section className="mx-auto max-w-6xl rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-violet-600">Asistente RMSIC · IA</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Segunda mirada técnica</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Consulta usando los eventos y relaciones ya registrados en esta OT. La respuesta no modifica la memoria técnica ni confirma hipótesis automáticamente.</p>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{eventos.length} EVENTOS</span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <textarea
          value={pregunta}
          onChange={(event) => setPregunta(event.target.value)}
          placeholder="Ej.: Con lo que hemos medido hasta ahora, ¿qué hipótesis sigue siendo más probable y qué prueba harías después?"
          rows={4}
          className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none focus:border-violet-400"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void consultar()}
            disabled={!pregunta.trim() || cargando || !ot}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? 'Analizando…' : 'Consultar asistente'}
          </button>
          <button type="button" onClick={() => setPregunta('Distingue estrictamente lo registrado en Tralixia de tu interpretación. Indica qué está observado, medido o informado, qué hipótesis siguen abiertas y qué evidencia falta.')} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Usar pregunta sugerida</button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {respuesta ? (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-violet-600">Respuesta del asistente</p>
          <div className="mt-2"><RespuestaFormateada texto={respuesta} /></div>
        </div>
      ) : null}
    </section>
  )
}
