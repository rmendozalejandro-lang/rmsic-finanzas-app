export type RolEmpresa =
  | 'admin'
  | 'administracion_financiera'
  | 'cobranzas'
  | 'cobranza'
  | 'comercial'
  | 'finanzas'
  | 'gerencia'
  | 'tecnico_ot'

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
    'reportes',
    'plan_cuentas',
    'ot',
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
    'ot',
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
  ],
  cobranzas: [
    'dashboard',
    'clientes',
    'cobranza',
    'bancos',
    'reportes',
  ],
  cobranza: [
    'dashboard',
    'clientes',
    'cobranza',
    'bancos',
    'reportes',
  ],
  comercial: [
    'dashboard',
    'clientes',
    'cotizaciones',
  ],
  tecnico_ot: ['ot'],
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