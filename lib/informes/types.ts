export type InformeEstado =
  | 'borrador'
  | 'en_revision'
  | 'observado'
  | 'aprobado'
  | 'emitido'
  | 'anulado'

export type InformeTecnico = {
  id: string
  empresa_id: string
  cliente_id: string
  ot_id: string | null
  codigo: string
  titulo: string
  tipo_informe: string
  subtipo_informe: string | null
  estado: InformeEstado
  fecha_informe: string
  fecha_emision: string | null
  responsable_id: string | null
  revisor_id: string | null
  version: string
  area_ubicacion: string | null
  equipo_tag: string | null
  resumen_ejecutivo: string | null
  antecedentes: string | null
  objetivo: string | null
  alcance: string | null
  metodologia: string | null
  desarrollo: string | null
  analisis_tecnico: string | null
  conclusiones: string | null
  observaciones_internas: string | null
  pdf_url: string | null
  creado_por: string | null
  actualizado_por: string | null
  created_at: string
  updated_at: string
}

export type InformeMedicion = {
  id: string
  informe_id: string
  fecha_medicion: string | null
  punto_medicion: string | null
  fase: string | null
  parametro: string
  valor: number | null
  unidad: string | null
  observacion: string | null
  orden: number
}

export type InformeHallazgo = {
  id: string
  informe_id: string
  titulo: string
  descripcion: string | null
  severidad: 'baja' | 'media' | 'alta' | 'critica' | null
  evidencia: string | null
  orden: number
}

export type InformeRecomendacion = {
  id: string
  informe_id: string
  titulo: string
  descripcion: string | null
  prioridad: 'baja' | 'media' | 'alta' | null
  plazo_sugerido: string | null
  requiere_cotizacion: boolean
  cotizacion_id: string | null
  orden: number
}