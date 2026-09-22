import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EventoOTVivaLocal,
  RelacionOTVivaLocal,
  SesionOTVivaLocal,
} from '@/lib/asistente/ot-viva-sync'

type StoreRemotoOTViva = {
  sesiones: SesionOTVivaLocal[]
  relaciones: RelacionOTVivaLocal[]
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function texto(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function cargarOTVivaRemota(
  supabase: SupabaseClient,
  empresaId: string,
  otId: string,
): Promise<StoreRemotoOTViva> {
  const { data: vinculo, error: vinculoError } = await supabase
    .from('asistente_caso_ots')
    .select('caso_id')
    .eq('empresa_id', empresaId)
    .eq('ot_id', otId)
    .maybeSingle()

  if (vinculoError) {
    throw new Error(`No se pudo recuperar la memoria OT Viva: ${vinculoError.message}`)
  }
  if (!vinculo?.caso_id) return { sesiones: [], relaciones: [] }

  const casoId = vinculo.caso_id as string

  const [sesionesResp, eventosResp, relacionesResp] = await Promise.all([
    supabase
      .from('asistente_sesiones')
      .select('id, estado, iniciado_at, finalizado_at, motivo_pausa, datos, origen_externo')
      .eq('caso_id', casoId)
      .eq('empresa_id', empresaId)
      .eq('origen_externo', 'ot_viva_local')
      .order('iniciado_at', { ascending: true }),
    supabase
      .from('asistente_eventos')
      .select('id, sesion_id, tipo_evento, nivel_certeza, texto_original, descripcion_normalizada, contexto_etiqueta, prioridad, ocurrido_at, visible_externo, incluir_resumen, datos, origen_externo, estado')
      .eq('caso_id', casoId)
      .eq('empresa_id', empresaId)
      .eq('origen_externo', 'ot_viva_local')
      .eq('estado', 'activo')
      .order('ocurrido_at', { ascending: true }),
    supabase
      .from('asistente_evento_relaciones')
      .select('id, evento_origen_id, evento_destino_id, tipo_relacion, observacion, created_at')
      .eq('caso_id', casoId)
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true }),
  ])

  if (sesionesResp.error) {
    throw new Error(`No se pudieron recuperar las sesiones OT Viva: ${sesionesResp.error.message}`)
  }
  if (eventosResp.error) {
    throw new Error(`No se pudieron recuperar los eventos OT Viva: ${eventosResp.error.message}`)
  }
  if (relacionesResp.error) {
    throw new Error(`No se pudieron recuperar las relaciones OT Viva: ${relacionesResp.error.message}`)
  }

  const eventLocalIdByDbId = new Map<string, string>()
  const eventosPorSesion = new Map<string, EventoOTVivaLocal[]>()

  for (const row of eventosResp.data ?? []) {
    const datos = asObject(row.datos)
    const localEventId = texto(datos.local_event_id) || String(row.id)
    const localSessionId = texto(datos.local_session_id)
    if (!localSessionId) continue

    eventLocalIdByDbId.set(String(row.id), localEventId)

    const evento: EventoOTVivaLocal = {
      id: localEventId,
      tipo_evento: texto(row.tipo_evento),
      nivel_certeza: texto(row.nivel_certeza),
      texto_original: texto(row.texto_original),
      descripcion_tecnica: texto(row.descripcion_normalizada),
      componente: texto(row.contexto_etiqueta),
      prioridad: (row.prioridad as EventoOTVivaLocal['prioridad']) ?? null,
      visible_cliente: Boolean(row.visible_externo),
      incluir_ot: row.incluir_resumen !== false,
      ocurrido_at: texto(row.ocurrido_at),
    }

    const lista = eventosPorSesion.get(localSessionId) ?? []
    lista.push(evento)
    eventosPorSesion.set(localSessionId, lista)
  }

  const sesiones: SesionOTVivaLocal[] = (sesionesResp.data ?? []).map((row) => {
    const datos = asObject(row.datos)
    const localSessionId = texto(datos.local_session_id) || String(row.id)
    return {
      id: localSessionId,
      estado: row.estado as SesionOTVivaLocal['estado'],
      estado_sync: 'sincronizada',
      iniciado_at: texto(row.iniciado_at),
      finalizado_at: typeof row.finalizado_at === 'string' ? row.finalizado_at : null,
      motivo_pausa: typeof row.motivo_pausa === 'string' ? row.motivo_pausa : null,
      interrumpido_at: typeof datos.interrumpido_at === 'string' ? datos.interrumpido_at : null,
      reanudado_at: typeof datos.reanudado_at === 'string' ? datos.reanudado_at : null,
      eventos: eventosPorSesion.get(localSessionId) ?? [],
    }
  })

  const relaciones: RelacionOTVivaLocal[] = []
  for (const row of relacionesResp.data ?? []) {
    const sourceLocalId = eventLocalIdByDbId.get(String(row.evento_origen_id))
    const targetLocalId = eventLocalIdByDbId.get(String(row.evento_destino_id))
    if (!sourceLocalId || !targetLocalId) continue

    relaciones.push({
      id: String(row.id),
      evento_origen_id: sourceLocalId,
      evento_destino_id: targetLocalId,
      tipo_relacion: texto(row.tipo_relacion),
      observacion: typeof row.observacion === 'string' ? row.observacion : null,
      created_at: texto(row.created_at),
      estado_sync: 'sincronizada',
    })
  }

  return { sesiones, relaciones }
}
