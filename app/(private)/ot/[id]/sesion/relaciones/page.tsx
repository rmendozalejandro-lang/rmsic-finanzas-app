'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'
import { supabase } from '@/lib/supabase/client'

type TipoEvento =
  | 'hallazgo'
  | 'medicion'
  | 'hipotesis'
  | 'prueba'
  | 'accion'
  | 'resultado'
  | 'recomendacion'
  | 'pendiente'
  | 'decision_cliente'
  | 'observacion'

type NivelCerteza =
  | 'informado'
  | 'observado'
  | 'medido'
  | 'hipotesis'
  | 'confirmado'
  | 'descartado'

type TipoRelacion =
  | 'origina'
  | 'confirma'
  | 'descarta'
  | 'resultado_de'
  | 'causa_de'
  | 'recomendacion_de'
  | 'decision_sobre'
  | 'seguimiento_de'
  | 'relacionado_con'

type EventoLocal = {
  id: string
  tipo_evento: TipoEvento
  nivel_certeza: NivelCerteza
  texto_original: string
  descripcion_tecnica: string
  componente: string
  prioridad: 'baja' | 'media' | 'alta' | 'critica' | null
  visible_cliente: boolean
  incluir_ot: boolean
  ocurrido_at: string
}

type RelacionLocal = {
  id: string
  evento_origen_id: string
  evento_destino_id: string
  tipo_relacion: TipoRelacion
  observacion: string
  created_at: string
}

type SesionLocal = {
  id: string
  estado: 'en_curso' | 'pausada' | 'finalizada'
  iniciado_at: string
  finalizado_at: string | null
  eventos: EventoLocal[]
  relaciones?: RelacionLocal[]
}

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  titulo: string
  tecnico_responsable_id: string | null
  created_by: string | null
}

type OTResumen = {
  cliente_nombre: string | null
  equipo_tag: string | null
  equipo_nombre: string | null
}

const RELACIONES: Array<{ value: TipoRelacion; label: string; ayuda: string }> = [
  { value: 'origina', label: 'Origina', ayuda: 'El evento de origen genera o conduce al evento destino.' },
  { value: 'confirma', label: 'Confirma', ayuda: 'El origen entrega evidencia que confirma el destino.' },
  { value: 'descarta', label: 'Descarta', ayuda: 'El origen entrega evidencia que descarta el destino.' },
  { value: 'resultado_de', label: 'Resultado de', ayuda: 'El origen corresponde al resultado de una prueba o acción destino.' },
  { value: 'causa_de', label: 'Causa de', ayuda: 'El origen representa una causa confirmada del evento destino.' },
  { value: 'recomendacion_de', label: 'Recomendación de', ayuda: 'El origen es una recomendación derivada del evento destino.' },
  { value: 'decision_sobre', label: 'Decisión sobre', ayuda: 'El origen registra una decisión del cliente sobre el evento destino.' },
  { value: 'seguimiento_de', label: 'Seguimiento de', ayuda: 'El origen continúa o revisa posteriormente el evento destino.' },
  { value: 'relacionado_con', label: 'Relacionado con', ayuda: 'Relación técnica general cuando ninguna categoría anterior aplica.' },
]

function storageKey(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v1_${empresaId}_${otId}_${userId}`
}

function eventLabel(value: TipoEvento) {
  const map: Record<TipoEvento, string> = {
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
  return map[value]
}

function certaintyClass(value: NivelCerteza) {
  if (value === 'confirmado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'descartado') return 'border-slate-300 bg-slate-100 text-slate-600'
  if (value === 'hipotesis') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (value === 'medido') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (value === 'informado') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-cyan-200 bg-cyan-50 text-cyan-700'
}

function localTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function shortText(value: string, max = 100) {
  const limpio = value.trim().replace(/\s+/g, ' ')
  return limpio.length <= max ? limpio : `${limpio.slice(0, max)}…`
}

export default function RelacionesTecnicasPage() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [resumen, setResumen] = useState<OTResumen | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [sesion, setSesion] = useState<SesionLocal | null>(null)

  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [tipoRelacion, setTipoRelacion] = useState<TipoRelacion>('resultado_de')
  const [observacion, setObservacion] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw new Error(`No se pudo validar el usuario: ${authError.message}`)
        const user = authData.user
        if (!user) throw new Error('No hay usuario autenticado.')

        const [detalleResp, resumenResp] = await Promise.all([
          supabase
            .from('ot_ordenes_trabajo')
            .select('id, folio, empresa_id, titulo, tecnico_responsable_id, created_by')
            .eq('id', otId)
            .eq('activo', true)
            .is('deleted_at', null)
            .maybeSingle(),
          supabase.from('ot_vw_resumen').select('cliente_nombre, equipo_tag, equipo_nombre').eq('id', otId).maybeSingle(),
        ])

        if (detalleResp.error) throw new Error(`No se pudo cargar la OT: ${detalleResp.error.message}`)
        if (resumenResp.error) throw new Error(`No se pudo cargar el resumen: ${resumenResp.error.message}`)
        if (!detalleResp.data) throw new Error('No se encontró la OT.')

        const ot = detalleResp.data as OTDetalle
        const empresaActivaId = window.localStorage.getItem('empresa_activa_id') || ''
        let rolActual = ''

        if (empresaActivaId) {
          const rolResp = await supabase
            .from('usuario_empresas')
            .select('rol')
            .eq('usuario_id', user.id)
            .eq('empresa_id', empresaActivaId)
            .eq('activo', true)
            .maybeSingle()
          if (!rolResp.error && rolResp.data?.rol) rolActual = rolResp.data.rol
        }

        if (rolActual === 'tecnico_ot' && ot.tecnico_responsable_id !== user.id && ot.created_by !== user.id) {
          throw new Error('No tienes permisos para ejecutar esta OT.')
        }

        const raw = window.localStorage.getItem(storageKey(ot.empresa_id, ot.id, user.id))
        let sessionDraft: SesionLocal | null = null
        if (raw) {
          try {
            sessionDraft = JSON.parse(raw) as SesionLocal
            if (sessionDraft && !Array.isArray(sessionDraft.relaciones)) sessionDraft.relaciones = []
          } catch {
            window.localStorage.removeItem(storageKey(ot.empresa_id, ot.id, user.id))
          }
        }

        if (!mounted) return
        setCurrentUserId(user.id)
        setDetalle(ot)
        setResumen((resumenResp.data ?? null) as OTResumen | null)
        setSesion(sessionDraft)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'No se pudieron cargar las relaciones técnicas.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (otId) void load()
    return () => { mounted = false }
  }, [otId])

  const persist = (next: SesionLocal) => {
    if (!detalle || !currentUserId) return
    window.localStorage.setItem(storageKey(detalle.empresa_id, detalle.id, currentUserId), JSON.stringify(next))
    setSesion(next)
  }

  const eventosById = useMemo(() => {
    const map = new Map<string, EventoLocal>()
    for (const evento of sesion?.eventos ?? []) map.set(evento.id, evento)
    return map
  }, [sesion])

  const relaciones = sesion?.relaciones ?? []

  const hipotesis = useMemo(
    () => (sesion?.eventos ?? []).filter((evento) => evento.tipo_evento === 'hipotesis'),
    [sesion],
  )

  const estadoHipotesis = (hipotesisId: string) => {
    const relacionadas = relaciones.filter((rel) => rel.evento_destino_id === hipotesisId)
    if (relacionadas.some((rel) => rel.tipo_relacion === 'confirma')) return 'confirmada'
    if (relacionadas.some((rel) => rel.tipo_relacion === 'descarta')) return 'descartada'
    return 'abierta'
  }

  const crearRelacion = () => {
    if (!sesion || !origenId || !destinoId || origenId === destinoId) return
    const existe = relaciones.some(
      (item) => item.evento_origen_id === origenId && item.evento_destino_id === destinoId && item.tipo_relacion === tipoRelacion,
    )
    if (existe) return

    const nueva: RelacionLocal = {
      id: crypto.randomUUID(),
      evento_origen_id: origenId,
      evento_destino_id: destinoId,
      tipo_relacion: tipoRelacion,
      observacion: observacion.trim(),
      created_at: new Date().toISOString(),
    }

    persist({ ...sesion, relaciones: [...relaciones, nueva] })
    setOrigenId('')
    setDestinoId('')
    setObservacion('')
  }

  const eliminarRelacion = (id: string) => {
    if (!sesion) return
    persist({ ...sesion, relaciones: relaciones.filter((item) => item.id !== id) })
  }

  if (loading) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Cargando relaciones técnicas...</div>
      </ProtectedModuleRoute>
    )
  }

  if (error || !detalle) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">{error || 'No se encontró la OT.'}</div>
          <Link href={`/ot/${otId}`} className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Volver a la OT</Link>
        </div>
      </ProtectedModuleRoute>
    )
  }

  if (!sesion) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="mx-auto max-w-6xl rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">Relaciones técnicas</h1>
          <p className="mt-2 text-sm text-slate-700">Primero debes iniciar una sesión de terreno y registrar eventos.</p>
          <Link href={`/ot/${otId}/sesion`} className="mt-4 inline-flex rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-black text-white">Ir a sesión de terreno</Link>
        </div>
      </ProtectedModuleRoute>
    )
  }

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">OT Viva · Memoria Técnica RMSIC</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Relaciones entre eventos</h1>
          <p className="mt-2 text-sm text-slate-600">
            {detalle.folio || 'Sin folio'} · {detalle.titulo}
            {resumen?.cliente_nombre ? ` · ${resumen.cliente_nombre}` : ''}
            {resumen?.equipo_tag ? ` · ${resumen.equipo_tag}${resumen.equipo_nombre ? ` · ${resumen.equipo_nombre}` : ''}` : ''}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Aquí la cronología deja de ser solo una lista: puedes indicar qué prueba confirma o descarta una hipótesis, qué resultado proviene de una acción y qué recomendación nace de un hallazgo.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Crear relación técnica</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">Evento origen</label>
              <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                <option value="">Selecciona evento</option>
                {sesion.eventos.map((evento) => (
                  <option key={evento.id} value={evento.id}>{localTime(evento.ocurrido_at)} · {eventLabel(evento.tipo_evento)} · {shortText(evento.texto_original, 65)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">Tipo de relación</label>
              <select value={tipoRelacion} onChange={(e) => setTipoRelacion(e.target.value as TipoRelacion)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                {RELACIONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{RELACIONES.find((item) => item.value === tipoRelacion)?.ayuda}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700">Evento destino</label>
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                <option value="">Selecciona evento</option>
                {sesion.eventos.filter((evento) => evento.id !== origenId).map((evento) => (
                  <option key={evento.id} value={evento.id}>{localTime(evento.ocurrido_at)} · {eventLabel(evento.tipo_evento)} · {shortText(evento.texto_original, 65)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-bold text-slate-700">Observación opcional</label>
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} placeholder="Ej.: La medición confirma alimentación correcta y permite descartar la hipótesis de falta de tensión." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900" />
          </div>

          <button type="button" onClick={crearRelacion} disabled={!origenId || !destinoId || origenId === destinoId} className="mt-4 rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-black text-white hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-50">
            Vincular eventos
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Estado del razonamiento</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Hipótesis de la sesión</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{hipotesis.length}</span>
          </div>

          {hipotesis.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Todavía no hay hipótesis registradas.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {hipotesis.map((evento) => {
                const estado = estadoHipotesis(evento.id)
                const badge = estado === 'confirmada'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : estado === 'descartada'
                    ? 'border-slate-300 bg-slate-100 text-slate-600'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                const relacionadas = relaciones.filter((rel) => rel.evento_destino_id === evento.id)

                return (
                  <article key={evento.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{localTime(evento.ocurrido_at)} · {shortText(evento.texto_original, 160)}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${badge}`}>{estado}</span>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${certaintyClass(evento.nivel_certeza)}`}>{evento.nivel_certeza.toUpperCase()}</span>
                    </div>
                    {relacionadas.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {relacionadas.map((rel) => {
                          const origen = eventosById.get(rel.evento_origen_id)
                          return origen ? (
                            <div key={rel.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              <strong>{RELACIONES.find((item) => item.value === rel.tipo_relacion)?.label}:</strong> {eventLabel(origen.tipo_evento)} · {shortText(origen.texto_original, 130)}
                            </div>
                          ) : null
                        })}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-900">Relaciones registradas</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{relaciones.length}</span>
          </div>

          {relaciones.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Aún no has vinculado eventos.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {[...relaciones].reverse().map((rel) => {
                const origen = eventosById.get(rel.evento_origen_id)
                const destino = eventosById.get(rel.evento_destino_id)
                if (!origen || !destino) return null
                return (
                  <article key={rel.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 text-sm text-slate-700">
                        <p><strong>{eventLabel(origen.tipo_evento)}</strong> · {shortText(origen.texto_original, 120)}</p>
                        <p className="my-2 text-xs font-black uppercase tracking-wide text-[#163A5F]">↓ {RELACIONES.find((item) => item.value === rel.tipo_relacion)?.label}</p>
                        <p><strong>{eventLabel(destino.tipo_evento)}</strong> · {shortText(destino.texto_original, 120)}</p>
                        {rel.observacion ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{rel.observacion}</p> : null}
                      </div>
                      <button type="button" onClick={() => eliminarRelacion(rel.id)} className="shrink-0 text-xs font-bold text-red-600 hover:text-red-800">Eliminar relación</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </ProtectedModuleRoute>
  )
}
