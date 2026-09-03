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

export const PERMISO_ALTURA_REQUISITOS_PERSONAS = [
  'El personal debe conocer las tareas, áreas, materiales y procesos expuestos a riesgo de trabajos en altura.',
  'El personal debe conocer el Estándar de Trabajo en Altura y el procedimiento específico de la tarea.',
  'El personal debe contar con los Elementos de Protección Personal para desarrollar su actividad, de acuerdo con la condición de trabajo en altura definida en el procedimiento específico.',
  'Antes de desarrollar tareas con trabajos en altura donde puedan existir condiciones inseguras, el personal debe aplicar las acciones necesarias para controlar el riesgo de caídas.',
]

export const PERMISO_ALTURA_CHECKLIST: PTSChecklistDefinition[] = [
  { codigo: 'ALT-CHK-01', seccion: 'Listado de Chequeos Previos', pregunta: 'Se realizó análisis de seguridad antes de iniciar los trabajos AST', bloqueanteSiNo: true, permiteNA: true, orden: 1 },
  { codigo: 'ALT-CHK-02', seccion: 'Listado de Chequeos Previos', pregunta: 'Los trabajadores tienen formación e información específica sobre los riesgos y medidas preventivas', bloqueanteSiNo: true, permiteNA: true, orden: 2 },
  { codigo: 'ALT-CHK-03', seccion: 'Listado de Chequeos Previos', pregunta: 'Existe un procedimiento de trabajo específico dado a conocer a los trabajadores', bloqueanteSiNo: true, permiteNA: true, orden: 3 },
  { codigo: 'ALT-CHK-04', seccion: 'Listado de Chequeos Previos', pregunta: 'Los equipos y herramientas se encuentran revisados y en buen estado', bloqueanteSiNo: true, permiteNA: true, orden: 4 },
  { codigo: 'ALT-CHK-05', seccion: 'Listado de Chequeos Previos', pregunta: 'Se debe delimitar zona de trabajo y señalizarla', bloqueanteSiNo: true, permiteNA: true, orden: 5 },
  { codigo: 'ALT-CHK-06', seccion: 'Listado de Chequeos Previos', pregunta: 'Se dispone de arnés con dos colas de enganche y cuerda de seguridad en buen estado', bloqueanteSiNo: true, permiteNA: true, orden: 6 },
  { codigo: 'ALT-CHK-07', seccion: 'Listado de Chequeos Previos', pregunta: 'Línea de vida en buen estado y anclada a sistemas fijos, sobre la cabeza del trabajador', bloqueanteSiNo: true, permiteNA: true, orden: 7 },
  { codigo: 'ALT-CHK-08', seccion: 'Listado de Chequeos Previos', pregunta: 'Las escaleras fijas cumplen con norma de seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 8 },
  { codigo: 'ALT-CHK-09', seccion: 'Listado de Chequeos Previos', pregunta: 'Las plataformas elevadoras cumplen con normas de seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 9 },
  { codigo: 'ALT-CHK-10', seccion: 'Listado de Chequeos Previos', pregunta: 'Los equipos y herramientas se encuentran en buen estado', bloqueanteSiNo: true, permiteNA: true, orden: 10 },
  { codigo: 'ALT-CHK-11', seccion: 'Listado de Chequeos Previos', pregunta: 'Cuentan con eslinga de seguridad absorbente de caídas', bloqueanteSiNo: true, permiteNA: true, orden: 11 },
  { codigo: 'ALT-CHK-12', seccion: 'Listado de Chequeos Previos', pregunta: 'El personal cuenta con el equipo de protección personal definido para la tarea', bloqueanteSiNo: true, permiteNA: true, orden: 12 },
  { codigo: 'ALT-CHK-13', seccion: 'Listado de Chequeos Previos', pregunta: 'El personal cuenta con la capacitación necesaria sobre armado de andamios', bloqueanteSiNo: true, permiteNA: true, orden: 13 },
  { codigo: 'ALT-CHK-14', seccion: 'Listado de Chequeos Previos', pregunta: 'Existe supervisión de los trabajos', bloqueanteSiNo: true, permiteNA: true, orden: 14 },
  { codigo: 'ALT-EPP-01', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Casco con barbiquejo', bloqueanteSiNo: true, permiteNA: true, orden: 15 },
  { codigo: 'ALT-EPP-02', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Guantes de cabritilla cortos', bloqueanteSiNo: true, permiteNA: true, orden: 16 },
  { codigo: 'ALT-EPP-03', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Calzado de Seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 17 },
  { codigo: 'ALT-EPP-04', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Arnés de cuerpo entero', bloqueanteSiNo: true, permiteNA: true, orden: 18 },
  { codigo: 'ALT-EPP-05', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Antiparras de seguridad con filtro UV', bloqueanteSiNo: true, permiteNA: true, orden: 19 },
  { codigo: 'ALT-EPP-06', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Sistema de anclaje', bloqueanteSiNo: true, permiteNA: true, orden: 20 },
  { codigo: 'ALT-EPP-07', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Línea de vida vertical', bloqueanteSiNo: true, permiteNA: true, orden: 21 },
  { codigo: 'ALT-EPP-08', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Línea de vida horizontal', bloqueanteSiNo: true, permiteNA: true, orden: 22 },
]

export const PERMISO_ALTURA_EXPECTED_CODES = PERMISO_ALTURA_CHECKLIST.map((item) => item.codigo)

export const PERMISO_IZAJE_REQUISITOS_PERSONAS = [
  'El personal debe conocer las tareas, áreas, materiales y procesos a los que se encuentra expuesto al realizar maniobras de izaje.',
  'El personal debe conocer los procedimientos requeridos y métodos empleados para trabajar en maniobras de izaje, y debe existir registro de ello.',
  'El personal debe contar con los Elementos de Protección Personal definidos para la condición de trabajo y el procedimiento específico.',
]

export const PERMISO_IZAJE_CHECKLIST: PTSChecklistDefinition[] = [
  { codigo: 'IZA-CHK-01', seccion: 'Listado de Chequeos Previos', pregunta: 'Se realizó análisis de seguridad antes de iniciar los trabajos AST', bloqueanteSiNo: true, permiteNA: false, orden: 1 },
  { codigo: 'IZA-CHK-02', seccion: 'Listado de Chequeos Previos', pregunta: 'El personal conoce los procedimientos requeridos y métodos empleados para trabajar en maniobras de izaje', bloqueanteSiNo: true, permiteNA: false, orden: 2 },
  { codigo: 'IZA-CHK-03', seccion: 'Listado de Chequeos Previos', pregunta: 'Se ha delimitado y aislado el área de trabajo con conos, cinta de peligro y/o letreros de advertencia', bloqueanteSiNo: true, permiteNA: false, orden: 3 },
  { codigo: 'IZA-CHK-04', seccion: 'Listado de Chequeos Previos', pregunta: 'Se cuenta con operador de grúa certificado y autorizado para la maniobra de izaje', bloqueanteSiNo: true, permiteNA: false, orden: 4 },
  { codigo: 'IZA-CHK-05', seccion: 'Listado de Chequeos Previos', pregunta: 'Se cuenta con rigger calificado y autorizado para la maniobra', bloqueanteSiNo: true, permiteNA: false, orden: 5 },
  { codigo: 'IZA-CHK-06', seccion: 'Listado de Chequeos Previos', pregunta: 'El operador cuenta con joystick para realizar la maniobra', bloqueanteSiNo: true, permiteNA: true, orden: 6 },
  { codigo: 'IZA-CHK-07', seccion: 'Listado de Chequeos Previos', pregunta: 'Se verificó que la carga a izar es menor a la capacidad de carga de la grúa', bloqueanteSiNo: true, permiteNA: false, orden: 7 },
  { codigo: 'IZA-CHK-08', seccion: 'Listado de Chequeos Previos', pregunta: 'Se verificó que no exista personal ajeno a la maniobra en el área de trabajo', bloqueanteSiNo: true, permiteNA: false, orden: 8 },
  { codigo: 'IZA-CHK-09', seccion: 'Listado de Chequeos Previos', pregunta: 'Se han inspeccionado las condiciones operativas antes de iniciar los trabajos', bloqueanteSiNo: true, permiteNA: false, orden: 9 },
  { codigo: 'IZA-CHK-10', seccion: 'Listado de Chequeos Previos', pregunta: 'Se verificó que no existan líneas energizadas cercanas al lugar de trabajo', bloqueanteSiNo: true, permiteNA: false, orden: 10 },
  { codigo: 'IZA-CHK-11', seccion: 'Listado de Chequeos Previos', pregunta: 'Se muestra la capacidad máxima de los equipos, sistemas y accesorios de izaje', bloqueanteSiNo: true, permiteNA: false, orden: 11 },
  { codigo: 'IZA-CHK-12', seccion: 'Listado de Chequeos Previos', pregunta: 'La alarma de retroceso se encuentra conectada y funcionando', bloqueanteSiNo: true, permiteNA: true, orden: 12 },
  { codigo: 'IZA-CHK-13', seccion: 'Listado de Chequeos Previos', pregunta: 'Se utilizan almohadillas para el uso de estabilizadores', bloqueanteSiNo: true, permiteNA: true, orden: 13 },
]

export const PERMISO_IZAJE_EXPECTED_CODES = PERMISO_IZAJE_CHECKLIST.map((item) => item.codigo)
