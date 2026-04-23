export type OTPrioridad = 'baja' | 'media' | 'alta' | 'critica'

export type OTResumen = {
  id: string
  empresa_id: string
  empresa_nombre: string | null
  cliente_id: string
  cliente_nombre: string | null
  folio: string
  fecha_ot: string
  fecha_programada: string | null
  fecha_cierre: string | null
  titulo: string
  prioridad: OTPrioridad
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  tecnico_responsable_id: string | null
  tecnico_nombre: string | null
  ubicacion_nombre: string | null
  activo_nombre: string | null
  tipo_servicio_nombre: string | null
  estado_nombre: string | null
  requiere_checklist: boolean
  created_at: string
  updated_at: string
}