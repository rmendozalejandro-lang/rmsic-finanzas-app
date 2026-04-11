export type RolEmpresa =
  | 'admin'
  | 'gerencia'
  | 'finanzas'
  | 'cobranza'
  | 'remuneraciones'
  | 'comercial'
  | 'visualizador'
  | 'administracion_financiera'

export type ModuleKey =
  | 'dashboard'
  | 'ingresos'
  | 'egresos'
  | 'cobranza'
  | 'bancos'
  | 'reportes'
  | 'clientes'
  | 'proveedores'
  | 'transferencias'
  | 'remuneraciones'

const MODULE_ACCESS: Record<ModuleKey, RolEmpresa[]> = {
  dashboard: ['admin', 'gerencia', 'finanzas', 'cobranza', 'visualizador', 'administracion_financiera'],
  ingresos: ['admin', 'gerencia', 'finanzas', 'administracion_financiera'],
  egresos: ['admin', 'gerencia', 'finanzas', 'administracion_financiera'],
  cobranza: ['admin', 'gerencia', 'cobranza', 'administracion_financiera'],
  bancos: ['admin', 'gerencia', 'finanzas', 'administracion_financiera'],
  reportes: ['admin', 'gerencia', 'finanzas', 'administracion_financiera'],
  clientes: ['admin', 'gerencia', 'comercial', 'cobranza', 'administracion_financiera'],
  proveedores: ['admin', 'gerencia', 'finanzas', 'comercial', 'administracion_financiera'],
  transferencias: ['admin', 'gerencia', 'finanzas'],
  remuneraciones: ['admin', 'gerencia', 'remuneraciones'],
}

export function canAccessModule(role: RolEmpresa | '', moduleKey: ModuleKey) {
  if (!role) return false
  return MODULE_ACCESS[moduleKey].includes(role)
}