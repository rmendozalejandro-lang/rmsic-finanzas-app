import type { PTSChecklistDefinition } from './checklists'

export const PERMISO_CALIENTE_TIPOS = [
  { codigo: 'soldadura', nombre: 'Soldadura' },
  { codigo: 'corte', nombre: 'Corte' },
  { codigo: 'esmerilado', nombre: 'Esmerilado' },
  { codigo: 'oxicorte', nombre: 'Oxicorte' },
  { codigo: 'otro', nombre: 'Otro' },
] as const

export const PERMISO_CALIENTE_CHECKLIST: PTSChecklistDefinition[] = [
  { codigo: 'CAL-CHK-01', seccion: 'Exigencias generales de seguridad', pregunta: 'Se verificará en terreno que no existan focos de posibles incendios al finalizar la labor', bloqueanteSiNo: true, permiteNA: false, orden: 1 },
  { codigo: 'CAL-CHK-02', seccion: 'Exigencias generales de seguridad', pregunta: 'El personal sabe que en caso de lluvia o fuerza mayor el permiso se cierra de forma inmediata', bloqueanteSiNo: true, permiteNA: false, orden: 2 },
  { codigo: 'CAL-CHK-03', seccion: 'Exigencias generales de seguridad', pregunta: 'Se cuenta con un extintor ABC de 10 kg o más disponible en caso de incendio', bloqueanteSiNo: true, permiteNA: false, orden: 3 },
  { codigo: 'CAL-CHK-04', seccion: 'Exigencias generales de seguridad', pregunta: 'Los sistemas contra incendio del área se encuentran operativos', bloqueanteSiNo: true, permiteNA: true, orden: 4 },
  { codigo: 'CAL-CHK-05', seccion: 'Exigencias generales de seguridad', pregunta: 'Los permisos complementarios requeridos fueron verificados', bloqueanteSiNo: true, permiteNA: true, orden: 5 },
  { codigo: 'CAL-CHK-06', seccion: 'Exigencias generales de seguridad', pregunta: 'La persona que emite el permiso verificó en terreno todas las condiciones de seguridad exigidas', bloqueanteSiNo: true, permiteNA: false, orden: 6 },
  { codigo: 'CAL-CHK-07', seccion: 'Condiciones generales del equipo', pregunta: 'Los equipos a utilizar para el trabajo en caliente se encuentran en buen estado', bloqueanteSiNo: true, permiteNA: false, orden: 7 },
  { codigo: 'CAL-CHK-08', seccion: 'Condiciones generales del equipo', pregunta: 'Los equipos que se utilizarán cuentan con sus listas de chequeo al día', bloqueanteSiNo: true, permiteNA: true, orden: 8 },
  { codigo: 'CAL-CHK-09', seccion: 'Condiciones generales del equipo', pregunta: 'El operario utiliza los EPP definidos para realizar el trabajo', bloqueanteSiNo: true, permiteNA: false, orden: 9 },
  { codigo: 'CAL-CHK-10', seccion: 'Condiciones generales del equipo', pregunta: 'La ropa se encuentra libre de aceites, grasa, solventes u otro material combustible o inflamable', bloqueanteSiNo: true, permiteNA: false, orden: 10 },
  { codigo: 'CAL-CHK-11', seccion: 'Condiciones generales del equipo', pregunta: 'Cuando existe soldadura, las bastillas de los pantalones se mantienen dentro de los zapatos de seguridad', bloqueanteSiNo: true, permiteNA: true, orden: 11 },
  { codigo: 'CAL-CHK-12', seccion: 'Seguridad en el área de trabajo', pregunta: 'Las aberturas, ductos y drenajes se encuentran protegidos o sellados', bloqueanteSiNo: true, permiteNA: true, orden: 12 },
  { codigo: 'CAL-CHK-13', seccion: 'Seguridad en el área de trabajo', pregunta: 'Los equipos y sistemas cercanos se encuentran protegidos con mantas ignífugas cuando corresponde', bloqueanteSiNo: true, permiteNA: true, orden: 13 },
  { codigo: 'CAL-CHK-14', seccion: 'Seguridad en el área de trabajo', pregunta: 'Se identificaron los procedimientos de emergencia aplicables', bloqueanteSiNo: true, permiteNA: false, orden: 14 },
  { codigo: 'CAL-CHK-15', seccion: 'Seguridad en el área de trabajo', pregunta: 'Se tomaron las precauciones necesarias para evitar interferencias con otros trabajos peligrosos', bloqueanteSiNo: true, permiteNA: false, orden: 15 },
  { codigo: 'CAL-CHK-16', seccion: 'Seguridad en el área de trabajo', pregunta: 'Los tableros, cables y extensiones eléctricas se encuentran protegidos para evitar daños', bloqueanteSiNo: true, permiteNA: true, orden: 16 },
  { codigo: 'CAL-CHK-17', seccion: 'Seguridad en el área de trabajo', pregunta: 'El área fue inspeccionada en terreno para verificar los riesgos potenciales identificados en la planificación', bloqueanteSiNo: true, permiteNA: false, orden: 17 },
  { codigo: 'CAL-CHK-18', seccion: 'Seguridad en el área de trabajo', pregunta: 'Se verificó que no exista material combustible sin controlar en áreas cercanas al trabajo en caliente', bloqueanteSiNo: true, permiteNA: false, orden: 18 },
  { codigo: 'CAL-CHK-19', seccion: 'Seguridad en el área de trabajo', pregunta: 'El área se encuentra libre de materiales combustibles en un radio de al menos 15 m o estos se encuentran debidamente protegidos', bloqueanteSiNo: true, permiteNA: false, orden: 19 },
  { codigo: 'CAL-CHK-20', seccion: 'Competencias y autorización', pregunta: 'Los trabajadores involucrados se encuentran capacitados para el trabajo en caliente', bloqueanteSiNo: true, permiteNA: false, orden: 20 },
  { codigo: 'CAL-EPP-01', seccion: 'Elementos de protección personal', pregunta: 'Traje de cuero completo', bloqueanteSiNo: true, permiteNA: true, orden: 21 },
  { codigo: 'CAL-EPP-02', seccion: 'Elementos de protección personal', pregunta: 'Guantes de cabritilla', bloqueanteSiNo: true, permiteNA: true, orden: 22 },
  { codigo: 'CAL-EPP-03', seccion: 'Elementos de protección personal', pregunta: 'Gafas para soldadura u oxicorte', bloqueanteSiNo: true, permiteNA: true, orden: 23 },
  { codigo: 'CAL-EPP-04', seccion: 'Elementos de protección personal', pregunta: 'Gafas transparentes con sello', bloqueanteSiNo: true, permiteNA: true, orden: 24 },
  { codigo: 'CAL-EPP-05', seccion: 'Elementos de protección personal', pregunta: 'Careta facial', bloqueanteSiNo: true, permiteNA: true, orden: 25 },
  { codigo: 'CAL-EPP-06', seccion: 'Elementos de protección personal', pregunta: 'Máscara de soldar', bloqueanteSiNo: true, permiteNA: true, orden: 26 },
  { codigo: 'CAL-EPP-07', seccion: 'Elementos de protección personal', pregunta: 'Lentes de soldar', bloqueanteSiNo: true, permiteNA: true, orden: 27 },
  { codigo: 'CAL-EPP-08', seccion: 'Elementos de protección personal', pregunta: 'Guantes largos de soldador', bloqueanteSiNo: true, permiteNA: true, orden: 28 },
]

export const PERMISO_CALIENTE_EXPECTED_CODES = PERMISO_CALIENTE_CHECKLIST.map((item) => item.codigo)

export const PERMISO_CALIENTE_NA_ALLOWED_CODES = PERMISO_CALIENTE_CHECKLIST
  .filter((item) => item.permiteNA)
  .map((item) => item.codigo)

export const VIGILANCIA_POST_CHECKLIST = [
  { codigo: 'VIG-CAL-01', pregunta: 'No se detectan brasas, chispas o material incandescente' },
  { codigo: 'VIG-CAL-02', pregunta: 'No existe aumento de temperatura anormal' },
  { codigo: 'VIG-CAL-03', pregunta: 'No se perciben olores a quemado' },
  { codigo: 'VIG-CAL-04', pregunta: 'El área se mantiene segura y controlada' },
] as const
