export type PTSChecklistDefinition = {
  codigo: string
  seccion: string
  pregunta: string
  bloqueanteSiNo: boolean
  permiteNA: boolean
  orden: number
}

export const PERMISO_GENERAL_REQUISITOS_PERSONAS = [
  'El personal debe conocer las tareas, áreas, materiales y procesos a los que se encuentra expuesto al realizar las tareas.',
  'El personal debe conocer los procedimientos de cada proceso y debe existir un registro de ello.',
  'El personal debe contar con los Elementos de Protección Personal para desarrollar su actividad, de acuerdo con la condición de trabajo definida en el procedimiento específico.',
]

export const PERMISO_GENERAL_CHECKLIST: PTSChecklistDefinition[] = [
  { codigo: 'GEN-EPP-01', seccion: 'Elementos de Protección Personal', pregunta: 'Casco de Seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 1 },
  { codigo: 'GEN-EPP-02', seccion: 'Elementos de Protección Personal', pregunta: 'Guantes de Seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 2 },
  { codigo: 'GEN-EPP-03', seccion: 'Elementos de Protección Personal', pregunta: 'Lentes de Seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 3 },
  { codigo: 'GEN-EPP-04', seccion: 'Elementos de Protección Personal', pregunta: 'Ropa de Soldador', bloqueanteSiNo: true, permiteNA: true, orden: 4 },
  { codigo: 'GEN-EPP-05', seccion: 'Elementos de Protección Personal', pregunta: 'Zapatos de Seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 5 },
  { codigo: 'GEN-EPP-06', seccion: 'Elementos de Protección Personal', pregunta: 'Careta Facial', bloqueanteSiNo: true, permiteNA: true, orden: 6 },
  { codigo: 'GEN-EPP-07', seccion: 'Elementos de Protección Personal', pregunta: 'Máscara de Soldar', bloqueanteSiNo: true, permiteNA: true, orden: 7 },
  { codigo: 'GEN-EPP-08', seccion: 'Elementos de Protección Personal', pregunta: 'Bota de PVC', bloqueanteSiNo: true, permiteNA: true, orden: 8 },
  { codigo: 'GEN-EPP-09', seccion: 'Elementos de Protección Personal', pregunta: 'Otros', bloqueanteSiNo: true, permiteNA: true, orden: 9 },
  { codigo: 'GEN-CHK-01', seccion: 'Listado de Chequeos Previos', pregunta: 'Bloquear equipos o sistemas', bloqueanteSiNo: true, permiteNA: true, orden: 10 },
  { codigo: 'GEN-CHK-02', seccion: 'Listado de Chequeos Previos', pregunta: 'Limpiar equipos o sistemas', bloqueanteSiNo: true, permiteNA: true, orden: 11 },
  { codigo: 'GEN-CHK-03', seccion: 'Listado de Chequeos Previos', pregunta: 'Retirar o aislar material combustible', bloqueanteSiNo: true, permiteNA: true, orden: 12 },
  { codigo: 'GEN-CHK-04', seccion: 'Listado de Chequeos Previos', pregunta: 'Proteger de llamas o chispas', bloqueanteSiNo: true, permiteNA: true, orden: 13 },
  { codigo: 'GEN-CHK-05', seccion: 'Listado de Chequeos Previos', pregunta: 'Ventilar durante el trabajo', bloqueanteSiNo: true, permiteNA: true, orden: 14 },
  { codigo: 'GEN-CHK-06', seccion: 'Listado de Chequeos Previos', pregunta: 'Restringir acceso o área', bloqueanteSiNo: true, permiteNA: true, orden: 15 },
  { codigo: 'GEN-CHK-07', seccion: 'Listado de Chequeos Previos', pregunta: 'Demarcar el área', bloqueanteSiNo: true, permiteNA: true, orden: 16 },
  { codigo: 'GEN-CHK-08', seccion: 'Listado de Chequeos Previos', pregunta: 'Instalar letrero de advertencia', bloqueanteSiNo: true, permiteNA: true, orden: 17 },
  { codigo: 'GEN-CHK-09', seccion: 'Listado de Chequeos Previos', pregunta: 'Instalar biombos', bloqueanteSiNo: true, permiteNA: true, orden: 18 },
  { codigo: 'GEN-CHK-10', seccion: 'Listado de Chequeos Previos', pregunta: 'Mojar el área', bloqueanteSiNo: true, permiteNA: true, orden: 19 },
  { codigo: 'GEN-CHK-11', seccion: 'Listado de Chequeos Previos', pregunta: 'Uso de extintor tipo', bloqueanteSiNo: true, permiteNA: true, orden: 20 },
  { codigo: 'GEN-CHK-12', seccion: 'Listado de Chequeos Previos', pregunta: 'Uso de cinturón de seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 21 },
  { codigo: 'GEN-CHK-13', seccion: 'Listado de Chequeos Previos', pregunta: 'Protección contra riesgos químicos', bloqueanteSiNo: true, permiteNA: true, orden: 22 },
  { codigo: 'GEN-CHK-14', seccion: 'Listado de Chequeos Previos', pregunta: 'Trabajo con equipo energizado', bloqueanteSiNo: true, permiteNA: true, orden: 23 },
  { codigo: 'GEN-CHK-15', seccion: 'Listado de Chequeos Previos', pregunta: 'Otros', bloqueanteSiNo: true, permiteNA: true, orden: 24 },
]

export const PERMISO_GENERAL_EXPECTED_CODES = PERMISO_GENERAL_CHECKLIST.map((item) => item.codigo)
