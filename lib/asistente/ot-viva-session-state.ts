export type EstadoSesionOTViva = 'en_curso' | 'pausada' | 'interrumpida' | 'finalizada'

export function etiquetaEstadoSesionOTViva(estado: EstadoSesionOTViva) {
  if (estado === 'en_curso') return 'En curso'
  if (estado === 'pausada') return 'Pausada'
  if (estado === 'interrumpida') return 'Interrumpida'
  return 'Finalizada'
}

export function claseEstadoSesionOTViva(estado: EstadoSesionOTViva) {
  if (estado === 'en_curso') return 'bg-emerald-50 text-emerald-700'
  if (estado === 'pausada') return 'bg-amber-50 text-amber-700'
  if (estado === 'interrumpida') return 'bg-orange-50 text-orange-700'
  return 'bg-slate-100 text-slate-600'
}

export function sesionOTVivaEditable(estado: EstadoSesionOTViva) {
  return estado === 'en_curso'
}

export function sesionOTVivaActiva(estado: EstadoSesionOTViva) {
  return estado !== 'finalizada'
}
