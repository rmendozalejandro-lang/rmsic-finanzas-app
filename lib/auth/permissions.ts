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
 * - clientes, proveedores y contactos quedan sin módulo principal directo porque ahora
 *   son recursos transversales/maestros. Su habilitación depende de RESOURCE_TO_MODULES.
 * - reportes queda asociado a contable por ahora.
 * - OT queda asociado a operacional.
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

  remuneraciones: 'rrhh',

  configuracion_usuarios: 'administracion',
  configuracion_auditoria: 'administracion',
}

/**
 * Relación entre rutas del menú y recursos maestros/transversales.
 *
 * Esto permite que /clientes o /maestros/clientes se pueda controlar como recurso,
 * no como dependencia exclusiva del módulo Comercial.
 */
const MODULE_TO_RESOURCE: Partial<Record<ModuleKey, RecursoTransversal>> = {
  clientes: 'clientes',
  proveedores: 'proveedores',
  contactos: 'contactos',
}

/**
 * Módulos principales que justifican el uso de cada recurso transversal.
 *
 * Criterio actual:
 * - clientes: lo usan Operacional/OT, Comercial, Financiero y Contable.
 * - proveedores: lo usan Operacional, Financiero y Contable.
 * - contactos: lo usan Operacional, Comercial y Financiero.
 *
 * Nota futura:
 * - Cuando exista módulo principal "compras", conviene agregarlo a proveedores.
 */
const RESOURCE_TO_MODULES: Record<RecursoTransversal, ModuloPrincipal[]> = {
  clientes: ['operacional', 'comercial', 'financiero', 'contable'],
  proveedores: ['operacional', 'financiero', 'contable'],
  contactos: ['operacional', 'comercial', 'financiero'],
}

/**
 * Permisos por rol dentro de una empresa.
 *
 * Importante:
 * - super_admin no se controla aquí.
 * - super_admin se valida con roles_sistema/es_super_admin().
 * - Estos permisos aplican a usuario_empresas.rol.
 * - tecnico_ot queda limitado exclusivamente al módulo OT en menú,
 *   pero puede consultar clientes/contactos dentro del flujo OT si se requiere.
 * - cobranzas/cobranza queda limitado a cobranza y módulos relacionados.
 */
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
    'configuracion_usuarios',
    'configuracion_auditoria',
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
    'configuracion_usuarios',
    'configuracion_auditoria',
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
    'ot',
  ],
}

/**
 * Permisos finos por recurso transversal.
 *
 * Esto permite que el menú y los formularios puedan preguntar:
 * - puede ver clientes?
 * - puede crear clientes desde Nueva OT?
 * - puede editar proveedores?
 */
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
