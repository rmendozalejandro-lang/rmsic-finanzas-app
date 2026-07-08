export function hasText(value?: string | null) {
  return Boolean(value && value.trim().length > 0)
}

export function hasItems<T>(items?: T[] | null) {
  return Array.isArray(items) && items.length > 0
}

export function estadoInformeLabel(estado: string) {
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    en_revision: 'En revisión',
    observado: 'Observado',
    aprobado: 'Aprobado',
    emitido: 'Emitido',
    anulado: 'Anulado',
  }

  return labels[estado] ?? estado
}

export function tipoInformeLabel(tipo: string) {
  const labels: Record<string, string> = {
    levantamiento_tecnico: 'Levantamiento técnico',
    mediciones: 'Informe de mediciones',
    mantenimiento: 'Informe de mantenimiento',
    falla: 'Informe de falla',
    consultoria: 'Informe de consultoría',
    avance: 'Informe de avance',
    inspeccion: 'Informe de inspección',
    mejora_propuesta: 'Informe de mejora propuesta',
  }

  return labels[tipo] ?? tipo
}