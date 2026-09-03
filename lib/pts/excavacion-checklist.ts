import type { PTSChecklistDefinition } from './checklists'

export const PERMISO_EXCAVACION_REQUISITOS_PERSONAS = [
  'El personal debe conocer las tareas, áreas, materiales y procesos expuestos a riesgo de trabajos en excavaciones.',
  'El personal debe conocer el Estándar de Trabajo en Excavaciones y el procedimiento específico de la tarea.',
  'El personal debe contar con los Elementos de Protección Personal definidos para la condición de trabajo en excavaciones.',
  'Antes de ingresar o desarrollar tareas en excavaciones donde puedan existir condiciones inseguras, el personal debe aplicar las acciones necesarias para controlar el riesgo de derrumbes.',
]

export const PERMISO_EXCAVACION_CHECKLIST: PTSChecklistDefinition[] = [
  { codigo: 'EXC-CHK-01', seccion: 'Listado de Chequeos Previos', pregunta: 'Se realizó análisis de seguridad antes de iniciar los trabajos AST', bloqueanteSiNo: true, permiteNA: false, orden: 1 },
  { codigo: 'EXC-CHK-02', seccion: 'Listado de Chequeos Previos', pregunta: 'El personal conoce los procedimientos requeridos y métodos empleados para trabajar en excavaciones, zanjas, hoyos, pilas u otros trabajos equivalentes', bloqueanteSiNo: true, permiteNA: false, orden: 2 },
  { codigo: 'EXC-CHK-03', seccion: 'Listado de Chequeos Previos', pregunta: 'Se cuenta con la debida delimitación y señalización del área de trabajo', bloqueanteSiNo: true, permiteNA: false, orden: 3 },
  { codigo: 'EXC-CHK-04', seccion: 'Listado de Chequeos Previos', pregunta: 'Los accesos y salidas se encuentran en buenas condiciones de uso y ubicación', bloqueanteSiNo: true, permiteNA: false, orden: 4 },
  { codigo: 'EXC-CHK-05', seccion: 'Listado de Chequeos Previos', pregunta: 'Están dispuestos los elementos de rescate requeridos en caso de emergencia', bloqueanteSiNo: true, permiteNA: false, orden: 5 },
  { codigo: 'EXC-CHK-06', seccion: 'Listado de Chequeos Previos', pregunta: 'Antes de iniciar la excavación se verificó por dónde pasan instalaciones eléctricas, agua, gas y líneas de alcantarillado', bloqueanteSiNo: true, permiteNA: false, orden: 6 },
  { codigo: 'EXC-CHK-07', seccion: 'Listado de Chequeos Previos', pregunta: 'Se cuenta con los elementos y materiales necesarios para realizar entibados o apuntalamientos y controlar el riesgo de derrumbe', bloqueanteSiNo: true, permiteNA: false, orden: 7 },
  { codigo: 'EXC-CHK-08', seccion: 'Listado de Chequeos Previos', pregunta: 'Los operadores de máquinas para los trabajos de excavación cuentan con licencia de operador apropiada al equipo', bloqueanteSiNo: true, permiteNA: true, orden: 8 },
  { codigo: 'EXC-CHK-09', seccion: 'Listado de Chequeos Previos', pregunta: 'Se utilizan detectores de metales, equipos energizados, gas u otras sustancias peligrosas antes de realizar la excavación cuando corresponde', bloqueanteSiNo: true, permiteNA: true, orden: 9 },
  { codigo: 'EXC-CHK-10', seccion: 'Listado de Chequeos Previos', pregunta: 'Existe un observador de seguridad o vigía en los accesos de la excavación que registre el ingreso y salida de los trabajadores', bloqueanteSiNo: true, permiteNA: false, orden: 10 },
  { codigo: 'EXC-CHK-11', seccion: 'Listado de Chequeos Previos', pregunta: 'El material de la excavación se deposita a una distancia mayor o igual a la mitad de la profundidad de la excavación', bloqueanteSiNo: true, permiteNA: false, orden: 11 },
  { codigo: 'EXC-CHK-12', seccion: 'Listado de Chequeos Previos', pregunta: 'Las bocinas y alarmas de retroceso de la maquinaria se encuentran en buen funcionamiento', bloqueanteSiNo: true, permiteNA: true, orden: 12 },
  { codigo: 'EXC-CHK-13', seccion: 'Listado de Chequeos Previos', pregunta: 'Las cabinas de las máquinas son cerradas herméticamente y cuentan con vidrio inastillable', bloqueanteSiNo: true, permiteNA: true, orden: 13 },
  { codigo: 'EXC-CHK-14', seccion: 'Listado de Chequeos Previos', pregunta: 'Al ascender o descender de la máquina se utilizan los tres puntos de apoyo', bloqueanteSiNo: true, permiteNA: true, orden: 14 },
  { codigo: 'EXC-EPP-01', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Casco con barbiquejo', bloqueanteSiNo: true, permiteNA: false, orden: 15 },
  { codigo: 'EXC-EPP-02', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Guantes de cabritilla cortos', bloqueanteSiNo: true, permiteNA: false, orden: 16 },
  { codigo: 'EXC-EPP-03', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Calzado de Seguridad', bloqueanteSiNo: true, permiteNA: false, orden: 17 },
  { codigo: 'EXC-EPP-04', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Arnés de cuerpo entero', bloqueanteSiNo: true, permiteNA: true, orden: 18 },
  { codigo: 'EXC-EPP-05', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Antiparras de seguridad con filtro UV', bloqueanteSiNo: true, permiteNA: false, orden: 19 },
  { codigo: 'EXC-EPP-06', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Sistema de anclaje', bloqueanteSiNo: true, permiteNA: true, orden: 20 },
  { codigo: 'EXC-EPP-07', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Línea de vida vertical', bloqueanteSiNo: true, permiteNA: true, orden: 21 },
  { codigo: 'EXC-EPP-08', seccion: 'Elementos de Protección Personal y Sistema de Protección Contra Caídas', pregunta: 'Línea de vida horizontal', bloqueanteSiNo: true, permiteNA: true, orden: 22 },
]

export const PERMISO_EXCAVACION_EXPECTED_CODES = PERMISO_EXCAVACION_CHECKLIST.map((item) => item.codigo)
