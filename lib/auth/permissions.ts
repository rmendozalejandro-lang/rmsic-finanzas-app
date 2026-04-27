export type RolEmpresa =
  | 'admin'
  | 'administracion_financiera'
  | 'cobranzas'
  | 'cobranza'
  | 'comercial'
  | 'finanzas'
  | 'gerencia'
  | 'tecnico_ot'

export type ModuloPrincipal =
  | 'comercial'
  | 'financiero'
  | 'contable'
  | 'operacional'
  | 'rrhh'
  | 'administracion'

export type ModuleKey =
  | 'dashboard'
  | 'clientes'
  | 'proveedores'
  | 'cotizaciones'
  | 'ingresos'
  | 'egresos'
  | 'cobranza'
  | 'bancos'
  | 'transferencias'
  | 'remuneraciones'
  | 'reportes'
  | 'plan_cuentas'
  | 'ot'
  | 'configuracion_usuarios'
  | 'configuracion_auditoria'

export const MODULOS_PRINCIPALES: ModuloPrincipal[] = [
  'comercial',
  'financiero',
  'contable',
  'operacional',
  'rrhh',
  'administracion',
]

export const MODULO_PRINCIPAL_LABELS: Record<ModuloPrincipal, string> = {
  comercial: 'Comercial',
  financiero: 'Financiero',
  contable: 'Contable',
  operacional: 'Operacional',
  rrhh: 'Recursos Humanos',
  administracion: 'Administración',
}

/**
 * Relación entre submódulos/rutas actuales y módulos principales.
 *
 * Importante:
 * - dashboard queda sin módulo principal porque debe funcionar como entrada general.
 * - reportes queda asociado a contable por ahora.
 * - OT queda asociado a operacional.
 */
const MODULE_TO_PRINCIPAL: Record<ModuleKey, ModuloPrincipal | null> = {
  dashboard: null,

  clientes: 'comercial',
  cotizaciones: 'comercial',
  ingresos: 'comercial',
  cobranza: 'comercial',

  proveedores: 'financiero',
  egresos: 'financiero',
  bancos: 'financiero',
  transferencias: 'financiero',

  plan_cuentas: 'contable',
  reportes: 'contable',

  ot: 'operacional',

  remuneraciones: 'rrhh',

  configuracion_usuarios: 'administracion',
  configuracion_auditoria: 'administracion',
}

/**
 * Permisos por rol dentro de una empresa.
 *
 * Importante:
 * - super_admin no se controla aquí.
 * - super_admin se valida con roles_sistema/es_super_admin().
 * - Estos permisos aplican a usuario_empresas.rol.
 * - tecnico_ot queda limitado exclusivamente al módulo OT.
 * - cobranzas/cobranza queda limitado a cobranza y módulos relacionados.
 */
const ROLE_MODULES: Record<RolEmpresa, ModuleKey[]> = {
  admin: [
    'dashboard',
    'clientes',
    'proveedores',
    'cotizaciones',
    'ingresos',
    'egresos',
    'cobranza',
    'bancos',
    'transferencias',
    'remuneraciones',
    'reportes',
    'plan_cuentas',
    'ot',
    'configuracion_usuarios',
    'configuracion_auditoria',
  ],

  administracion_financiera: [
    'dashboard',
    'clientes',
    'proveedores',
    'cotizaciones',
    'ingresos',
    'egresos',
    'cobranza',
    'bancos',
    'transferencias',
    'remuneraciones',
    'reportes',
    'plan_cuentas',
  ],

  finanzas: [
    'dashboard',
    'clientes',
    'proveedores',
    'cotizaciones',
    'ingresos',
    'egresos',
    'cobranza',
    'bancos',
    'reportes',
    'plan_cuentas',
  ],

  gerencia: [
    'dashboard',
    'clientes',
    'proveedores',
    'cotizaciones',
    'ingresos',
    'egresos',
    'cobranza',
    'bancos',
    'transferencias',
    'remuneraciones',
    'reportes',
    'plan_cuentas',
    'ot',
    'configuracion_usuarios',
    'configuracion_auditoria',
  ],

  cobranzas: [
    'dashboard',
    'clientes',
    'ingresos',
    'cobranza',
    'reportes',
  ],

  cobranza: [
    'dashboard',
    'clientes',
    'ingresos',
    'cobranza',
    'reportes',
  ],

  comercial: [
    'dashboard',
    'clientes',
    'cotizaciones',
  ],

  tecnico_ot: ['ot'],
}

export function getModuloPrincipal(
  moduleKey: ModuleKey
): ModuloPrincipal | null {
  return MODULE_TO_PRINCIPAL[moduleKey]
}

export function canAccessModule(
  rol: RolEmpresa | string | null | undefined,
  moduleKey: ModuleKey
) {
  if (!rol) return false

  const normalizedRol = rol as RolEmpresa
  const allowedModules = ROLE_MODULES[normalizedRol]

  if (!allowedModules) return false

  return allowedModules.includes(moduleKey)
}

export function getModulesForRole(
  rol: RolEmpresa | string | null | undefined
): ModuleKey[] {
  if (!rol) return []

  const normalizedRol = rol as RolEmpresa
  return ROLE_MODULES[normalizedRol] ?? []
}

export function isEmpresaModuloHabilitado(
  moduleKey: ModuleKey,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  const moduloPrincipal = getModuloPrincipal(moduleKey)

  if (!moduloPrincipal) return true
  if (!modulosHabilitados?.length) return false

  return modulosHabilitados.includes(moduloPrincipal)
}

export function canAccessModuleByRoleAndCompany(
  rol: RolEmpresa | string | null | undefined,
  moduleKey: ModuleKey,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  return (
    canAccessModule(rol, moduleKey) &&
    isEmpresaModuloHabilitado(moduleKey, modulosHabilitados)
  )
}
