import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanSyncOTViva } from '@/lib/asistente/ot-viva-sync'

export type ResultadoSyncOTViva = {
  caso_id: string
  sesiones_procesadas: number
  eventos_procesados: number
}

const ORIGEN_EXTERNO = 'ot_viva_local'

function claveCaso(otId: string) {
  return `ot:${otId}`
}

function claveSesion(otId: string, localSessionId: string) {
  return `ot:${otId}:sesion:${localSessionId}`
}

function claveEvento(otId: string, localSessionId: string, localEventId: string) {
  return `ot:${otId}:sesion:${localSessionId}:evento:${localEventId}`
}

async function upsertCaso(supabase: SupabaseClient, plan: PlanSyncOTViva) {
  const payload = {
    ...plan.caso,
    origen_externo: ORIGEN_EXTERNO,
    clave_externa: claveCaso(plan.contexto.ot_id),
    updated_by: plan.contexto.usuario_id,
  }

  const { data, error } = await supabase
    .from('asistente_casos')
    .upsert(payload, { onConflict: 'empresa_id,origen_externo,clave_externa' })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo sincronizar el caso: ${error.message}`)
  if (!data?.id) throw new Error('La sincronización del caso no devolvió un identificador.')
  return data.id as string
}

async function asegurarVinculoOT(
  supabase: SupabaseClient,
  plan: PlanSyncOTViva,
  casoId: string,
) {
  const { error } = await supabase
    .from('asistente_caso_ots')
    .upsert({
      ...plan.vinculo_ot,
      caso_id: casoId,
      created_by: plan.contexto.usuario_id,
    }, { onConflict: 'caso_id,ot_id' })

  if (error) throw new Error(`No se pudo vincular el caso con la OT: ${error.message}`)
}

async function upsertSesion(
  supabase: SupabaseClient,
  plan: PlanSyncOTViva,
  casoId: string,
  sesionPlan: PlanSyncOTViva['sesiones'][number],
) {
  const payload = {
    ...sesionPlan.sesion,
    caso_id: casoId,
    origen_externo: ORIGEN_EXTERNO,
    clave_externa: claveSesion(plan.contexto.ot_id, sesionPlan.local_session_id),
  }

  const { data, error } = await supabase
    .from('asistente_sesiones')
    .upsert(payload, { onConflict: 'empresa_id,origen_externo,clave_externa' })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo sincronizar la sesión ${sesionPlan.local_session_id}: ${error.message}`)
  if (!data?.id) throw new Error(`La sesión ${sesionPlan.local_session_id} no devolvió un identificador.`)
  return data.id as string
}

async function upsertEvento(
  supabase: SupabaseClient,
  plan: PlanSyncOTViva,
  casoId: string,
  sesionId: string,
  localSessionId: string,
  eventoPlan: PlanSyncOTViva['sesiones'][number]['eventos'][number],
) {
  const payload = {
    ...eventoPlan.evento,
    caso_id: casoId,
    sesion_id: sesionId,
    origen_externo: ORIGEN_EXTERNO,
    clave_externa: claveEvento(plan.contexto.ot_id, localSessionId, eventoPlan.local_event_id),
    updated_by: plan.contexto.usuario_id,
  }

  const { error } = await supabase
    .from('asistente_eventos')
    .upsert(payload, { onConflict: 'empresa_id,origen_externo,clave_externa' })

  if (error) {
    throw new Error(`No se pudo sincronizar el evento ${eventoPlan.local_event_id}: ${error.message}`)
  }
}

export async function sincronizarPlanOTVivaSupabase(
  supabase: SupabaseClient,
  plan: PlanSyncOTViva,
): Promise<ResultadoSyncOTViva> {
  if (plan.version !== 1) throw new Error(`Versión de plan de sincronización no soportada: ${plan.version}`)
  if (!plan.contexto.empresa_id || !plan.contexto.ot_id || !plan.contexto.usuario_id) {
    throw new Error('El plan de sincronización no contiene contexto suficiente.')
  }

  const casoId = await upsertCaso(supabase, plan)
  await asegurarVinculoOT(supabase, plan, casoId)

  let eventosProcesados = 0

  for (const sesionPlan of plan.sesiones) {
    const sesionId = await upsertSesion(supabase, plan, casoId, sesionPlan)

    for (const eventoPlan of sesionPlan.eventos) {
      await upsertEvento(
        supabase,
        plan,
        casoId,
        sesionId,
        sesionPlan.local_session_id,
        eventoPlan,
      )
      eventosProcesados += 1
    }
  }

  return {
    caso_id: casoId,
    sesiones_procesadas: plan.sesiones.length,
    eventos_procesados: eventosProcesados,
  }
}
