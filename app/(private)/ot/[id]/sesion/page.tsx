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

type Prioridad = 'baja' | 'media' | 'alta' | 'critica'

type EventoLocal = {
  id: string
  tipo_evento: TipoEvento
  nivel_certeza: NivelCerteza
  texto_original: string
  descripcion_tecnica: string
  componente: string
  prioridad: Prioridad | null
  visible_cliente: boolean
  incluir_ot: boolean
  ocurrido_at: string
}

type SesionLocal = {
  id: string
  estado: 'en_curso' | 'pausada' | 'finalizada'
  iniciado_at: string
  finalizado_at: string | null
  eventos: EventoLocal[]
}

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  cliente_id: string
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
  tecnico_responsable_id: string | null
  created_by: string | null
  fecha_ot: string | null
  fecha_programada: string | null
}

type OTResumen = {
  id: string
  folio: string | null
  cliente_nombre: string | null
  estado_nombre: string | null
  tipo_servicio_nombre: string | null
  equipo_tag: string | null
  equipo_nombre: string | null
}

const EVENTOS: Array<{ value: TipoEvento; label: string; ayuda: string }> = [
  { value: 'hallazgo', label: 'Hallazgo', ayuda: 'Condición encontrada durante la intervención.' },
  { value: 'medicion', label: 'Medición', ayuda: 'Valor obtenido con instrumento, HMI o lectura técnica.' },
  { value: 'hipotesis', label: 'Hipótesis', ayuda: 'Explicación todavía no confirmada.' },
  { value: 'prueba', label: 'Prueba', ayuda: 'Verificación realizada para confirmar o descartar una hipótesis.' },
  { value: 'accion', label: 'Acción', ayuda: 'Trabajo, ajuste, reparación o intervención ejecutada.' },
  { value: 'resultado', label: 'Resultado', ayuda: 'Efecto observado después de una prueba o acción.' },
  { value: 'recomendacion', label: 'Recomendación', ayuda: 'Acción sugerida que debe quedar trazable.' },
  { value: 'pendiente', label: 'Pendiente', ayuda: 'Condición o tarea no resuelta al momento del registro.' },
  { value: 'decision_cliente', label: 'Decisión cliente', ayuda: 'Aceptación, rechazo o postergación informada por cliente.' },
  { value: 'observacion', label: 'Observación', ayuda: 'Nota general de contexto técnico.' },
]

const CERTEZAS: Array<{ value: NivelCerteza; label: string }> = [
  { value: 'informado', label: 'INFORMADO' },
  { value: 'observado', label: 'OBSERVADO' },
  { value: 'medido', label: 'MEDIDO' },
  { value: 'hipotesis', label: 'HIPÓTESIS' },
  { value: 'confirmado', label: 'CONFIRMADO' },
  { value: 'descartado', label: 'DESCARTADO' },
]

function storageKey(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v1_${empresaId}_${otId}_${userId}`
}

function localDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function localTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function certaintyClass(value: NivelCerteza) {
  if (value === 'confirmado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'descartado') return 'border-slate-300 bg-slate-100 text-slate-600'
  if (value === 'hipotesis') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (value === 'medido') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (value === 'informado') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-cyan-200 bg-cyan-50 text-cyan-700'
}

function eventLabel(value: TipoEvento) {
  return EVENTOS.find((item) => item.value === value)?.label ?? value
}

function groupText(eventos: EventoLocal[], tipos: TipoEvento[]) {
  return eventos
    .filter((evento) => evento.incluir_ot && tipos.includes(evento.tipo_evento))
    .map((evento) => evento.descripcion_tecnica.trim() || evento.texto_original.trim())
    .filter(Boolean)
}

export default function OTVivaSesionPage() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [resumen, setResumen] = useState<OTResumen | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [sesion, setSesion] = useState<SesionLocal | null>(null)
  const [tab, setTab] = useState<'sesion' | 'borrador'>('sesion')

  const [tipoEvento, setTipoEvento] = useState<TipoEvento>('hallazgo')
  const [certeza, setCerteza] = useState<NivelCerteza>('observado')
  const [texto, setTexto] = useState('')
  const [descripcionTecnica, setDescripcionTecnica] = useState('')
  const [componente, setComponente] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('media')
  const [visibleCliente, setVisibleCliente] = useState(false)
  const [incluirOt, setIncluirOt] = useState(true)

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
            .select('id, folio, empresa_id, cliente_id, titulo, descripcion_solicitud, problema_reportado, tecnico_responsable_id, created_by, fecha_ot, fecha_programada')
            .eq('id', otId)
            .eq('activo', true)
            .is('deleted_at', null)
            .maybeSingle(),
          supabase.from('ot_vw_resumen').select('*').eq('id', otId).maybeSingle(),
        ])

        if (detalleResp.error) throw new Error(`No se pudo cargar la OT: ${detalleResp.error.message}`)
        if (resumenResp.error) throw new Error(`No se pudo cargar el resumen: ${resumenResp.error.message}`)
        if (!detalleResp.data || !resumenResp.data) throw new Error('No se encontró la OT solicitada.')

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

        const key = storageKey(ot.empresa_id, ot.id, user.id)
        const raw = window.localStorage.getItem(key)
        let sessionDraft: SesionLocal | null = null

        if (raw) {
          try {
            sessionDraft = JSON.parse(raw) as SesionLocal
          } catch {
            window.localStorage.removeItem(key)
          }
        }

        if (!mounted) return
        setCurrentUserId(user.id)
        setDetalle(ot)
        setResumen(resumenResp.data as OTResumen)
        setSesion(sessionDraft)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo abrir la sesión de terreno.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (otId) void load()

    return () => {
      mounted = false
    }
  }, [otId])

  const persist = (next: SesionLocal | null) => {
    if (!detalle || !currentUserId) return
    const key = storageKey(detalle.empresa_id, detalle.id, currentUserId)
    if (next) window.localStorage.setItem(key, JSON.stringify(next))
    else window.localStorage.removeItem(key)
    setSesion(next)
  }

  const iniciarSesion = () => {
    persist({
      id: crypto.randomUUID(),
      estado: 'en_curso',
      iniciado_at: new Date().toISOString(),
      finalizado_at: null,
      eventos: [],
    })
  }

  const alternarPausa = () => {
    if (!sesion || sesion.estado === 'finalizada') return
    persist({ ...sesion, estado: sesion.estado === 'pausada' ? 'en_curso' : 'pausada' })
  }

  const finalizarSesion = () => {
    if (!sesion || sesion.estado === 'finalizada') return
    if (!window.confirm('¿Finalizar esta sesión local de terreno? El borrador quedará conservado para revisión.')) return
    persist({ ...sesion, estado: 'finalizada', finalizado_at: new Date().toISOString() })
  }

  const nuevaSesion = () => {
    if (!window.confirm('Se reemplazará el borrador local actual por una nueva sesión. ¿Continuar?')) return
    iniciarSesion()
  }

  const agregarEvento = () => {
    if (!sesion || sesion.estado !== 'en_curso') return
    const limpio = texto.trim()
    if (!limpio) return

    const evento: EventoLocal = {
      id: crypto.randomUUID(),
      tipo_evento: tipoEvento,
      nivel_certeza: certeza,
      texto_original: limpio,
      descripcion_tecnica: descripcionTecnica.trim(),
      componente: componente.trim(),
      prioridad: tipoEvento === 'recomendacion' || tipoEvento === 'pendiente' ? prioridad : null,
      visible_cliente: visibleCliente,
      incluir_ot: incluirOt,
      ocurrido_at: new Date().toISOString(),
    }

    persist({ ...sesion, eventos: [...sesion.eventos, evento] })
    setTexto('')
    setDescripcionTecnica('')
    setComponente('')
    setVisibleCliente(false)
    setIncluirOt(true)
  }

  const eliminarEvento = (eventoId: string) => {
    if (!sesion) return
    persist({ ...sesion, eventos: sesion.eventos.filter((evento) => evento.id !== eventoId) })
  }

  const pendientes = useMemo(
    () => sesion?.eventos.filter((evento) => evento.tipo_evento === 'recomendacion' || evento.tipo_evento === 'pendiente') ?? [],
    [sesion]
  )

  const borrador = useMemo(() => {
    const eventos = sesion?.eventos ?? []
    return {
      hallazgos: groupText(eventos, ['hallazgo', 'medicion']),
      diagnostico: eventos
        .filter((evento) => evento.incluir_ot && (evento.nivel_certeza === 'confirmado' || evento.tipo_evento === 'resultado'))
        .map((evento) => evento.descripcion_tecnica.trim() || evento.texto_original.trim())
        .filter(Boolean),
      trabajo: groupText(eventos, ['prueba', 'accion']),
      resultado: groupText(eventos, ['resultado']),
      recomendaciones: groupText(eventos, ['recomendacion', 'pendiente']),
      decisiones: groupText(eventos, ['decision_cliente']),
    }
  }, [sesion])

  if (loading) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Cargando sesión de terreno...</div>
      </ProtectedModuleRoute>
    )
  }

  if (error || !detalle || !resumen) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            {error || 'No se encontró la OT.'}
          </div>
          <Link href={`/ot/${otId}`} className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Volver a la OT
          </Link>
        </div>
      </ProtectedModuleRoute>
    )
  }

  return (
    <ProtectedModuleRoute moduleKey="ot">
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#163A5F] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">OT Viva</span>
                <span className="text-sm font-semibold text-slate-500">{detalle.folio || 'Sin folio'}</span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Sesión de terreno</h1>
              <p className="mt-1 text-base font-semibold text-slate-800">{detalle.titulo}</p>
              <p className="mt-2 text-sm text-slate-600">
                {resumen.cliente_nombre || 'Cliente sin nombre'}
                {resumen.equipo_tag ? ` · ${resumen.equipo_tag}${resumen.equipo_nombre ? ` · ${resumen.equipo_nombre}` : ''}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/ot/${otId}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Volver a OT
              </Link>
              <button type="button" disabled className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-500 opacity-70">
                Asistente RMSIC · próxima etapa
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estado OT</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{resumen.estado_nombre || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Servicio</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{resumen.tipo_servicio_nombre || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sesión</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {!sesion ? 'Sin iniciar' : sesion.estado === 'en_curso' ? 'En curso' : sesion.estado === 'pausada' ? 'Pausada' : 'Finalizada'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recomendaciones / pendientes</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{pendientes.length}</p>
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
          <strong>Prototipo seguro:</strong> esta versión guarda la sesión únicamente en este dispositivo. No modifica la base productiva ni la OT formal. La sincronización con las nuevas tablas se habilitará cuando probemos la migración en una rama Supabase.
        </div>

        {!sesion ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">Comenzar trabajo en terreno</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Inicia una sesión para registrar la cronología técnica sin alterar todavía los campos formales de la OT.
            </p>
            {(detalle.descripcion_solicitud || detalle.problema_reportado) ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {detalle.descripcion_solicitud ? <p className="whitespace-pre-wrap text-sm text-slate-700"><strong>Alcance:</strong> {detalle.descripcion_solicitud}</p> : null}
                {detalle.problema_reportado ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700"><strong>Problema informado:</strong> {detalle.problema_reportado}</p> : null}
              </div>
            ) : null}
            <button type="button" onClick={iniciarSesion} className="mt-5 rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-black text-white hover:bg-[#245C90]">
              Iniciar sesión de terreno
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sesión actual</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">Inicio: {localDateTime(sesion.iniciado_at)}</p>
                  {sesion.finalizado_at ? <p className="mt-1 text-xs text-slate-500">Término: {localDateTime(sesion.finalizado_at)}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sesion.estado !== 'finalizada' ? (
                    <>
                      <button type="button" onClick={alternarPausa} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        {sesion.estado === 'pausada' ? 'Reanudar' : 'Pausar'}
                      </button>
                      <button type="button" onClick={finalizarSesion} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                        Finalizar sesión
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={nuevaSesion} className="rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-bold text-white hover:bg-[#245C90]">
                      Iniciar nueva sesión
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <button type="button" onClick={() => setTab('sesion')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${tab === 'sesion' ? 'bg-[#163A5F] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                Sesión
              </button>
              <button type="button" onClick={() => setTab('borrador')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${tab === 'borrador' ? 'bg-[#163A5F] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                Borrador OT
              </button>
            </div>

            {tab === 'sesion' ? (
              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Registro rápido</p>
                    <h2 className="mt-1 text-lg font-black text-slate-900">Nuevo evento técnico</h2>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">Tipo</label>
                      <select value={tipoEvento} onChange={(event) => setTipoEvento(event.target.value as TipoEvento)} disabled={sesion.estado !== 'en_curso'} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100">
                        {EVENTOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{EVENTOS.find((item) => item.value === tipoEvento)?.ayuda}</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">Certeza</label>
                      <select value={certeza} onChange={(event) => setCerteza(event.target.value as NivelCerteza)} disabled={sesion.estado !== 'en_curso'} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100">
                        {CERTEZAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">Registro original *</label>
                      <textarea value={texto} onChange={(event) => setTexto(event.target.value)} disabled={sesion.estado !== 'en_curso'} rows={4} placeholder="Ej.: Se detecta juego radial en rodamiento lado motor." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-100" />
                    </div>

                    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-bold text-slate-700">Campos técnicos opcionales</summary>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Componente</label>
                          <input value={componente} onChange={(event) => setComponente(event.target.value)} disabled={sesion.estado !== 'en_curso'} placeholder="Rodamiento, PLC, mordaza H..." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Redacción técnica</label>
                          <textarea value={descripcionTecnica} onChange={(event) => setDescripcionTecnica(event.target.value)} disabled={sesion.estado !== 'en_curso'} rows={3} placeholder="Más adelante la IA podrá proponer esta redacción sin alterar el registro original." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100" />
                        </div>
                        {(tipoEvento === 'recomendacion' || tipoEvento === 'pendiente') ? (
                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Prioridad</label>
                            <select value={prioridad} onChange={(event) => setPrioridad(event.target.value as Prioridad)} disabled={sesion.estado !== 'en_curso'} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100">
                              <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                            </select>
                          </div>
                        ) : null}
                        <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={incluirOt} onChange={(event) => setIncluirOt(event.target.checked)} disabled={sesion.estado !== 'en_curso'} /> Incluir en borrador de OT</label>
                        <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={visibleCliente} onChange={(event) => setVisibleCliente(event.target.checked)} disabled={sesion.estado !== 'en_curso'} /> Información visible para cliente</label>
                      </div>
                    </details>

                    <button type="button" onClick={agregarEvento} disabled={sesion.estado !== 'en_curso' || !texto.trim()} className="w-full rounded-xl bg-[#163A5F] px-4 py-3 text-sm font-black text-white hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-50">
                      Registrar evento
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cronología</p>
                      <h2 className="mt-1 text-lg font-black text-slate-900">Eventos técnicos</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{sesion.eventos.length}</span>
                  </div>

                  {sesion.eventos.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      Todavía no hay eventos. Registra el primer hallazgo, medición, hipótesis o acción.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {[...sesion.eventos].reverse().map((evento) => (
                        <article key={evento.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-slate-900">{localTime(evento.ocurrido_at)} · {eventLabel(evento.tipo_evento)}</span>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black tracking-wide ${certaintyClass(evento.nivel_certeza)}`}>{evento.nivel_certeza.toUpperCase()}</span>
                              {evento.prioridad ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase text-amber-700">{evento.prioridad}</span> : null}
                            </div>
                            <button type="button" onClick={() => eliminarEvento(evento.id)} className="text-xs font-bold text-red-600 hover:text-red-800">Eliminar</button>
                          </div>
                          {evento.componente ? <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{evento.componente}</p> : null}
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{evento.texto_original}</p>
                          {evento.descripcion_tecnica ? (
                            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700"><strong>Redacción técnica:</strong> {evento.descripcion_tecnica}</div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                            {evento.incluir_ot ? <span className="rounded-full bg-slate-100 px-2 py-1">Incluye OT</span> : <span className="rounded-full bg-slate-100 px-2 py-1">Solo interno</span>}
                            {evento.visible_cliente ? <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">Visible cliente</span> : <span className="rounded-full bg-slate-100 px-2 py-1">Interno RMSIC</span>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Vista previa estructurada</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">Borrador OT</h2>
                    <p className="mt-2 text-sm text-slate-600">Agrupación determinística de los eventos marcados para la OT. Todavía no utiliza IA ni modifica la OT formal.</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">BORRADOR LOCAL</span>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {[
                    ['Hallazgos y mediciones', borrador.hallazgos],
                    ['Diagnóstico / condiciones confirmadas', borrador.diagnostico],
                    ['Pruebas y trabajos realizados', borrador.trabajo],
                    ['Resultado', borrador.resultado],
                    ['Recomendaciones y pendientes', borrador.recomendaciones],
                    ['Decisiones del cliente', borrador.decisiones],
                  ].map(([titulo, items]) => (
                    <div key={titulo as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-black text-slate-900">{titulo as string}</h3>
                      {(items as string[]).length === 0 ? (
                        <p className="mt-3 text-sm text-slate-400">Sin información registrada.</p>
                      ) : (
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                          {(items as string[]).map((item, index) => <li key={`${titulo}-${index}`} className="rounded-xl bg-white px-3 py-2">{item}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ProtectedModuleRoute>
  )
}
