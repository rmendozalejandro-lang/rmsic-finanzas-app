'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ProtectedModuleRoute from '../../../../../components/ProtectedModuleRoute'
import { supabase } from '../../../../../lib/supabase/client'

type OtRow = {
  id: string
  empresa_id: string
  cliente_id: string | null
  folio: string | null
  titulo: string | null
  descripcion_solicitud: string | null
}

type CasoRow = {
  id: string
  empresa_id: string
  titulo: string
  estado: string
  responsable_id: string | null
}

type SesionRow = {
  id: string
  estado: string
  iniciado_at: string
  finalizado_at: string | null
}

type EventoRow = {
  id: string
  sesion_id: string | null
  tipo_evento: string
  nivel_certeza: string
  texto_original: string
  ocurrido_at: string
  autor_tipo: string
  origen_captura: string
  estado_validacion: string
}

type EvidenciaRow = {
  id: string
  sesion_id: string | null
  tipo_evidencia: string
  storage_bucket: string | null
  storage_path: string | null
  archivo_nombre: string | null
  mime_type: string | null
  descripcion: string | null
  capturado_at: string
  signedUrl?: string | null
}

type RelacionEvidenciaRow = {
  evento_id: string
  evidencia_id: string
  tipo_uso: string
}

type RelacionEventoRow = {
  id: string
  evento_origen_id: string
  evento_destino_id: string
  tipo_relacion: string
  observacion: string | null
  created_at: string
  activo: boolean
  anulado_at: string | null
  motivo_anulacion: string | null
}

type DecisionRow = {
  id: string
  sesion_id: string | null
  evento_id: string | null
  actor_tipo: string
  actor_nombre_snapshot: string | null
  actor_cargo_snapshot: string | null
  decision: string
  motivo: string | null
  decidido_at: string
  created_by: string | null
}

const BUCKET = 'ot-viva-evidencias'

function safeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function evidenciaTipo(file: File) {
  if (file.type.startsWith('image/')) return 'foto'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type === 'application/pdf') return 'documento'
  return 'otro'
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

function nivelParaTipo(tipo: string) {
  if (tipo === 'hipotesis') return 'hipotesis'
  if (tipo === 'medicion') return 'medido'
  if (tipo === 'resultado') return 'confirmado'
  return 'observado'
}

function badgeForTipo(tipo: string) {
  if (tipo === 'hipotesis') return 'bg-amber-100 text-amber-800'
  if (tipo === 'prueba') return 'bg-blue-100 text-blue-800'
  if (tipo === 'resultado') return 'bg-emerald-100 text-emerald-800'
  if (tipo === 'accion') return 'bg-violet-100 text-violet-800'
  return 'bg-slate-100 text-slate-700'
}

function OTVivaContent() {
  const params = useParams<{ id: string }>()
  const otId = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userId, setUserId] = useState('')
  const [ot, setOt] = useState<OtRow | null>(null)
  const [caso, setCaso] = useState<CasoRow | null>(null)
  const [sesiones, setSesiones] = useState<SesionRow[]>([])
  const [eventos, setEventos] = useState<EventoRow[]>([])
  const [evidencias, setEvidencias] = useState<EvidenciaRow[]>([])
  const [relaciones, setRelaciones] = useState<RelacionEvidenciaRow[]>([])
  const [relacionesEventos, setRelacionesEventos] = useState<RelacionEventoRow[]>([])
  const [decisiones, setDecisiones] = useState<DecisionRow[]>([])
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [asistenteIAHabilitado, setAsistenteIAHabilitado] = useState(false)
  const [preguntaIA, setPreguntaIA] = useState('')
  const [respuestaIA, setRespuestaIA] = useState('')
  const [consultandoIA, setConsultandoIA] = useState(false)
  const [grabandoVoz, setGrabandoVoz] = useState<'evento' | 'ia' | null>(null)
  const [transcribiendoVoz, setTranscribiendoVoz] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])


  const [tipoEvento, setTipoEvento] = useState('hallazgo')
  const [textoEvento, setTextoEvento] = useState('')
  const [eventoSeleccionado, setEventoSeleccionado] = useState('')
  const [tipoUso, setTipoUso] = useState('evidencia')
  const [descripcionEvidencia, setDescripcionEvidencia] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)

  const [hipotesisDestino, setHipotesisDestino] = useState('')
  const [eventoOrigenRelacion, setEventoOrigenRelacion] = useState('')
  const [tipoRelacion, setTipoRelacion] = useState('sustenta')
  const [observacionRelacion, setObservacionRelacion] = useState('')
  const [hipotesisDecision, setHipotesisDecision] = useState('')
  const [motivoDecision, setMotivoDecision] = useState('')

  const sesionActiva = useMemo(
    () => sesiones.find((item) => item.estado === 'en_curso') ?? null,
    [sesiones]
  )

  const hipotesis = useMemo(
    () => eventos.filter((item) => item.tipo_evento === 'hipotesis'),
    [eventos]
  )

  const eventosById = useMemo(
    () => new Map(eventos.map((item) => [item.id, item])),
    [eventos]
  )

  const relacionesEventosActivas = useMemo(
    () => relacionesEventos.filter((item) => item.activo !== false),
    [relacionesEventos]
  )

  const eventoOrigenSeleccionado = useMemo(
    () => eventosById.get(eventoOrigenRelacion) ?? null,
    [eventosById, eventoOrigenRelacion]
  )

  const hipotesisDestinoSeleccionada = useMemo(
    () => eventosById.get(hipotesisDestino) ?? null,
    [eventosById, hipotesisDestino]
  )

  const loadAll = useCallback(async () => {
    if (!otId) return
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('No se pudo validar la sesión.')
      setUserId(authData.user.id)

      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('nombre_completo,rol')
        .eq('id', authData.user.id)
        .maybeSingle()

      setUserName(perfilData?.nombre_completo || authData.user.email || 'Usuario')
      setUserRole(perfilData?.rol || '')

      const { data: otData, error: otError } = await supabase
        .from('ot_ordenes_trabajo')
        .select('id,empresa_id,cliente_id,folio,titulo,descripcion_solicitud')
        .eq('id', otId)
        .single()

      if (otError || !otData) throw new Error(otError?.message || 'No se encontró la OT.')
      const currentOt = otData as OtRow
      setOt(currentOt)

      const { data: capacidadIA, error: capacidadIAError } = await supabase
        .from('empresa_capacidades')
        .select('habilitado')
        .eq('empresa_id', currentOt.empresa_id)
        .eq('capacidad', 'asistente_ia')
        .maybeSingle()

      if (capacidadIAError) throw new Error(capacidadIAError.message)
      setAsistenteIAHabilitado(Boolean(capacidadIA?.habilitado))

      const { data: linkData, error: linkError } = await supabase
        .from('asistente_caso_ots')
        .select('caso_id')
        .eq('ot_id', otId)
        .eq('empresa_id', currentOt.empresa_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (linkError) throw new Error(linkError.message)

      let currentCaso: CasoRow | null = null

      if (linkData?.caso_id) {
        const { data: casoData, error: casoError } = await supabase
          .from('asistente_casos')
          .select('id,empresa_id,titulo,estado,responsable_id')
          .eq('id', linkData.caso_id)
          .single()

        if (casoError) throw new Error(casoError.message)
        currentCaso = casoData as CasoRow
      }

      setCaso(currentCaso)

      if (!currentCaso) {
        setSesiones([])
        setEventos([])
        setEvidencias([])
        setRelaciones([])
        setRelacionesEventos([])
        setDecisiones([])
        return
      }

      const [
        sesionesResp,
        eventosResp,
        evidenciasResp,
        relacionesResp,
        relacionesEventosResp,
        decisionesResp,
      ] = await Promise.all([
        supabase
          .from('asistente_sesiones')
          .select('id,estado,iniciado_at,finalizado_at')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id)
          .order('iniciado_at', { ascending: false }),
        supabase
          .from('asistente_eventos')
          .select('id,sesion_id,tipo_evento,nivel_certeza,texto_original,ocurrido_at,autor_tipo,origen_captura,estado_validacion')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id)
          .eq('estado', 'activo')
          .order('ocurrido_at', { ascending: false }),
        supabase
          .from('asistente_evidencias')
          .select('id,sesion_id,tipo_evidencia,storage_bucket,storage_path,archivo_nombre,mime_type,descripcion,capturado_at')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id)
          .order('capturado_at', { ascending: false }),
        supabase
          .from('asistente_evento_evidencias')
          .select('evento_id,evidencia_id,tipo_uso')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id),
        supabase
          .from('asistente_evento_relaciones')
          .select('id,evento_origen_id,evento_destino_id,tipo_relacion,observacion,created_at,activo,anulado_at,motivo_anulacion')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id)
          .order('created_at', { ascending: true }),
        supabase
          .from('asistente_decisiones')
          .select('id,sesion_id,evento_id,actor_tipo,actor_nombre_snapshot,actor_cargo_snapshot,decision,motivo,decidido_at,created_by')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id)
          .order('decidido_at', { ascending: true }),
      ])

      if (sesionesResp.error) throw new Error(sesionesResp.error.message)
      if (eventosResp.error) throw new Error(eventosResp.error.message)
      if (evidenciasResp.error) throw new Error(evidenciasResp.error.message)
      if (relacionesResp.error) throw new Error(relacionesResp.error.message)
      if (relacionesEventosResp.error) throw new Error(relacionesEventosResp.error.message)
      if (decisionesResp.error) throw new Error(decisionesResp.error.message)

      setSesiones((sesionesResp.data || []) as SesionRow[])
      const loadedEventos = (eventosResp.data || []) as EventoRow[]
      setEventos(loadedEventos)
      if (!eventoSeleccionado && loadedEventos[0]?.id) setEventoSeleccionado(loadedEventos[0].id)

      const loadedEvidencias = (evidenciasResp.data || []) as EvidenciaRow[]
      const withUrls = await Promise.all(
        loadedEvidencias.map(async (item) => {
          if (!item.storage_bucket || !item.storage_path) return item
          const { data } = await supabase.storage
            .from(item.storage_bucket)
            .createSignedUrl(item.storage_path, 60 * 60)
          return { ...item, signedUrl: data?.signedUrl || null }
        })
      )
      setEvidencias(withUrls)
      setRelaciones((relacionesResp.data || []) as RelacionEvidenciaRow[])
      setRelacionesEventos((relacionesEventosResp.data || []) as RelacionEventoRow[])
      setDecisiones((decisionesResp.data || []) as DecisionRow[])

      const firstHypothesis = loadedEventos.find((item) => item.tipo_evento === 'hipotesis')
      if (!hipotesisDestino && firstHypothesis?.id) setHipotesisDestino(firstHypothesis.id)
      if (!hipotesisDecision && firstHypothesis?.id) setHipotesisDecision(firstHypothesis.id)
      if (!eventoOrigenRelacion) {
        const firstSource = loadedEventos.find((item) => item.id !== firstHypothesis?.id)
        if (firstSource?.id) setEventoOrigenRelacion(firstSource.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar OT Viva.')
    } finally {
      setLoading(false)
    }
  }, [otId, eventoSeleccionado])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function consultarAsistenteIA() {
    if (!ot || !caso || !preguntaIA.trim() || !asistenteIAHabilitado) return

    setConsultandoIA(true)
    setError('')
    setSuccess('')
    setRespuestaIA('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('No se pudo validar la sesión para consultar la IA.')

      const response = await fetch(`/api/ot/${ot.id}/viva/asistente`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pregunta: preguntaIA.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'No fue posible consultar el asistente.')
      }

      setRespuestaIA(data.respuesta || '')
      setPreguntaIA('')
      setSuccess('Respuesta IA registrada como propuesta pendiente de validación humana.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible consultar el asistente.')
    } finally {
      setConsultandoIA(false)
    }
  }

  function detenerGrabacionVoz() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  async function transcribirAudio(blob: Blob, destino: 'evento' | 'ia') {
    if (!ot) return

    setTranscribiendoVoz(true)
    setError('')
    setSuccess('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No se pudo validar la sesión para transcribir audio.')

      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const formData = new FormData()
      formData.append('audio', blob, `ot-viva-voz.${extension}`)

      const response = await fetch(`/api/ot/${ot.id}/viva/transcribir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No fue posible transcribir el audio.')

      const texto = String(data?.texto || '').trim()
      if (!texto) throw new Error('No se detectó contenido de voz.')

      if (destino === 'evento') {
        setTextoEvento((actual) => [actual.trim(), texto].filter(Boolean).join(' '))
        setSuccess('Voz transcrita. Revisa el texto y guarda el evento cuando esté correcto.')
      } else {
        setPreguntaIA((actual) => [actual.trim(), texto].filter(Boolean).join(' '))
        setSuccess('Voz transcrita. Revisa la consulta antes de enviarla a Tralixia.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible transcribir el audio.')
    } finally {
      setTranscribiendoVoz(false)
    }
  }

  async function alternarGrabacionVoz(destino: 'evento' | 'ia') {
    if (grabandoVoz) {
      detenerGrabacionVoz()
      return
    }

    setError('')
    setSuccess('')

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Este navegador no permite grabación de voz para OT Viva.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream
      audioChunksRef.current = []

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ]
      const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onerror = () => {
        setError('Se produjo un problema durante la grabación de voz.')
      }

      recorder.onstop = () => {
        const chunks = audioChunksRef.current
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm'
        const blob = new Blob(chunks, { type })

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        audioChunksRef.current = []
        setGrabandoVoz(null)

        if (blob.size < 1000) {
          setError('La grabación fue demasiado corta. Intenta nuevamente.')
          return
        }

        void transcribirAudio(blob, destino)
      }

      recorder.start()
      setGrabandoVoz(destino)
      setSuccess('Escuchando... habla normalmente y presiona Detener cuando termines.')
    } catch (err) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
      setGrabandoVoz(null)
      setError(err instanceof Error ? err.message : 'No se pudo acceder al micrófono.')
    }
  }

  async function crearCaso() {
    if (!ot || !userId) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const externalKey = `ot:${ot.id}`
      const { data: newCaso, error: casoError } = await supabase
        .from('asistente_casos')
        .insert({
          empresa_id: ot.empresa_id,
          cliente_id: ot.cliente_id,
          dominio: 'tecnico',
          tipo_caso: 'ot_terreno',
          titulo: ot.titulo || `OT Viva ${ot.folio || ''}`,
          descripcion_inicial: ot.descripcion_solicitud,
          estado: 'en_ejecucion',
          prioridad: 'media',
          origen: 'ot',
          responsable_id: userId,
          origen_externo: 'ot_viva',
          clave_externa: externalKey,
          datos: { ot_id: ot.id, folio: ot.folio, origen_modulo: 'ot' },
        })
        .select('id,empresa_id,titulo,estado,responsable_id')
        .single()

      if (casoError || !newCaso) throw new Error(casoError?.message || 'No se pudo crear el caso.')

      const { error: linkError } = await supabase
        .from('asistente_caso_ots')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: newCaso.id,
          ot_id: ot.id,
          rol: 'principal',
        })

      if (linkError) throw new Error(linkError.message)
      setSuccess('OT Viva habilitada para esta orden de trabajo.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo habilitar OT Viva.')
    } finally {
      setBusy(false)
    }
  }

  async function iniciarSesion() {
    if (!ot || !caso || !userId) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const key = crypto.randomUUID()
      const { error: sesionError } = await supabase
        .from('asistente_sesiones')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: caso.id,
          modo: 'diagnostico_terreno',
          estado: 'en_curso',
          origen_interfaz: 'movil',
          iniciado_por: userId,
          origen_externo: 'ot_viva',
          clave_externa: key,
          datos: { ot_id: ot.id, folio: ot.folio, origen_modulo: 'ot' },
        })

      if (sesionError) throw new Error(sesionError.message)
      setSuccess('Sesión técnica iniciada.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la sesión.')
    } finally {
      setBusy(false)
    }
  }

  async function finalizarSesion() {
    if (!sesionActiva || !userId) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const now = new Date().toISOString()
      const { error: finishError } = await supabase
        .from('asistente_sesiones')
        .update({
          estado: 'finalizada',
          finalizado_at: now,
          finalizado_por: userId,
          ultima_actividad_at: now,
        })
        .eq('id', sesionActiva.id)

      if (finishError) throw new Error(finishError.message)
      setSuccess('Sesión técnica finalizada.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la sesión.')
    } finally {
      setBusy(false)
    }
  }

  async function crearEvento() {
    if (!ot || !caso || !sesionActiva || !userId || !textoEvento.trim()) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const eventKey = crypto.randomUUID()
      const { data: inserted, error: eventError } = await supabase
        .from('asistente_eventos')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: caso.id,
          sesion_id: sesionActiva.id,
          tipo_evento: tipoEvento,
          nivel_certeza: nivelParaTipo(tipoEvento),
          autor_tipo: 'persona',
          origen_captura: 'movil',
          usuario_id: userId,
          texto_original: textoEvento.trim(),
          visible_externo: false,
          incluir_resumen: true,
          estado: 'activo',
          estado_validacion: 'no_requiere',
          datos: { ot_id: ot.id, origen_modulo: 'ot', local_event_id: eventKey },
          origen_externo: 'ot_viva',
          clave_externa: eventKey,
        })
        .select('id')
        .single()

      if (eventError || !inserted) throw new Error(eventError?.message || 'No se pudo guardar el evento.')

      setTextoEvento('')
      setEventoSeleccionado(inserted.id)
      setSuccess('Evento registrado en la sesión.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el evento.')
    } finally {
      setBusy(false)
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setArchivo(event.target.files?.[0] || null)
  }

  async function crearRelacionHipotesis() {
    if (!ot || !caso || !userId || !hipotesisDestino || !eventoOrigenRelacion) return
    if (hipotesisDestino === eventoOrigenRelacion) {
      setError('El evento de origen y la hipótesis de destino deben ser distintos.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const { error: relationError } = await supabase
        .from('asistente_evento_relaciones')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: caso.id,
          evento_origen_id: eventoOrigenRelacion,
          evento_destino_id: hipotesisDestino,
          tipo_relacion: tipoRelacion,
          observacion: observacionRelacion.trim() || null,
          created_by: userId,
        })

      if (relationError) throw new Error(relationError.message)

      setObservacionRelacion('')
      setSuccess('Relación técnica registrada sobre la hipótesis.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la relación.')
    } finally {
      setBusy(false)
    }
  }

  async function anularRelacion(relacion: RelacionEventoRow) {
    if (!userId || !relacion.activo) return

    const motivo = window.prompt(
      'Indica brevemente por qué corriges esta relación. La relación no se eliminará; quedará en el historial.'
    )
    if (motivo === null) return
    if (!motivo.trim()) {
      setError('Debes indicar el motivo de la corrección.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('asistente_evento_relaciones')
        .update({
          activo: false,
          anulado_at: now,
          anulado_by: userId,
          motivo_anulacion: motivo.trim(),
          updated_at: now,
          updated_by: userId,
        })
        .eq('id', relacion.id)

      if (updateError) throw new Error(updateError.message)

      setSuccess('Relación corregida. Se conserva en el historial y ya no afecta el análisis activo.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo corregir la relación.')
    } finally {
      setBusy(false)
    }
  }

  async function decidirHipotesis(decision: 'confirmada' | 'descartada') {
    if (!ot || !caso || !sesionActiva || !userId || !hipotesisDecision) return
    if (!motivoDecision.trim()) {
      setError('Debes indicar el fundamento de la decisión humana.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const { error: decisionError } = await supabase
        .from('asistente_decisiones')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: caso.id,
          sesion_id: sesionActiva.id,
          evento_id: hipotesisDecision,
          recomendacion_id: null,
          actor_tipo: 'tecnico',
          actor_nombre_snapshot: userName || null,
          actor_cargo_snapshot: userRole || null,
          decision,
          motivo: motivoDecision.trim(),
          visible_externo: false,
          datos: {
            ot_id: ot.id,
            origen_modulo: 'ot_viva',
            tipo_resolucion: 'hipotesis',
          },
          created_by: userId,
        })

      if (decisionError) throw new Error(decisionError.message)

      setMotivoDecision('')
      setSuccess(`Hipótesis ${decision === 'confirmada' ? 'confirmada' : 'descartada'} con decisión humana trazable.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la decisión.')
    } finally {
      setBusy(false)
    }
  }

  async function subirEvidencia() {
    if (!ot || !caso || !sesionActiva || !userId || !eventoSeleccionado || !archivo) return

    setBusy(true)
    setError('')
    setSuccess('')

    const evidenceKey = crypto.randomUUID()
    const filename = safeName(archivo.name || 'evidencia')
    const storagePath = `${ot.empresa_id}/${caso.id}/${sesionActiva.id}/${evidenceKey}-${filename}`

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, archivo, {
          cacheControl: '3600',
          upsert: false,
          contentType: archivo.type || undefined,
        })

      if (uploadError) throw new Error(uploadError.message)

      const { data: evidenceData, error: evidenceError } = await supabase
        .from('asistente_evidencias')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: caso.id,
          sesion_id: sesionActiva.id,
          tipo_evidencia: evidenciaTipo(archivo),
          origen_captura: 'movil',
          storage_bucket: BUCKET,
          storage_path: storagePath,
          archivo_nombre: archivo.name,
          mime_type: archivo.type || null,
          descripcion: descripcionEvidencia.trim() || null,
          hash_sha256: null,
          datos: {
            ot_id: ot.id,
            origen_modulo: 'ot',
            size_bytes: archivo.size,
            local_evidence_id: evidenceKey,
          },
          origen_externo: 'ot_viva',
          clave_externa: evidenceKey,
          created_by: userId,
        })
        .select('id')
        .single()

      if (evidenceError || !evidenceData) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        throw new Error(evidenceError?.message || 'No se pudo registrar la evidencia.')
      }

      const { error: relationError } = await supabase
        .from('asistente_evento_evidencias')
        .insert({
          empresa_id: ot.empresa_id,
          caso_id: caso.id,
          evento_id: eventoSeleccionado,
          evidencia_id: evidenceData.id,
          tipo_uso: tipoUso,
          observacion: descripcionEvidencia.trim() || null,
          created_by: userId,
        })

      if (relationError) throw new Error(relationError.message)

      setArchivo(null)
      setDescripcionEvidencia('')
      const fileInput = document.getElementById('ot-viva-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      setSuccess('Evidencia guardada y asociada al evento.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la evidencia.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Cargando OT Viva...</div>
  }

  if (!ot) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'No se encontró la OT.'}</div>
        <Link href="/ot" className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Volver a OT</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">OT Viva · Piloto controlado</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{ot.folio || 'OT'} · {ot.titulo || 'Sesión técnica'}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Registro técnico vivo de hallazgos, pruebas, hipótesis y evidencias. La resolución final seguirá siendo trazable y humana.
            </p>
          </div>
          <Link href={`/ot/${ot.id}`} className="inline-flex rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Volver a la OT
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {!caso ? (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Habilitar OT Viva</h2>
          <p className="mt-2 text-sm text-slate-700">Esta OT todavía no tiene un caso técnico vivo asociado.</p>
          <button type="button" onClick={() => void crearCaso()} disabled={busy} className="mt-4 rounded-xl bg-cyan-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Habilitando...' : 'Habilitar OT Viva'}
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sesión técnica</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {sesionActiva ? `Activa desde ${formatDateTime(sesionActiva.iniciado_at)}` : 'No existe una sesión activa.'}
                </p>
              </div>
              {sesionActiva ? (
                <button type="button" onClick={() => void finalizarSesion()} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">
                  Finalizar sesión
                </button>
              ) : (
                <button type="button" onClick={() => void iniciarSesion()} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Iniciar sesión Viva
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Registrar evento</h2>
            <p className="mt-1 text-sm text-slate-600">Registra primero el hecho técnico; después puedes adjuntar evidencia a ese evento.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
              <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} disabled={!sesionActiva || busy} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
                <option value="hallazgo">Hallazgo</option>
                <option value="prueba">Prueba / verificación</option>
                <option value="hipotesis">Hipótesis</option>
                <option value="accion">Acción realizada</option>
                <option value="resultado">Resultado</option>
                <option value="medicion">Medición</option>
              </select>
              <textarea value={textoEvento} onChange={(e) => setTextoEvento(e.target.value)} disabled={!sesionActiva || busy || transcribiendoVoz} rows={3} placeholder="Ej.: Se detecta ruido anormal en el rodamiento lado transmisión..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void alternarGrabacionVoz('evento')}
                disabled={!sesionActiva || busy || transcribiendoVoz || Boolean(grabandoVoz && grabandoVoz !== 'evento')}
                className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
                  grabandoVoz === 'evento' ? 'bg-rose-700' : 'bg-cyan-800'
                }`}
              >
                {transcribiendoVoz
                  ? 'Transcribiendo...'
                  : grabandoVoz === 'evento'
                    ? 'Detener grabación'
                    : 'Hablar evento'}
              </button>
              <p className="text-xs text-slate-500">
                Habla en lenguaje natural. Tralixia transcribe y tú revisas antes de guardar.
              </p>
            </div>

            <button type="button" onClick={() => void crearEvento()} disabled={!sesionActiva || busy || transcribiendoVoz || Boolean(grabandoVoz) || !textoEvento.trim()} className="mt-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              Guardar evento
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Evidencia Viva</h2>
            <p className="mt-1 text-sm text-slate-600">Foto, video, audio o PDF quedan guardados en almacenamiento privado y vinculados al evento seleccionado.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Evento relacionado</label>
                  <select value={eventoSeleccionado} onChange={(e) => setEventoSeleccionado(e.target.value)} disabled={!sesionActiva || busy} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
                    <option value="">Selecciona un evento</option>
                    {eventos.map((evento) => (
                      <option key={evento.id} value={evento.id}>
                        {evento.tipo_evento} · {evento.texto_original.slice(0, 90)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Uso de la evidencia</label>
                  <select value={tipoUso} onChange={(e) => setTipoUso(e.target.value)} disabled={!sesionActiva || busy} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
                    <option value="evidencia">Evidencia</option>
                    <option value="contexto">Contexto</option>
                    <option value="antes">Antes</option>
                    <option value="despues">Después</option>
                    <option value="validacion">Validación</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Archivo</label>
                  <input id="ot-viva-file" type="file" accept="image/*,video/*,audio/*,application/pdf" capture="environment" onChange={onFileChange} disabled={!sesionActiva || busy} className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm" />
                  {archivo ? <p className="mt-1 text-xs text-slate-500">{archivo.name} · {(archivo.size / 1024 / 1024).toFixed(2)} MB</p> : null}
                </div>

                <textarea value={descripcionEvidencia} onChange={(e) => setDescripcionEvidencia(e.target.value)} disabled={!sesionActiva || busy} rows={2} placeholder="Descripción opcional de la evidencia..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />

                <button type="button" onClick={() => void subirEvidencia()} disabled={!sesionActiva || busy || !archivo || !eventoSeleccionado} className="rounded-xl bg-cyan-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? 'Guardando...' : 'Guardar evidencia'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Evidencias registradas</h3>
                <div className="mt-3 space-y-3">
                  {evidencias.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún no hay evidencias registradas en este caso.</p>
                  ) : evidencias.map((ev) => {
                    const rels = relaciones.filter((rel) => rel.evidencia_id === ev.id)
                    return (
                      <div key={ev.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">{ev.tipo_evidencia}</span>
                          <span className="text-xs text-slate-500">{formatDateTime(ev.capturado_at)}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{ev.archivo_nombre || 'Evidencia'}</p>
                        {ev.descripcion ? <p className="mt-1 text-sm text-slate-600">{ev.descripcion}</p> : null}
                        {rels.length ? <p className="mt-1 text-xs text-slate-500">Vínculo: {rels.map((rel) => rel.tipo_uso).join(', ')}</p> : null}
                        {ev.signedUrl ? (
                          <a href={ev.signedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-semibold text-cyan-700 hover:underline">
                            Ver evidencia
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {asistenteIAHabilitado ? (
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Capacidad habilitada por empresa
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Asistente Técnico IA</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Consulta únicamente el contexto autorizado de esta empresa, esta OT y este caso.
                    Sus respuestas se registran como propuestas pendientes de validación humana.
                  </p>
                </div>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                  IA activa
                </span>
              </div>

              {!caso ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Primero habilita OT Viva para esta orden antes de usar el asistente.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={preguntaIA}
                    onChange={(e) => setPreguntaIA(e.target.value)}
                    disabled={consultandoIA || transcribiendoVoz}
                    rows={3}
                    maxLength={4000}
                    placeholder="Ej.: Según lo registrado en esta OT, ¿qué debería verificar a continuación?"
                    className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm"
                  />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void alternarGrabacionVoz('ia')}
                      disabled={consultandoIA || transcribiendoVoz || Boolean(grabandoVoz && grabandoVoz !== 'ia')}
                      className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
                        grabandoVoz === 'ia' ? 'bg-rose-700' : 'bg-indigo-600'
                      }`}
                    >
                      {transcribiendoVoz
                        ? 'Transcribiendo...'
                        : grabandoVoz === 'ia'
                          ? 'Detener grabación'
                          : 'Hablar con Tralixia'}
                    </button>
                    <p className="text-xs text-slate-500">
                      Dicta tu consulta y revisa la transcripción antes de enviarla.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void consultarAsistenteIA()}
                    disabled={consultandoIA || transcribiendoVoz || Boolean(grabandoVoz) || !preguntaIA.trim()}
                    className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {consultandoIA ? 'Consultando...' : 'Consultar asistente'}
                  </button>

                  {respuestaIA ? (
                    <div className="rounded-xl border border-indigo-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        Respuesta IA · pendiente de validación
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                        {respuestaIA}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Análisis de hipótesis</h2>
            <p className="mt-1 text-sm text-slate-600">
              Relaciona hechos con hipótesis y deja la confirmación o descarte como una decisión humana explícita.
            </p>

            {hipotesis.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Registra al menos un evento de tipo Hipótesis para habilitar este análisis.
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Relacionar evidencia técnica</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      El evento de origen puede apoyar, confirmar, contradecir o descartar una hipótesis.
                    </p>

                    <div className="mt-3 space-y-3">
                      <select
                        value={hipotesisDestino}
                        onChange={(e) => setHipotesisDestino(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                      >
                        <option value="">Hipótesis destino</option>
                        {hipotesis.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.texto_original.slice(0, 110)}
                          </option>
                        ))}
                      </select>

                      <select
                        value={eventoOrigenRelacion}
                        onChange={(e) => setEventoOrigenRelacion(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                      >
                        <option value="">Evento que aporta información</option>
                        {eventos
                          .filter((item) => item.id !== hipotesisDestino)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.tipo_evento} · {item.texto_original.slice(0, 100)}
                            </option>
                          ))}
                      </select>

                      <select
                        value={tipoRelacion}
                        onChange={(e) => setTipoRelacion(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                      >
                        <option value="sustenta">A favor · sustenta</option>
                        <option value="confirma">A favor · confirma</option>
                        <option value="contradice">En contra · contradice</option>
                        <option value="descarta">En contra · descarta</option>
                      </select>

                      {eventoOrigenSeleccionado && hipotesisDestinoSeleccionada ? (
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                            Revisa antes de registrar
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-700">Evento de origen</p>
                          <p className="mt-1 text-sm text-slate-900">
                            {eventoOrigenSeleccionado.tipo_evento} · {eventoOrigenSeleccionado.texto_original}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-700">Hipótesis destino</p>
                          <p className="mt-1 text-sm text-slate-900">{hipotesisDestinoSeleccionada.texto_original}</p>
                          <p className="mt-2 text-xs font-semibold text-cyan-800">
                            Relación: {tipoRelacion}
                          </p>
                        </div>
                      ) : null}

                      <textarea
                        value={observacionRelacion}
                        onChange={(e) => setObservacionRelacion(e.target.value)}
                        disabled={busy}
                        rows={2}
                        placeholder="Observación opcional sobre esta relación..."
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />

                      <button
                        type="button"
                        onClick={() => void crearRelacionHipotesis()}
                        disabled={busy || !hipotesisDestino || !eventoOrigenRelacion}
                        className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Registrar relación
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Resolución humana</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      La IA o la evidencia pueden orientar el análisis, pero la confirmación o descarte queda atribuida a una persona.
                    </p>

                    <div className="mt-3 space-y-3">
                      <select
                        value={hipotesisDecision}
                        onChange={(e) => setHipotesisDecision(e.target.value)}
                        disabled={!sesionActiva || busy}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                      >
                        <option value="">Selecciona una hipótesis</option>
                        {hipotesis.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.texto_original.slice(0, 110)}
                          </option>
                        ))}
                      </select>

                      <textarea
                        value={motivoDecision}
                        onChange={(e) => setMotivoDecision(e.target.value)}
                        disabled={!sesionActiva || busy}
                        rows={3}
                        placeholder="Fundamento técnico obligatorio de la decisión..."
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                      />

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void decidirHipotesis('confirmada')}
                          disabled={!sesionActiva || busy || !hipotesisDecision || !motivoDecision.trim()}
                          className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Confirmar hipótesis
                        </button>
                        <button
                          type="button"
                          onClick={() => void decidirHipotesis('descartada')}
                          disabled={!sesionActiva || busy || !hipotesisDecision || !motivoDecision.trim()}
                          className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Descartar hipótesis
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {hipotesis.map((item) => {
                    const incoming = relacionesEventosActivas.filter((rel) => rel.evento_destino_id === item.id)
                    const anuladas = relacionesEventos.filter(
                      (rel) => rel.evento_destino_id === item.id && rel.activo === false
                    )
                    const favor = incoming.filter((rel) => ['sustenta', 'confirma'].includes(rel.tipo_relacion))
                    const contra = incoming.filter((rel) => ['contradice', 'descarta'].includes(rel.tipo_relacion))
                    const conflicts = relacionesEventosActivas.filter(
                      (rel) =>
                        rel.tipo_relacion === 'contradice' &&
                        ((rel.evento_destino_id === item.id &&
                          eventosById.get(rel.evento_origen_id)?.tipo_evento === 'hipotesis') ||
                          (rel.evento_origen_id === item.id &&
                            eventosById.get(rel.evento_destino_id)?.tipo_evento === 'hipotesis'))
                    )
                    const historialDecision = decisiones
                      .filter((decision) => decision.evento_id === item.id)
                      .sort(
                        (a, b) =>
                          new Date(a.decidido_at).getTime() - new Date(b.decidido_at).getTime()
                      )
                    const latestDecision = historialDecision[historialDecision.length - 1]

                    return (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Hipótesis
                          </span>
                          {latestDecision ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                latestDecision.decision === 'confirmada'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {latestDecision.decision === 'confirmada'
                                ? 'Confirmada por técnico'
                                : 'Descartada por técnico'}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              En evaluación
                            </span>
                          )}
                          {conflicts.length > 0 ? (
                            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                              Conflicto de hipótesis
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-900">{item.texto_original}</p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg bg-emerald-50 px-3 py-2">
                            <p className="text-xs font-semibold text-emerald-800">A favor</p>
                            <p className="mt-0.5 text-lg font-bold text-emerald-900">{favor.length}</p>
                          </div>
                          <div className="rounded-lg bg-rose-50 px-3 py-2">
                            <p className="text-xs font-semibold text-rose-800">En contra</p>
                            <p className="mt-0.5 text-lg font-bold text-rose-900">{contra.length}</p>
                          </div>
                          <div className="rounded-lg bg-orange-50 px-3 py-2">
                            <p className="text-xs font-semibold text-orange-800">Conflictos</p>
                            <p className="mt-0.5 text-lg font-bold text-orange-900">{conflicts.length}</p>
                          </div>
                        </div>

                        {incoming.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {incoming.map((rel) => {
                              const source = eventosById.get(rel.evento_origen_id)
                              const isPositive = ['sustenta', 'confirma'].includes(rel.tipo_relacion)
                              return (
                                <div key={rel.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        isPositive
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {rel.tipo_relacion}
                                    </span>
                                    <span className="text-xs text-slate-500">{source?.tipo_evento || 'evento'}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-700">
                                    {source?.texto_original || 'Evento relacionado'}
                                  </p>
                                  {rel.observacion ? (
                                    <p className="mt-1 text-xs italic text-slate-500">{rel.observacion}</p>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => void anularRelacion(rel)}
                                    disabled={busy}
                                    className="mt-2 text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
                                  >
                                    Corregir relación
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        {anuladas.length > 0 ? (
                          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                              Historial de correcciones ({anuladas.length})
                            </summary>
                            <div className="mt-2 space-y-2">
                              {anuladas.map((rel) => {
                                const source = eventosById.get(rel.evento_origen_id)
                                return (
                                  <div key={rel.id} className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">
                                    <p className="line-through">
                                      {rel.tipo_relacion} · {source?.texto_original || 'Evento relacionado'}
                                    </p>
                                    {rel.motivo_anulacion ? (
                                      <p className="mt-1 font-medium text-slate-600">
                                        Motivo: {rel.motivo_anulacion}
                                      </p>
                                    ) : null}
                                    {rel.anulado_at ? (
                                      <p className="mt-1">Corregida: {formatDateTime(rel.anulado_at)}</p>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          </details>
                        ) : null}

                        {latestDecision ? (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Última decisión humana
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {latestDecision.actor_nombre_snapshot || 'Usuario'} · {formatDateTime(latestDecision.decidido_at)}
                            </p>
                            {latestDecision.motivo ? (
                              <p className="mt-1 text-sm text-slate-700">{latestDecision.motivo}</p>
                            ) : null}
                            {historialDecision.length > 1 ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Historial: {historialDecision.length} decisiones registradas. Se conserva la trazabilidad completa.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Línea técnica</h2>
            <div className="mt-4 space-y-3">
              {eventos.length === 0 ? (
                <p className="text-sm text-slate-500">Aún no hay eventos registrados.</p>
              ) : eventos.map((evento) => {
                const linkedCount = relaciones.filter((rel) => rel.evento_id === evento.id).length
                return (
                  <div key={evento.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeForTipo(evento.tipo_evento)}`}>{evento.tipo_evento}</span>
                      <span className="text-xs text-slate-500">{evento.nivel_certeza}</span>
                      {evento.autor_tipo === 'asistente' ? (
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                          IA · {evento.estado_validacion === 'pendiente' ? 'pendiente de validación' : evento.estado_validacion}
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-slate-500">{formatDateTime(evento.ocurrido_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{evento.texto_original}</p>
                    {linkedCount > 0 ? <p className="mt-2 text-xs font-medium text-cyan-700">{linkedCount} evidencia{linkedCount === 1 ? '' : 's'} asociada{linkedCount === 1 ? '' : 's'}</p> : null}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default function OTVivaPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot" allowOfflineTerrainAccess>
      <OTVivaContent />
    </ProtectedModuleRoute>
  )
}
