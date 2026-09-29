'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
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

  const [tipoEvento, setTipoEvento] = useState('hallazgo')
  const [textoEvento, setTextoEvento] = useState('')
  const [eventoSeleccionado, setEventoSeleccionado] = useState('')
  const [tipoUso, setTipoUso] = useState('evidencia')
  const [descripcionEvidencia, setDescripcionEvidencia] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)

  const sesionActiva = useMemo(
    () => sesiones.find((item) => item.estado === 'en_curso') ?? null,
    [sesiones]
  )

  const loadAll = useCallback(async () => {
    if (!otId) return
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('No se pudo validar la sesión.')
      setUserId(authData.user.id)

      const { data: otData, error: otError } = await supabase
        .from('ot_ordenes_trabajo')
        .select('id,empresa_id,cliente_id,folio,titulo,descripcion_solicitud')
        .eq('id', otId)
        .single()

      if (otError || !otData) throw new Error(otError?.message || 'No se encontró la OT.')
      const currentOt = otData as OtRow
      setOt(currentOt)

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
        return
      }

      const [sesionesResp, eventosResp, evidenciasResp, relacionesResp] = await Promise.all([
        supabase
          .from('asistente_sesiones')
          .select('id,estado,iniciado_at,finalizado_at')
          .eq('caso_id', currentCaso.id)
          .eq('empresa_id', currentOt.empresa_id)
          .order('iniciado_at', { ascending: false }),
        supabase
          .from('asistente_eventos')
          .select('id,sesion_id,tipo_evento,nivel_certeza,texto_original,ocurrido_at,autor_tipo,origen_captura')
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
      ])

      if (sesionesResp.error) throw new Error(sesionesResp.error.message)
      if (eventosResp.error) throw new Error(eventosResp.error.message)
      if (evidenciasResp.error) throw new Error(evidenciasResp.error.message)
      if (relacionesResp.error) throw new Error(relacionesResp.error.message)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar OT Viva.')
    } finally {
      setLoading(false)
    }
  }, [otId, eventoSeleccionado])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

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
              <textarea value={textoEvento} onChange={(e) => setTextoEvento(e.target.value)} disabled={!sesionActiva || busy} rows={3} placeholder="Ej.: Se detecta ruido anormal en el rodamiento lado transmisión..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />
            </div>

            <button type="button" onClick={() => void crearEvento()} disabled={!sesionActiva || busy || !textoEvento.trim()} className="mt-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
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
