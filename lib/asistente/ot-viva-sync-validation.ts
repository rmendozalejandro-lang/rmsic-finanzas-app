import type { PlanSyncOTViva } from '@/lib/asistente/ot-viva-sync'

export type ErrorValidacionSync = {
  codigo: string
  mensaje: string
  referencia?: string
}

export type ResultadoValidacionSync = {
  valido: boolean
  errores: ErrorValidacionSync[]
  advertencias: ErrorValidacionSync[]
}

const CERTEZAS = new Set([
  'informado', 'observado', 'medido', 'hipotesis', 'propuesto', 'confirmado', 'descartado',
])

const ESTADOS_SESION = new Set(['en_curso', 'pausada', 'interrumpida', 'finalizada', 'cancelada'])

const RELACIONES = new Set([
  'origina', 'sustenta', 'confirma', 'descarta', 'contradice', 'resultado_de',
  'causa_de', 'recomendacion_de', 'decision_sobre', 'seguimiento_de', 'valida',
  'relacionado_con', 'otro',
])

function fechaValida(value: string | null | undefined) {
  if (!value) return false
  return !Number.isNaN(new Date(value).getTime())
}

export function validarPlanSyncOTViva(plan: PlanSyncOTViva): ResultadoValidacionSync {
  const errores: ErrorValidacionSync[] = []
  const advertencias: ErrorValidacionSync[] = []

  if (plan.version !== 1) {
    errores.push({ codigo: 'VERSION', mensaje: `Versión de plan no soportada: ${plan.version}.` })
  }

  if (!plan.contexto.empresa_id || !plan.contexto.ot_id || !plan.contexto.usuario_id) {
    errores.push({ codigo: 'CONTEXTO', mensaje: 'Falta empresa, OT o usuario en el contexto de sincronización.' })
  }

  if (!plan.caso.titulo.trim()) {
    errores.push({ codigo: 'CASO_TITULO', mensaje: 'El caso no tiene título.' })
  }

  if (plan.caso.estado !== 'en_ejecucion') {
    errores.push({ codigo: 'CASO_ESTADO', mensaje: `Estado de caso no esperado: ${plan.caso.estado}.` })
  }

  const eventIds = new Set<string>()

  for (const sesionPlan of plan.sesiones) {
    const sesion = sesionPlan.sesion
    if (!ESTADOS_SESION.has(sesion.estado)) {
      errores.push({ codigo: 'SESION_ESTADO', mensaje: `Estado de sesión no permitido: ${sesion.estado}.`, referencia: sesionPlan.local_session_id })
    }
    if (!fechaValida(sesion.iniciado_at) || !fechaValida(sesion.ultima_actividad_at)) {
      errores.push({ codigo: 'SESION_FECHA', mensaje: 'La sesión contiene fechas inválidas.', referencia: sesionPlan.local_session_id })
    }
    if (sesion.finalizado_at && !fechaValida(sesion.finalizado_at)) {
      errores.push({ codigo: 'SESION_FECHA_FIN', mensaje: 'La fecha de término de la sesión no es válida.', referencia: sesionPlan.local_session_id })
    }
    if (sesion.estado === 'finalizada' && !sesion.finalizado_at) {
      errores.push({ codigo: 'SESION_FINALIZADA_SIN_FECHA', mensaje: 'Una sesión finalizada debe tener fecha de término.', referencia: sesionPlan.local_session_id })
    }

    for (const eventoPlan of sesionPlan.eventos) {
      const evento = eventoPlan.evento
      if (eventIds.has(eventoPlan.local_event_id)) {
        errores.push({ codigo: 'EVENTO_DUPLICADO', mensaje: 'Existe un identificador local de evento duplicado.', referencia: eventoPlan.local_event_id })
      }
      eventIds.add(eventoPlan.local_event_id)

      if (!evento.tipo_evento.trim()) {
        errores.push({ codigo: 'EVENTO_TIPO', mensaje: 'Existe un evento sin tipo.', referencia: eventoPlan.local_event_id })
      }
      if (!CERTEZAS.has(evento.nivel_certeza)) {
        errores.push({ codigo: 'EVENTO_CERTEZA', mensaje: `Nivel de certeza no permitido: ${evento.nivel_certeza}.`, referencia: eventoPlan.local_event_id })
      }
      if (!evento.texto_original.trim()) {
        errores.push({ codigo: 'EVENTO_TEXTO', mensaje: 'Existe un evento sin texto original.', referencia: eventoPlan.local_event_id })
      }
      if (!fechaValida(evento.ocurrido_at)) {
        errores.push({ codigo: 'EVENTO_FECHA', mensaje: 'Existe un evento con fecha inválida.', referencia: eventoPlan.local_event_id })
      }
      if (evento.tipo_evento === 'hipotesis' && evento.nivel_certeza !== 'hipotesis') {
        errores.push({ codigo: 'HIPOTESIS_CERTEZA', mensaje: 'Una hipótesis debe registrarse con certeza HIPÓTESIS.', referencia: eventoPlan.local_event_id })
      }
      if (evento.tipo_evento === 'medicion' && evento.nivel_certeza !== 'medido') {
        errores.push({ codigo: 'MEDICION_CERTEZA', mensaje: 'Una medición debe registrarse con certeza MEDIDO.', referencia: eventoPlan.local_event_id })
      }
      if (evento.tipo_evento === 'decision_cliente' && evento.nivel_certeza !== 'informado') {
        errores.push({ codigo: 'DECISION_CERTEZA', mensaje: 'Una decisión de cliente debe registrarse con certeza INFORMADO.', referencia: eventoPlan.local_event_id })
      }
    }
  }

  for (const relacionPlan of plan.relaciones ?? []) {
    if (!RELACIONES.has(relacionPlan.relacion.tipo_relacion)) {
      errores.push({ codigo: 'RELACION_TIPO', mensaje: `Tipo de relación no permitido: ${relacionPlan.relacion.tipo_relacion}.`, referencia: relacionPlan.local_relation_id })
    }
    if (relacionPlan.local_source_event_id === relacionPlan.local_target_event_id) {
      errores.push({ codigo: 'RELACION_AUTORREFERENCIA', mensaje: 'Una relación no puede apuntar al mismo evento.', referencia: relacionPlan.local_relation_id })
    }
    if (!eventIds.has(relacionPlan.local_source_event_id) || !eventIds.has(relacionPlan.local_target_event_id)) {
      errores.push({ codigo: 'RELACION_EVENTO_FALTANTE', mensaje: 'La relación referencia un evento que no está incluido en el plan.', referencia: relacionPlan.local_relation_id })
    }
  }

  if (plan.sesiones.length === 0) {
    advertencias.push({ codigo: 'SIN_SESIONES', mensaje: 'El plan no contiene sesiones para sincronizar.' })
  }

  const totalEventos = plan.sesiones.reduce((total, sesion) => total + sesion.eventos.length, 0)
  if (totalEventos === 0) {
    advertencias.push({ codigo: 'SIN_EVENTOS', mensaje: 'El plan no contiene eventos técnicos.' })
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}
