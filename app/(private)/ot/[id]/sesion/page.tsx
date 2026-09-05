'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
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

type NivelCerteza = 'informado' | 'observado' | 'medido' | 'hipotesis' | 'confirmado' | 'descartado'
type Prioridad = 'baja' | 'media' | 'alta' | 'critica'
type EstadoSesion = 'en_curso' | 'pausada' | 'finalizada'
type EstadoSync = 'local' | 'pendiente_sync' | 'sincronizada' | 'error'

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
  estado: EstadoSesion
  estado_sync: EstadoSync
  iniciado_at: string
  finalizado_at: string | null
  eventos: EventoLocal[]
}

type OTLocalStoreV2 = {
  version: 2
  sesiones: SesionLocal[]
  sesion_activa_id: string | null
  sesion_seleccionada_id: string | null
  updated_at: string
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

type PropuestaLocal = {
  id: string
  tipo_evento: TipoEvento
  nivel_certeza: NivelCerteza
  texto: string
  prioridad: Prioridad | null
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

const CERTEZA_OBLIGATORIA: Partial<Record<TipoEvento, NivelCerteza>> = {
  hipotesis: 'hipotesis',
  medicion: 'medido',
  decision_cliente: 'informado',
}

const RAPIDOS: Array<{ tipo: TipoEvento; label: string; certeza: NivelCerteza }> = [
  { tipo: 'hallazgo', label: 'Hallazgo', certeza: 'observado' },
  { tipo: 'medicion', label: 'Medición', certeza: 'medido' },
  { tipo: 'hipotesis', label: 'Hipótesis', certeza: 'hipotesis' },
  { tipo: 'prueba', label: 'Prueba', certeza: 'observado' },
  { tipo: 'accion', label: 'Acción', certeza: 'observado' },
  { tipo: 'resultado', label: 'Resultado', certeza: 'observado' },
  { tipo: 'recomendacion', label: 'Recomendación', certeza: 'observado' },
  { tipo: 'pendiente', label: 'Pendiente', certeza: 'observado' },
]

function certezaObligatoria(tipo: TipoEvento) {
  return CERTEZA_OBLIGATORIA[tipo] ?? null
}

function normalizarCertezaEvento(tipo: TipoEvento, nivel: NivelCerteza): NivelCerteza {
  return certezaObligatoria(tipo) ?? nivel
}

function storageKeyV1(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v1_${empresaId}_${otId}_${userId}`
}

function storageKeyV2(empresaId: string, otId: string, userId: string) {
  return `tralixia_ot_viva_local_v2_${empresaId}_${otId}_${userId}`
}

function normalizarSesion(sesion: SesionLocal): SesionLocal {
  return {
    ...sesion,
    estado_sync: sesion.estado_sync ?? 'local',
    eventos: (sesion.eventos ?? []).map((evento) => ({
      ...evento,
      nivel_certeza: normalizarCertezaEvento(evento.tipo_evento, evento.nivel_certeza),
    })),
  }
}

function crearStoreVacio(): OTLocalStoreV2 {
  return {
    version: 2,
    sesiones: [],
    sesion_activa_id: null,
    sesion_seleccionada_id: null,
    updated_at: new Date().toISOString(),
  }
}

function migrarStoreLocal(empresaId: string, otId: string, userId: string): OTLocalStoreV2 {
  const keyV2 = storageKeyV2(empresaId, otId, userId)
  const keyV1 = storageKeyV1(empresaId, otId, userId)
  const rawV2 = window.localStorage.getItem(keyV2)

  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2) as OTLocalStoreV2
      const sesiones = (parsed.sesiones ?? []).map(normalizarSesion)
      const activa = sesiones.find((item) => item.id === parsed.sesion_activa_id && item.estado !== 'finalizada') ?? null
      const seleccionada = sesiones.find((item) => item.id === parsed.sesion_seleccionada_id) ?? activa ?? sesiones.at(-1) ?? null
      const next: OTLocalStoreV2 = {
        version: 2,
        sesiones,
        sesion_activa_id: activa?.id ?? null,
        sesion_seleccionada_id: seleccionada?.id ?? null,
        updated_at: new Date().toISOString(),
      }
      window.localStorage.setItem(keyV2, JSON.stringify(next))
      return next
    } catch {
      window.localStorage.removeItem(keyV2)
    }
  }

  const rawV1 = window.localStorage.getItem(keyV1)
  if (rawV1) {
    try {
      const antigua = normalizarSesion({ ...(JSON.parse(rawV1) as SesionLocal), estado_sync: 'local' })
      const next: OTLocalStoreV2 = {
        version: 2,
        sesiones: [antigua],
        sesion_activa_id: antigua.estado === 'finalizada' ? null : antigua.id,
        sesion_seleccionada_id: antigua.id,
        updated_at: new Date().toISOString(),
      }
      window.localStorage.setItem(keyV2, JSON.stringify(next))
      window.localStorage.removeItem(keyV1)
      return next
    } catch {
      window.localStorage.removeItem(keyV1)
    }
  }

  return crearStoreVacio()
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

function normalizarTexto(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function clasificarSegmento(texto: string): Omit<PropuestaLocal, 'id' | 'texto'> {
  const t = normalizarTexto(texto)
  if (/\b(cliente|responsable)\b.*\b(autoriza|acepta|rechaza|posterga|no autoriza|no acepta)\b/.test(t)) return { tipo_evento: 'decision_cliente', nivel_certeza: 'informado', prioridad: null }
  if (/\b(recomiendo|recomendamos|se recomienda|reemplazar|cambiar preventivamente)\b/.test(t)) return { tipo_evento: 'recomendacion', nivel_certeza: 'observado', prioridad: 'media' }
  if (/\b(pendiente|queda pendiente|falta|por realizar|no se interviene|no intervenid)\b/.test(t)) return { tipo_evento: 'pendiente', nivel_certeza: 'observado', prioridad: 'media' }
  if (/\b(descartamos|se descarta|queda descartad|no corresponde a la causa)\b/.test(t)) return { tipo_evento: 'resultado', nivel_certeza: 'descartado', prioridad: null }
  if (/\b(confirmamos|se confirma|queda confirmad|causa confirmada)\b/.test(t)) return { tipo_evento: 'resultado', nivel_certeza: 'confirmado', prioridad: null }
  if (/\b(creo|creemos|posible|podria|podría|probable|sospecha|hipotesis|hipótesis)\b/.test(t)) return { tipo_evento: 'hipotesis', nivel_certeza: 'hipotesis', prioridad: null }
  if (/\b(medimos|se mide|medicion|medición|lectura|marca)\b/.test(t) || /\b\d+(?:[.,]\d+)?\s?(v|a|ma|mv|ohm|ω|mω|bar|psi|°c|c|hz|mm|cm|rpm|db)\b/i.test(texto)) return { tipo_evento: 'medicion', nivel_certeza: 'medido', prioridad: null }
  if (/\b(probamos|se prueba|verificamos|se verifica|comprobamos|se comprueba|testeamos)\b/.test(t)) return { tipo_evento: 'prueba', nivel_certeza: 'observado', prioridad: null }
  if (/\b(ajustamos|se ajusta|reemplazamos|se reemplaza|cambiamos|se cambia|limpiamos|se limpia|reparamos|se repara|apretamos|se aprieta|reseteamos|se resetea)\b/.test(t)) return { tipo_evento: 'accion', nivel_certeza: 'observado', prioridad: null }
  if (/\b(funciona|continua|continúa|persiste|queda operativo|queda operativa|sin falla|falla desaparece|resultado)\b/.test(t)) return { tipo_evento: 'resultado', nivel_certeza: 'observado', prioridad: null }
  if (/\b(encontramos|se detecta|detectamos|observamos|se observa|presenta|se aprecia|se evidencia)\b/.test(t)) return { tipo_evento: 'hallazgo', nivel_certeza: 'observado', prioridad: null }
  return { tipo_evento: 'observacion', nivel_certeza: 'observado', prioridad: null }
}

function separarFraseNatural(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?:[.;]\s+|\s+y\s+(?=(?:recomiendo|recomendamos|se recomienda|medimos|se mide|probamos|se prueba|verificamos|se verifica|ajustamos|se ajusta|reemplazamos|se reemplaza|cambiamos|se cambia|limpiamos|se limpia|confirmamos|se confirma|descartamos|se descarta|queda pendiente|pendiente|el cliente|cliente)\b))/i)
    .map((item) => item.trim())
    .filter(Boolean)
}

function analizarFraseLocal(value: string): PropuestaLocal[] {
  return separarFraseNatural(value).map((texto) => {
    const clasificacion = clasificarSegmento(texto)
    return {
      id: crypto.randomUUID(),
      texto,
      ...clasificacion,
      nivel_certeza: normalizarCertezaEvento(clasificacion.tipo_evento, clasificacion.nivel_certeza),
    }
  })
}

export default function OTVivaSesionPage() {
  const params = useParams<{ id: string }>()
  const otId = params?.id || ''
  const textoRef = useRef<HTMLTextAreaElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [resumen, setResumen] = useState<OTResumen | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [store, setStore] = useState<OTLocalStoreV2>(crearStoreVacio)
  const [tab, setTab] = useState<'sesion' | 'borrador'>('sesion')

  const [tipoEvento, setTipoEvento] = useState<TipoEvento>('hallazgo')
  const [certeza, setCerteza] = useState<NivelCerteza>('observado')
  const [texto, setTexto] = useState('')
  const [descripcionTecnica, setDescripcionTecnica] = useState('')
  const [componente, setComponente] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('media')
  const [visibleCliente, setVisibleCliente] = useState(false)
  const [incluirOt, setIncluirOt] = useState(true)
  const [fraseNatural, setFraseNatural] = useState('')
  const [propuestas, setPropuestas] = useState<PropuestaLocal[]>([])

  const sesion = useMemo(
    () => store.sesiones.find((item) => item.id === store.sesion_seleccionada_id) ?? null,
    [store],
  )
  const sesionActiva = useMemo(
    () => store.sesiones.find((item) => item.id === store.sesion_activa_id && item.estado !== 'finalizada') ?? null,
    [store],
  )
  const certezaFija = certezaObligatoria(tipoEvento)
  const puedeEditarSesion = Boolean(sesion && sesionActiva && sesion.id === sesionActiva.id && sesion.estado === 'en_curso')

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

        const localStore = migrarStoreLocal(ot.empresa_id, ot.id, user.id)
        if (!mounted) return
        setCurrentUserId(user.id)
        setDetalle(ot)
        setResumen(resumenResp.data as OTResumen)
        setStore(localStore)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo abrir la sesión de terreno.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (otId) void load()
    return () => { mounted = false }
  }, [otId])

  const persistStore = (next: OTLocalStoreV2) => {
    if (!detalle || !currentUserId) return
    const normalized = { ...next, version: 2 as const, updated_at: new Date().toISOString() }
    window.localStorage.setItem(storageKeyV2(detalle.empresa_id, detalle.id, currentUserId), JSON.stringify(normalized))
    setStore(normalized)
  }

  const actualizarSesion = (sesionId: string, updater: (actual: SesionLocal) => SesionLocal) => {
    persistStore({
      ...store,
      sesiones: store.sesiones.map((item) => item.id === sesionId ? updater(item) : item),
    })
  }

  const iniciarSesion = () => {
    if (sesionActiva) {
      setStore((prev) => ({ ...prev, sesion_seleccionada_id: sesionActiva.id }))
      return
    }
    const nueva: SesionLocal = {
      id: crypto.randomUUID(),
      estado: 'en_curso',
      estado_sync: 'local',
      iniciado_at: new Date().toISOString(),
      finalizado_at: null,
      eventos: [],
    }
    persistStore({
      ...store,
      sesiones: [...store.sesiones, nueva],
      sesion_activa_id: nueva.id,
      sesion_seleccionada_id: nueva.id,
    })
    setTab('sesion')
  }

  const seleccionarSesion = (sesionId: string) => {
    persistStore({ ...store, sesion_seleccionada_id: sesionId })
    setTab('sesion')
  }

  const volverSesionActiva = () => {
    if (!sesionActiva) return
    seleccionarSesion(sesionActiva.id)
  }

  const alternarPausa = () => {
    if (!sesionActiva) return
    actualizarSesion(sesionActiva.id, (actual) => ({
      ...actual,
      estado: actual.estado === 'pausada' ? 'en_curso' : 'pausada',
      estado_sync: 'local',
    }))
  }

  const finalizarSesion = () => {
    if (!sesionActiva) return
    if (!window.confirm('¿Finalizar esta sesión local de terreno? El historial quedará conservado y podrás iniciar otra sesión después.')) return
    const ahora = new Date().toISOString()
    persistStore({
      ...store,
      sesiones: store.sesiones.map((item) => item.id === sesionActiva.id ? { ...item, estado: 'finalizada', estado_sync: 'local', finalizado_at: ahora } : item),
      sesion_activa_id: null,
      sesion_seleccionada_id: sesionActiva.id,
    })
  }

  const seleccionarTipoEvento = (tipo: TipoEvento, nivelSugerido?: NivelCerteza) => {
    setTipoEvento(tipo)
    const obligatoria = certezaObligatoria(tipo)
    if (obligatoria) setCerteza(obligatoria)
    else if (nivelSugerido) setCerteza(nivelSugerido)
  }

  const seleccionarRapido = (tipo: TipoEvento, nivel: NivelCerteza) => {
    seleccionarTipoEvento(tipo, nivel)
    window.setTimeout(() => textoRef.current?.focus(), 40)
  }

  const crearEvento = (tipo: TipoEvento, nivel: NivelCerteza, textoOriginal: string, prioridadEvento: Prioridad | null = null): EventoLocal => ({
    id: crypto.randomUUID(),
    tipo_evento: tipo,
    nivel_certeza: normalizarCertezaEvento(tipo, nivel),
    texto_original: textoOriginal.trim(),
    descripcion_tecnica: '',
    componente: '',
    prioridad: prioridadEvento,
    visible_cliente: false,
    incluir_ot: true,
    ocurrido_at: new Date().toISOString(),
  })

  const agregarEventosActivos = (nuevos: EventoLocal[]) => {
    if (!sesionActiva || sesionActiva.estado !== 'en_curso') return
    actualizarSesion(sesionActiva.id, (actual) => ({
      ...actual,
      estado_sync: 'local',
      eventos: [...actual.eventos, ...nuevos],
    }))
  }

  const agregarEvento = () => {
    const limpio = texto.trim()
    if (!puedeEditarSesion || !limpio) return
    const evento: EventoLocal = {
      ...crearEvento(tipoEvento, certeza, limpio, tipoEvento === 'recomendacion' || tipoEvento === 'pendiente' ? prioridad : null),
      descripcion_tecnica: descripcionTecnica.trim(),
      componente: componente.trim(),
      visible_cliente: visibleCliente,
      incluir_ot: incluirOt,
    }
    agregarEventosActivos([evento])
    setTexto('')
    setDescripcionTecnica('')
    setComponente('')
    setVisibleCliente(false)
    setIncluirOt(true)
    window.setTimeout(() => textoRef.current?.focus(), 40)
  }

  const analizarFrase = () => {
    const limpio = fraseNatural.trim()
    if (!limpio) return
    setPropuestas(analizarFraseLocal(limpio))
  }

  const agregarPropuesta = (propuesta: PropuestaLocal) => {
    if (!puedeEditarSesion) return
    agregarEventosActivos([crearEvento(propuesta.tipo_evento, propuesta.nivel_certeza, propuesta.texto, propuesta.prioridad)])
    setPropuestas((prev) => prev.filter((item) => item.id !== propuesta.id))
  }

  const agregarTodasLasPropuestas = () => {
    if (!puedeEditarSesion || propuestas.length === 0) return
    agregarEventosActivos(propuestas.map((propuesta) => crearEvento(propuesta.tipo_evento, propuesta.nivel_certeza, propuesta.texto, propuesta.prioridad)))
    setPropuestas([])
    setFraseNatural('')
  }

  const eliminarEvento = (eventoId: string) => {
    if (!sesion || !puedeEditarSesion) return
    actualizarSesion(sesion.id, (actual) => ({ ...actual, eventos: actual.eventos.filter((evento) => evento.id !== eventoId) }))
  }

  const todosLosEventos = useMemo(() => store.sesiones.flatMap((item) => item.eventos), [store.sesiones])
  const pendientes = useMemo(
    () => todosLosEventos.filter((evento) => evento.tipo_evento === 'recomendacion' || evento.tipo_evento === 'pendiente'),
    [todosLosEventos],
  )
  const borrador = useMemo(() => ({
    hallazgos: groupText(todosLosEventos, ['hallazgo', 'medicion']),
    diagnostico: todosLosEventos
      .filter((evento) => evento.incluir_ot && (evento.nivel_certeza === 'confirmado' || evento.tipo_evento === 'resultado'))
      .map((evento) => evento.descripcion_tecnica.trim() || evento.texto_original.trim())
      .filter(Boolean),
    trabajo: groupText(todosLosEventos, ['prueba', 'accion']),
    resultado: groupText(todosLosEventos, ['resultado']),
    recomendaciones: groupText(todosLosEventos, ['recomendacion', 'pendiente']),
    decisiones: groupText(todosLosEventos, ['decision_cliente']),
  }), [todosLosEventos])

  if (loading) {
    return <ProtectedModuleRoute moduleKey="ot"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Cargando sesión de terreno...</div></ProtectedModuleRoute>
  }

  if (error || !detalle || !resumen) {
    return (
      <ProtectedModuleRoute moduleKey="ot">
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">{error || 'No se encontró la OT.'}</div>
          <Link href={`/ot/${otId}`} className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Volver a la OT</Link>
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
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Sesiones de terreno</h1>
              <p className="mt-1 text-base font-semibold text-slate-800">{detalle.titulo}</p>
              <p className="mt-2 text-sm text-slate-600">{resumen.cliente_nombre || 'Cliente sin nombre'}{resumen.equipo_tag ? ` · ${resumen.equipo_tag}${resumen.equipo_nombre ? ` · ${resumen.equipo_nombre}` : ''}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/ot/${otId}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Volver a OT</Link>
              <button type="button" disabled className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-500 opacity-70">Asistente RMSIC · próxima etapa</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estado OT</p><p className="mt-1 text-sm font-bold text-slate-900">{resumen.estado_nombre || '-'}</p></div>
            <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sesiones guardadas</p><p className="mt-1 text-sm font-bold text-slate-900">{store.sesiones.length}</p></div>
            <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sesión activa</p><p className="mt-1 text-sm font-bold text-slate-900">{!sesionActiva ? 'Ninguna' : sesionActiva.estado === 'en_curso' ? 'En curso' : 'Pausada'}</p></div>
            <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recomendaciones / pendientes</p><p className="mt-1 text-sm font-bold text-slate-900">{pendientes.length}</p></div>
          </div>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
          <strong>Prototipo seguro:</strong> las sesiones permanecen en este dispositivo y no modifican Supabase productivo ni la OT formal. La estructura local ya conserva múltiples sesiones e historial.
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Historial local</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Sesiones de esta OT</h2>
              <p className="mt-1 text-sm text-slate-600">Finalizar una sesión ya no la reemplaza. Cada nueva intervención queda agregada al historial.</p>
            </div>
            {!sesionActiva ? (
              <button type="button" onClick={iniciarSesion} className="rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-black text-white hover:bg-[#245C90]">Iniciar nueva sesión</button>
            ) : sesion?.id !== sesionActiva.id ? (
              <button type="button" onClick={volverSesionActiva} className="rounded-xl bg-[#163A5F] px-4 py-2.5 text-sm font-black text-white hover:bg-[#245C90]">Volver a sesión activa</button>
            ) : null}
          </div>

          {store.sesiones.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">Todavía no hay sesiones registradas en este dispositivo.</p>
              <button type="button" onClick={iniciarSesion} className="mt-4 rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-black text-white hover:bg-[#245C90]">Iniciar sesión de terreno</button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...store.sesiones].reverse().map((item, reverseIndex) => {
                const numero = store.sesiones.length - reverseIndex
                const selected = item.id === sesion?.id
                return (
                  <button key={item.id} type="button" onClick={() => seleccionarSesion(item.id)} className={`rounded-xl border p-4 text-left transition ${selected ? 'border-[#163A5F] bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-slate-900">Sesión {numero}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.estado === 'en_curso' ? 'bg-emerald-50 text-emerald-700' : item.estado === 'pausada' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.estado.replace('_', ' ')}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Inicio: {localDateTime(item.iniciado_at)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.finalizado_at ? `Término: ${localDateTime(item.finalizado_at)}` : 'Sin término registrado'}</p>
                    <div className="mt-3 flex gap-2 text-[11px] font-bold text-slate-500"><span>{item.eventos.length} eventos</span><span>·</span><span>{item.eventos.filter((evento) => evento.tipo_evento === 'recomendacion' || evento.tipo_evento === 'pendiente').length} pendientes</span></div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {sesion ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sesión seleccionada</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">Inicio: {localDateTime(sesion.iniciado_at)}</p>
                  {sesion.finalizado_at ? <p className="mt-1 text-xs text-slate-500">Término: {localDateTime(sesion.finalizado_at)}</p> : null}
                  {!puedeEditarSesion ? <p className="mt-2 text-xs font-semibold text-slate-500">Vista histórica de solo lectura. Para registrar nuevos eventos, vuelve a la sesión activa o inicia una nueva.</p> : null}
                </div>
                {sesionActiva && sesion.id === sesionActiva.id ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={alternarPausa} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{sesionActiva.estado === 'pausada' ? 'Reanudar' : 'Pausar'}</button>
                    <button type="button" onClick={finalizarSesion} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Finalizar sesión</button>
                  </div>
                ) : null}
              </div>
            </section>

            <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <button type="button" onClick={() => setTab('sesion')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${tab === 'sesion' ? 'bg-[#163A5F] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Sesión</button>
              <button type="button" onClick={() => setTab('borrador')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${tab === 'borrador' ? 'bg-[#163A5F] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Borrador OT · todas las sesiones</button>
            </div>

            {tab === 'sesion' ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Uso en terreno</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Acciones rápidas</h2>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    {RAPIDOS.map((item) => (
                      <button key={item.tipo} type="button" onClick={() => seleccionarRapido(item.tipo, item.certeza)} disabled={!puedeEditarSesion} className={`rounded-xl border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${tipoEvento === item.tipo ? 'border-[#163A5F] bg-[#163A5F] text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'}`}>{item.label}</button>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-wide text-violet-600">Preparación para voz</p><h2 className="mt-1 text-lg font-black text-slate-900">Registro natural simulado</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Escribe lo que dirías hablando en terreno. Tralixia lo separa con reglas locales antes de conectar IA y voz.</p></div>
                    <span className="whitespace-nowrap rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black text-violet-700">SIN IA</span>
                  </div>
                  <textarea value={fraseNatural} onChange={(event) => setFraseNatural(event.target.value)} disabled={!puedeEditarSesion} rows={3} placeholder="Ej.: Encontramos juego en el rodamiento lado motor y recomiendo cambiarlo. Medimos 24.3 VDC en X14 y la falla continúa." className="mt-4 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-500 disabled:bg-slate-100" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={analizarFrase} disabled={!puedeEditarSesion || !fraseNatural.trim()} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">Analizar frase</button>
                    {propuestas.length > 0 ? <button type="button" onClick={agregarTodasLasPropuestas} className="rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-black text-violet-700 hover:bg-violet-100">Registrar todas ({propuestas.length})</button> : null}
                  </div>
                  {propuestas.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {propuestas.map((propuesta) => (
                        <div key={propuesta.id} className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black uppercase tracking-wide text-slate-700">{eventLabel(propuesta.tipo_evento)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${certaintyClass(propuesta.nivel_certeza)}`}>{propuesta.nivel_certeza.toUpperCase()}</span></div><p className="mt-1 text-sm text-slate-700">{propuesta.texto}</p></div>
                          <div className="flex shrink-0 gap-2"><button type="button" onClick={() => agregarPropuesta(propuesta)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">Registrar</button><button type="button" onClick={() => setPropuestas((prev) => prev.filter((item) => item.id !== propuesta.id))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Omitir</button></div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <div className="grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Registro manual</p><h2 className="mt-1 text-lg font-black text-slate-900">Nuevo evento técnico</h2>
                    <div className="mt-5 space-y-4">
                      <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Tipo</label><select value={tipoEvento} onChange={(event) => seleccionarTipoEvento(event.target.value as TipoEvento)} disabled={!puedeEditarSesion} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100">{EVENTOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="mt-1 text-xs leading-5 text-slate-500">{EVENTOS.find((item) => item.value === tipoEvento)?.ayuda}</p></div>
                      <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Certeza</label><select value={certeza} onChange={(event) => setCerteza(event.target.value as NivelCerteza)} disabled={!puedeEditarSesion || Boolean(certezaFija)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-600">{CERTEZAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{certezaFija ? <p className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs font-semibold leading-5 text-blue-700">Certeza protegida: {eventLabel(tipoEvento)} siempre se registra como {certezaFija.toUpperCase()}.</p> : null}</div>
                      <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Registro original *</label><textarea ref={textoRef} value={texto} onChange={(event) => setTexto(event.target.value)} disabled={!puedeEditarSesion} rows={4} placeholder="Ej.: Se detecta juego radial en rodamiento lado motor." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-100" /></div>
                      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">Campos técnicos opcionales</summary><div className="mt-4 space-y-4"><input value={componente} onChange={(event) => setComponente(event.target.value)} disabled={!puedeEditarSesion} placeholder="Componente" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100" /><textarea value={descripcionTecnica} onChange={(event) => setDescripcionTecnica(event.target.value)} disabled={!puedeEditarSesion} rows={3} placeholder="Redacción técnica" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100" />{(tipoEvento === 'recomendacion' || tipoEvento === 'pendiente') ? <select value={prioridad} onChange={(event) => setPrioridad(event.target.value as Prioridad)} disabled={!puedeEditarSesion} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option></select> : null}<label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={incluirOt} onChange={(event) => setIncluirOt(event.target.checked)} disabled={!puedeEditarSesion} /> Incluir en borrador de OT</label><label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={visibleCliente} onChange={(event) => setVisibleCliente(event.target.checked)} disabled={!puedeEditarSesion} /> Información visible para cliente</label></div></details>
                      <button type="button" onClick={agregarEvento} disabled={!puedeEditarSesion || !texto.trim()} className="w-full rounded-xl bg-[#163A5F] px-4 py-3 text-sm font-black text-white hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-50">Registrar evento</button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cronología</p><h2 className="mt-1 text-lg font-black text-slate-900">Eventos técnicos</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{sesion.eventos.length}</span></div>
                    {sesion.eventos.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay eventos en esta sesión.</div> : (
                      <div className="mt-5 space-y-3">{[...sesion.eventos].reverse().map((evento) => <article key={evento.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-900">{localTime(evento.ocurrido_at)} · {eventLabel(evento.tipo_evento)}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black tracking-wide ${certaintyClass(evento.nivel_certeza)}`}>{evento.nivel_certeza.toUpperCase()}</span>{evento.prioridad ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase text-amber-700">{evento.prioridad}</span> : null}</div>{puedeEditarSesion ? <button type="button" onClick={() => eliminarEvento(evento.id)} className="text-xs font-bold text-red-600 hover:text-red-800">Eliminar</button> : null}</div>{evento.componente ? <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{evento.componente}</p> : null}<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{evento.texto_original}</p>{evento.descripcion_tecnica ? <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700"><strong>Redacción técnica:</strong> {evento.descripcion_tecnica}</div> : null}</article>)}</div>
                    )}
                  </section>
                </div>
              </div>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Vista previa estructurada</p><h2 className="mt-1 text-xl font-black text-slate-900">Borrador OT consolidado</h2><p className="mt-2 text-sm text-slate-600">Agrupa los eventos de todas las sesiones locales de esta OT. Todavía no utiliza IA ni modifica la OT formal.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">BORRADOR LOCAL · {store.sesiones.length} SESIONES</span></div>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">{[
                  ['Hallazgos y mediciones', borrador.hallazgos],
                  ['Diagnóstico / condiciones confirmadas', borrador.diagnostico],
                  ['Pruebas y trabajos realizados', borrador.trabajo],
                  ['Resultado', borrador.resultado],
                  ['Recomendaciones y pendientes', borrador.recomendaciones],
                  ['Decisiones del cliente', borrador.decisiones],
                ].map(([titulo, items]) => <div key={titulo as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-black text-slate-900">{titulo as string}</h3>{(items as string[]).length === 0 ? <p className="mt-3 text-sm text-slate-400">Sin información registrada.</p> : <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{(items as string[]).map((item, index) => <li key={`${titulo}-${index}`} className="rounded-xl bg-white px-3 py-2">{item}</li>)}</ul>}</div>)}</div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </ProtectedModuleRoute>
  )
}
