export type RolEmpresa =
  | 'admin'
  | 'administracion_financiera'
  | 'cobranzas'
  | 'cobranza'
  | 'comercial'
  | 'finanzas'
  | 'gerencia'
  | 'tecnico_ot'
  | 'demo_cliente'
  | 'seguridad_pts'

export type ModuloPrincipal =
  | 'comercial'
  | 'financiero'
  | 'contable'
  | 'operacional'
  | 'rrhh'
  | 'administracion'
  | 'haras'
  | 'seguridad'

export type ModuleKey =
  | 'dashboard'
  | 'clientes'
  | 'proveedores'
  | 'contactos'
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
  | 'haras'
  | 'pts'

/**
 * Recursos maestros/transversales.
 *
 * Importante:
 * - No son módulos comerciales por sí mismos.
 * - Son datos base de empresa reutilizables por distintos módulos.
 * - Ejemplo: clientes puede ser usado por OT, cotizaciones, financiero y contable.
 */
export type RecursoTransversal =
  | 'clientes'
  | 'proveedores'
  | 'contactos'

export type AccionRecurso =
  | 'ver'
  | 'crear'
  | 'editar'
  | 'administrar'

/**
 * Nombres estables para permisos de registros centrales.
 *
 * Se mantienen separados de AccionRecurso para conservar la compatibilidad con
 * las comprobaciones actuales basadas en recurso + acción.
 */
export const PERMISOS_RECURSOS = {
  clientes: {
    ver: 'ver_clientes',
    crear: 'crear_clientes',
    editar: 'editar_clientes',
  },
  proveedores: {
    ver: 'ver_proveedores',
    crear: 'crear_proveedores',
    editar: 'editar_proveedores',
  },
  contactos: {
    ver: 'ver_contactos',
    crear: 'crear_contactos',
    editar: 'editar_contactos',
  },
} as const

type PermisosPorRecurso = typeof PERMISOS_RECURSOS

export type PermisoRecurso = {
  [Recurso in keyof PermisosPorRecurso]: PermisosPorRecurso[Recurso][keyof PermisosPorRecurso[Recurso]]
}[keyof PermisosPorRecurso]

const PERMISSION_TO_RESOURCE_ACTION: Record<
  PermisoRecurso,
  { recurso: RecursoTransversal; accion: Exclude<AccionRecurso, 'administrar'> }
> = {
  ver_clientes: { recurso: 'clientes', accion: 'ver' },
  crear_clientes: { recurso: 'clientes', accion: 'crear' },
  editar_clientes: { recurso: 'clientes', accion: 'editar' },
  ver_proveedores: { recurso: 'proveedores', accion: 'ver' },
  crear_proveedores: { recurso: 'proveedores', accion: 'crear' },
  editar_proveedores: { recurso: 'proveedores', accion: 'editar' },
  ver_contactos: { recurso: 'contactos', accion: 'ver' },
  crear_contactos: { recurso: 'contactos', accion: 'crear' },
  editar_contactos: { recurso: 'contactos', accion: 'editar' },
}

export const MODULOS_PRINCIPALES: ModuloPrincipal[] = [
  'comercial',
  'financiero',
  'contable',
  'operacional',
  'rrhh',
  'administracion',
  'haras',
  'seguridad',
]

export const MODULO_PRINCIPAL_LABELS: Record<ModuloPrincipal, string> = {
  comercial: 'Comercial',
  financiero: 'Financiero',
  contable: 'Contable',
  operacional: 'Operacional',
  rrhh: 'Recursos Humanos',
  administracion: 'Administración',
  haras: 'Tralixia Haras',
  seguridad: 'Seguridad',
}

/**
 * Relación entre submódulos/rutas actuales y módulos principales.
 */
const MODULE_TO_PRINCIPAL: Record<ModuleKey, ModuloPrincipal | null> = {
  dashboard: null,

  clientes: null,
  proveedores: null,
  contactos: null,

  cotizaciones: 'comercial',
  ingresos: 'comercial',
  cobranza: 'comercial',

  egresos: 'financiero',
  bancos: 'financiero',
  transferencias: 'financiero',

  plan_cuentas: 'contable',
  reportes: 'contable',

  ot: 'operacional',
  pts: 'seguridad',

  remuneraciones: 'rrhh',

  configuracion_usuarios: 'administracion',
  configuracion_auditoria: 'administracion',
  haras: 'haras',
}

const MODULE_TO_RESOURCE: Partial<Record<ModuleKey, RecursoTransversal>> = {
  clientes: 'clientes',
  proveedores: 'proveedores',
  contactos: 'contactos',
}

const RESOURCE_TO_MODULES: Record<RecursoTransversal, ModuloPrincipal[]> = {
  clientes: ['operacional', 'comercial', 'financiero', 'contable'],
  proveedores: ['operacional', 'financiero', 'contable'],
  contactos: ['operacional', 'comercial', 'financiero'],
}

const ROLE_MODULES: Record<RolEmpresa, ModuleKey[]> = {
  admin: [
    'dashboard',
    'clientes',
    'proveedores',
    'contactos',
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
    'pts',
    'configuracion_usuarios',
    'configuracion_auditoria',
    'haras',
  ],

  administracion_financiera: [
    'dashboard',
    'clientes',
    'proveedores',
    'contactos',
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
    'contactos',
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
    'contactos',
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
    'pts',
    'configuracion_usuarios',
    'configuracion_auditoria',
    'haras',
  ],

  cobranzas: [
    'dashboard',
    'clientes',
    'contactos',
    'ingresos',
    'cobranza',
    'reportes',
  ],

  cobranza: [
    'dashboard',
    'clientes',
    'contactos',
    'ingresos',
    'cobranza',
    'reportes',
  ],

  comercial: [
    'dashboard',
    'clientes',
    'contactos',
    'cotizaciones',
  ],

  tecnico_ot: ['ot'],

  demo_cliente: [
    'dashboard',
    'clientes',
    'proveedores',
    'contactos',
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
    'pts',
    'haras',
  ],

  seguridad_pts: ['pts'],
}

const ROLE_RESOURCE_PERMISSIONS: Record<
  RolEmpresa,
  Partial<Record<RecursoTransversal, AccionRecurso[]>>
> = {
  admin: {
    clientes: ['ver', 'crear', 'editar', 'administrar'],
    proveedores: ['ver', 'crear', 'editar', 'administrar'],
    contactos: ['ver', 'crear', 'editar', 'administrar'],
  },

  administracion_financiera: {
    clientes: ['ver', 'crear', 'editar'],
    proveedores: ['ver', 'crear', 'editar'],
    contactos: ['ver', 'crear', 'editar'],
  },

  finanzas: {
    clientes: ['ver', 'crear', 'editar'],
    proveedores: ['ver', 'crear', 'editar'],
    contactos: ['ver', 'crear', 'editar'],
  },

  gerencia: {
    clientes: ['ver', 'crear', 'editar', 'administrar'],
    proveedores: ['ver', 'crear', 'editar', 'administrar'],
    contactos: ['ver', 'crear', 'editar', 'administrar'],
  },

  cobranzas: {
    clientes: ['ver', 'crear', 'editar'],
    contactos: ['ver', 'crear', 'editar'],
  },

  cobranza: {
    clientes: ['ver', 'crear', 'editar'],
    contactos: ['ver', 'crear', 'editar'],
  },

  comercial: {
    clientes: ['ver', 'crear', 'editar'],
    contactos: ['ver', 'crear', 'editar'],
  },

  tecnico_ot: {
    clientes: ['ver'],
    contactos: ['ver'],
  },

  demo_cliente: {
    clientes: ['ver'],
    proveedores: ['ver'],
    contactos: ['ver'],
  },

  seguridad_pts: {},
}

export function getModuloPrincipal(
  moduleKey: ModuleKey
): ModuloPrincipal | null {
  return MODULE_TO_PRINCIPAL[moduleKey]
}

export function getRecursoTransversalFromModule(
  moduleKey: ModuleKey
): RecursoTransversal | null {
  return MODULE_TO_RESOURCE[moduleKey] ?? null
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

export function canAccessResource(
  rol: RolEmpresa | string | null | undefined,
  recurso: RecursoTransversal,
  accion: AccionRecurso = 'ver'
) {
  if (!rol) return false

  const normalizedRol = rol as RolEmpresa
  const permisosRol = ROLE_RESOURCE_PERMISSIONS[normalizedRol]
  const accionesPermitidas = permisosRol?.[recurso]

  if (!accionesPermitidas) return false

  return accionesPermitidas.includes(accion)
}

export function canAccessResourcePermission(
  rol: RolEmpresa | string | null | undefined,
  permiso: PermisoRecurso
) {
  const { recurso, accion } = PERMISSION_TO_RESOURCE_ACTION[permiso]

  return canAccessResource(rol, recurso, accion)
}

export function canAccessResourcePermissionByRoleAndCompany(
  rol: RolEmpresa | string | null | undefined,
  permiso: PermisoRecurso,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  const { recurso, accion } = PERMISSION_TO_RESOURCE_ACTION[permiso]

  return canAccessResourceByRoleAndCompany(
    rol,
    recurso,
    accion,
    modulosHabilitados
  )
}

export function getModulesForRole(
  rol: RolEmpresa | string | null | undefined
): ModuleKey[] {
  if (!rol) return []

  const normalizedRol = rol as RolEmpresa
  return ROLE_MODULES[normalizedRol] ?? []
}

export function getResourceActionsForRole(
  rol: RolEmpresa | string | null | undefined,
  recurso: RecursoTransversal
): AccionRecurso[] {
  if (!rol) return []

  const normalizedRol = rol as RolEmpresa
  return ROLE_RESOURCE_PERMISSIONS[normalizedRol]?.[recurso] ?? []
}

export function isEmpresaModuloHabilitado(
  moduleKey: ModuleKey,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  const recurso = getRecursoTransversalFromModule(moduleKey)

  if (recurso) {
    return isEmpresaRecursoHabilitado(recurso, modulosHabilitados)
  }

  const moduloPrincipal = getModuloPrincipal(moduleKey)

  if (!moduloPrincipal) return true
  if (!modulosHabilitados?.length) return false

  return modulosHabilitados.includes(moduloPrincipal)
}

export function isEmpresaRecursoHabilitado(
  recurso: RecursoTransversal,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  if (!modulosHabilitados?.length) return false

  const modulosQueHabilitanRecurso = RESOURCE_TO_MODULES[recurso]

  return modulosQueHabilitanRecurso.some((modulo) =>
    modulosHabilitados.includes(modulo)
  )
}

export function canAccessModuleByRoleAndCompany(
  rol: RolEmpresa | string | null | undefined,
  moduleKey: ModuleKey,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  const recurso = getRecursoTransversalFromModule(moduleKey)

  if (recurso) {
    return (
      canAccessModule(rol, moduleKey) &&
      canAccessResourceByRoleAndCompany(
        rol,
        recurso,
        'ver',
        modulosHabilitados
      )
    )
  }

  return (
    canAccessModule(rol, moduleKey) &&
    isEmpresaModuloHabilitado(moduleKey, modulosHabilitados)
  )
}

export function canAccessResourceByRoleAndCompany(
  rol: RolEmpresa | string | null | undefined,
  recurso: RecursoTransversal,
  accion: AccionRecurso,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  return (
    canAccessResource(rol, recurso, accion) &&
    isEmpresaRecursoHabilitado(recurso, modulosHabilitados)
  )
}

export function canAdministrarMaestros(
  rol: RolEmpresa | string | null | undefined,
  modulosHabilitados: Array<ModuloPrincipal | string> | null | undefined
) {
  return (
    canAccessResourceByRoleAndCompany(
      rol,
      'clientes',
      'administrar',
      modulosHabilitados
    ) ||
    canAccessResourceByRoleAndCompany(
      rol,
      'proveedores',
      'administrar',
      modulosHabilitados
    ) ||
    canAccessResourceByRoleAndCompany(
      rol,
      'contactos',
      'administrar',
      modulosHabilitados
    )
  )
}
