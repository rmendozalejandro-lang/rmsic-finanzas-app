export type EstadoSesionLocal = 'en_curso' | 'pausada' | 'interrumpida' | 'finalizada'
export type EstadoSyncLocal = 'local' | 'pendiente_sync' | 'sincronizada' | 'error'

export type EventoOTVivaLocal = {
  id: string
  tipo_evento: string
  nivel_certeza: string
  texto_original: string
  descripcion_tecnica?: string
  componente?: string
  prioridad?: 'baja' | 'media' | 'alta' | 'critica' | null
  visible_cliente?: boolean
  incluir_ot?: boolean
  ocurrido_at: string
}

export type SesionOTVivaLocal = {
  id: string
  estado: EstadoSesionLocal
  estado_sync: EstadoSyncLocal
  iniciado_at: string
  finalizado_at: string | null
  motivo_pausa?: string | null
  interrumpido_at?: string | null
  reanudado_at?: string | null
  eventos: EventoOTVivaLocal[]
}

export type ContextoOTParaSync = {
  empresa_id: string
  cliente_id: string
  ot_id: string
  titulo: string
  descripcion_inicial?: string | null
  problema_reportado?: string | null
  usuario_id: string
}

export type CasoTecnicoSeed = {
  empresa_id: string
  cliente_id: string
  dominio: 'tecnico'
  tipo_caso: 'ot_terreno'
  titulo: string
  descripcion_inicial: string | null
  estado: 'en_ejecucion'
  origen: 'ot'
  responsable_id: string
  datos: {
    origen_modulo: 'ot'
    ot_id: string
    sync_local_key: string
  }
}

export type VinculoOTSeed = {
  empresa_id: string
  ot_id: string
  rol: 'principal'
}

export type SesionAsistenteSeed = {
  empresa_id: string
  modo: 'ot_terreno'
  estado: 'en_curso' | 'pausada' | 'interrumpida' | 'finalizada'
  origen_interfaz: 'movil' | 'web' | 'offline_sync'
  iniciado_por: string
  finalizado_por: string | null
  iniciado_at: string
  ultima_actividad_at: string
  finalizado_at: string | null
  motivo_pausa: string | null
  checkpoint: Record<string, unknown>
  datos: {
    origen_modulo: 'ot'
    ot_id: string
    local_session_id: string
    interrumpido_at?: string | null
    reanudado_at?: string | null
  }
}

export type EventoAsistenteSeed = {
  empresa_id: string
  tipo_evento: string
  nivel_certeza: string
  autor_tipo: 'persona'
  origen_captura: 'movil' | 'offline_sync'
  usuario_id: string
  texto_original: string
  descripcion_normalizada: string | null
  contexto_etiqueta: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'critica' | null
  ocurrido_at: string
  visible_externo: boolean
  incluir_resumen: boolean
  estado: 'activo'
  estado_validacion: 'no_requiere'
  datos: {
    origen_modulo: 'ot'
    ot_id: string
    local_session_id: string
    local_event_id: string
  }
}

export type PlanSyncOTViva = {
  version: 1
  contexto: ContextoOTParaSync
  caso: CasoTecnicoSeed
  vinculo_ot: VinculoOTSeed
  sesiones: Array<{
    local_session_id: string
    sesion: SesionAsistenteSeed
    eventos: Array<{
      local_event_id: string
      evento: EventoAsistenteSeed
    }>
  }>
}

function textoInicial(contexto: ContextoOTParaSync) {
  const partes = [contexto.descripcion_inicial?.trim(), contexto.problema_reportado?.trim()].filter(Boolean)
  return partes.length ? partes.join('\n\n') : null
}

function ultimaActividad(sesion: SesionOTVivaLocal) {
  const ultima = sesion.eventos.at(-1)?.ocurrido_at
  return sesion.reanudado_at ?? sesion.interrumpido_at ?? ultima ?? sesion.finalizado_at ?? sesion.iniciado_at
}

function checkpointBasico(sesion: SesionOTVivaLocal) {
  const eventos = sesion.eventos
  const ultimo = eventos.at(-1) ?? null
  const hipotesisAbiertas = eventos
    .filter((evento) => evento.tipo_evento === 'hipotesis' && evento.nivel_certeza === 'hipotesis')
    .slice(-5)
    .map((evento) => ({ id: evento.id, texto: evento.texto_original }))
  const pendientes = eventos
    .filter((evento) => evento.tipo_evento === 'pendiente' || evento.tipo_evento === 'recomendacion')
    .slice(-5)
    .map((evento) => ({ id: evento.id, tipo: evento.tipo_evento, texto: evento.texto_original }))

  return {
    estado_sesion: sesion.estado,
    motivo_pausa: sesion.motivo_pausa ?? null,
    interrumpido_at: sesion.interrumpido_at ?? null,
    reanudado_at: sesion.reanudado_at ?? null,
    ultimo_evento: ultimo ? {
      id: ultimo.id,
      tipo: ultimo.tipo_evento,
      certeza: ultimo.nivel_certeza,
      texto: ultimo.texto_original,
      ocurrido_at: ultimo.ocurrido_at,
    } : null,
    hipotesis_abiertas: hipotesisAbiertas,
    pendientes,
    total_eventos: eventos.length,
  }
}

export function construirPlanSyncOTViva(
  contexto: ContextoOTParaSync,
  sesiones: SesionOTVivaLocal[],
): PlanSyncOTViva {
  return {
    version: 1,
    contexto,
    caso: {
      empresa_id: contexto.empresa_id,
      cliente_id: contexto.cliente_id,
      dominio: 'tecnico',
      tipo_caso: 'ot_terreno',
      titulo: contexto.titulo,
      descripcion_inicial: textoInicial(contexto),
      estado: 'en_ejecucion',
      origen: 'ot',
      responsable_id: contexto.usuario_id,
      datos: {
        origen_modulo: 'ot',
        ot_id: contexto.ot_id,
        sync_local_key: `ot:${contexto.ot_id}`,
      },
    },
    vinculo_ot: {
      empresa_id: contexto.empresa_id,
      ot_id: contexto.ot_id,
      rol: 'principal',
    },
    sesiones: sesiones.map((sesion) => ({
      local_session_id: sesion.id,
      sesion: {
        empresa_id: contexto.empresa_id,
        modo: 'ot_terreno',
        estado: sesion.estado,
        origen_interfaz: 'offline_sync',
        iniciado_por: contexto.usuario_id,
        finalizado_por: sesion.estado === 'finalizada' ? contexto.usuario_id : null,
        iniciado_at: sesion.iniciado_at,
        ultima_actividad_at: ultimaActividad(sesion),
        finalizado_at: sesion.finalizado_at,
        motivo_pausa: sesion.motivo_pausa ?? null,
        checkpoint: checkpointBasico(sesion),
        datos: {
          origen_modulo: 'ot',
          ot_id: contexto.ot_id,
          local_session_id: sesion.id,
          interrumpido_at: sesion.interrumpido_at ?? null,
          reanudado_at: sesion.reanudado_at ?? null,
        },
      },
      eventos: sesion.eventos.map((evento) => ({
        local_event_id: evento.id,
        evento: {
          empresa_id: contexto.empresa_id,
          tipo_evento: evento.tipo_evento,
          nivel_certeza: evento.nivel_certeza,
          autor_tipo: 'persona',
          origen_captura: 'offline_sync',
          usuario_id: contexto.usuario_id,
          texto_original: evento.texto_original,
          descripcion_normalizada: evento.descripcion_tecnica?.trim() || null,
          contexto_etiqueta: evento.componente?.trim() || null,
          prioridad: evento.prioridad ?? null,
          ocurrido_at: evento.ocurrido_at,
          visible_externo: Boolean(evento.visible_cliente),
          incluir_resumen: evento.incluir_ot !== false,
          estado: 'activo',
          estado_validacion: 'no_requiere',
          datos: {
            origen_modulo: 'ot',
            ot_id: contexto.ot_id,
            local_session_id: sesion.id,
            local_event_id: evento.id,
          },
        },
      })),
    })),
  }
}

export function sesionesPendientesSync(sesiones: SesionOTVivaLocal[]) {
  return sesiones.filter((sesion) => sesion.estado_sync !== 'sincronizada')
}

export function marcarSesionPendienteSync(sesion: SesionOTVivaLocal): SesionOTVivaLocal {
  return {
    ...sesion,
    estado_sync: 'pendiente_sync',
  }
}
