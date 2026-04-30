'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'
import {
  MODULO_PRINCIPAL_LABELS,
  canAccessModuleByRoleAndCompany,
  getModuloPrincipal,
  type ModuleKey,
  type ModuloPrincipal,
} from '../../lib/auth/permissions'
import AceptarInvitacionesPendientes from '../../components/AceptarInvitacionesPendientes'

type PrivateLayoutProps = {
  children: ReactNode
}

type Empresa = {
  id: string
  nombre: string
}

type Perfil = {
  id: string
  email?: string | null
  nombre_completo?: string | null
}

type MenuItem = {
  href: string
  label: string
  moduleKey: ModuleKey
}

type EmpresaModuloRow = {
  modulo: ModuloPrincipal | string
  habilitado: boolean
}

type MenuGroup = {
  key: ModuloPrincipal | 'general'
  label: string
  items: MenuItem[]
}

const menuItems: MenuItem[] = [
  { href: '/', label: 'Dashboard', moduleKey: 'dashboard' },

  { href: '/clientes', label: 'Clientes', moduleKey: 'clientes' },
  { href: '/cotizaciones', label: 'Cotizaciones', moduleKey: 'cotizaciones' },
  { href: '/ingresos', label: 'Ingresos / Ventas', moduleKey: 'ingresos' },
  { href: '/cobranza', label: 'Cobranzas', moduleKey: 'cobranza' },

  { href: '/bancos', label: 'Bancos', moduleKey: 'bancos' },
  { href: '/egresos', label: 'Egresos', moduleKey: 'egresos' },
  { href: '/documentos-sii', label: 'Documentos SII', moduleKey: 'egresos' },
  { href: '/proveedores', label: 'Proveedores', moduleKey: 'proveedores' },
  { href: '/transferencias', label: 'Transferencias', moduleKey: 'transferencias' },

  { href: '/plan-cuentas', label: 'Plan de Cuentas', moduleKey: 'plan_cuentas' },
  { href: '/reportes', label: 'Reportes', moduleKey: 'reportes' },

  { href: '/ot', label: 'OT', moduleKey: 'ot' },

  { href: '/remuneraciones', label: 'Remuneraciones', moduleKey: 'remuneraciones' },

  {
    href: '/configuracion/usuarios',
    label: 'Usuarios de mi empresa',
    moduleKey: 'configuracion_usuarios',
  },
{
    href: '/configuracion/correos',
    label: 'Correos y notificaciones',
    moduleKey: 'configuracion_usuarios',
  },
  {
    href: '/configuracion/auditoria',
    label: 'Auditoría',
    moduleKey: 'configuracion_auditoria',
  },
]

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const MENU_GROUP_ORDER: Array<ModuloPrincipal | 'general'> = [
  'general',
  'comercial',
  'financiero',
  'contable',
  'operacional',
  'rrhh',
  'administracion',
]

const MENU_GROUP_LABELS: Record<ModuloPrincipal | 'general', string> = {
  general: 'General',
  ...MODULO_PRINCIPAL_LABELS,
}

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [checkingSession, setCheckingSession] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombreLocal, setEmpresaActivaNombreLocal] = useState('')
  const [modulosHabilitados, setModulosHabilitados] = useState<ModuloPrincipal[]>([])

  const [usuarioNombre, setUsuarioNombre] = useState('')
  const [usuarioEmail, setUsuarioEmail] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [rolResuelto, setRolResuelto] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [collapsedMenuGroups, setCollapsedMenuGroups] = useState<Record<string, boolean>>({})

  const fetchEmpresaModulos = async (empresaId: string) => {
    if (!empresaId) {
      setModulosHabilitados([])
      return
    }

    const modulosResp = await supabase
      .from('empresa_modulos')
      .select('modulo, habilitado')
      .eq('empresa_id', empresaId)
      .eq('habilitado', true)

    if (modulosResp.error) {
      console.error('No se pudieron cargar módulos de empresa:', modulosResp.error.message)
      setModulosHabilitados([])
      return
    }

    const modulosData = (modulosResp.data ?? []) as EmpresaModuloRow[]
    setModulosHabilitados(
      modulosData
        .filter((modulo) => modulo.habilitado)
        .map((modulo) => modulo.modulo as ModuloPrincipal)
    )
  }

  const fetchUsuarioContexto = async (
    empresaId: string,
    email: string,
    userId: string
  ) => {
    try {
      const perfilResp = await supabase
        .from('perfiles')
        .select('id, email, nombre_completo')
        .eq('id', userId)
        .maybeSingle()

      if (!perfilResp.error && perfilResp.data) {
        const perfil = perfilResp.data as Perfil
        setUsuarioNombre(perfil.nombre_completo || perfil.email || email)
        setUsuarioEmail(perfil.email || email)
      } else {
        setUsuarioNombre(email)
        setUsuarioEmail(email)
      }

      const rolResp = await supabase
        .from('usuario_empresas')
        .select('rol')
        .eq('usuario_id', userId)
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .maybeSingle()

      if (!rolResp.error && rolResp.data) {
        setUsuarioRol(rolResp.data.rol || '')
      } else {
        setUsuarioRol('')
      }
    } catch (error) {
      console.error('Error cargando contexto de usuario:', error)
      setUsuarioNombre(email)
      setUsuarioEmail(email)
      setUsuarioRol('')
    } finally {
      setRolResuelto(true)
    }
  }

  const persistEmpresaActiva = async (
    empresa: Empresa,
    email?: string,
    userId?: string
  ) => {
    setEmpresaActivaId(empresa.id)
    setEmpresaActivaNombreLocal(empresa.nombre)
    setRolResuelto(false)
    setModulosHabilitados([])

    window.localStorage.setItem(STORAGE_ID_KEY, empresa.id)
    window.localStorage.setItem(STORAGE_NAME_KEY, empresa.nombre)
    window.dispatchEvent(new Event('empresa-activa-cambiada'))

    let resolvedEmail = email || ''
    let resolvedUserId = userId || ''

    if (!resolvedEmail || !resolvedUserId) {
      const { data } = await supabase.auth.getSession()
      resolvedEmail = data.session?.user.email || ''
      resolvedUserId = data.session?.user.id || ''
    }

    await fetchEmpresaModulos(empresa.id)

    if (resolvedEmail && resolvedUserId) {
      await fetchUsuarioContexto(empresa.id, resolvedEmail, resolvedUserId)
    } else {
      setRolResuelto(true)
    }
  }

  useEffect(() => {
    const storedId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const storedName = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    if (storedId) setEmpresaActivaId(storedId)
    if (storedName) setEmpresaActivaNombreLocal(storedName)
  }, [])

  useEffect(() => {
    const checkSessionAndLoadEmpresas = async () => {
      try {
        const { data } = await supabase.auth.getSession()

        if (!data.session) {
          setIsSuperAdmin(false)
          setCheckingSession(false)
          router.push('/login')
          return
        }

        const email = data.session.user.email || ''
        const userId = data.session.user.id || ''

        setUsuarioEmail(email)

// Primero intenta aceptar invitaciones pendientes del usuario autenticado.
// Esto es clave después de confirmar el correo de Supabase.
const { data: invitacionesResp, error: invitacionesError } = await supabase.rpc(
  'aceptar_mis_invitaciones_empresa'
)

if (invitacionesError) {
  console.warn(
    'No se pudieron aceptar invitaciones pendientes:',
    invitacionesError.message
  )
}

const superAdminResp = await supabase.rpc('es_super_admin')
const esSuperAdmin = !superAdminResp.error && Boolean(superAdminResp.data)

setIsSuperAdmin(esSuperAdmin)

let empresasData: Empresa[] = []

if (esSuperAdmin) {
  const empresasResp = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('activa', true)
    .order('nombre', { ascending: true })

  if (empresasResp.error) {
    console.error('No se pudieron cargar empresas:', empresasResp.error.message)
    setRolResuelto(true)
    return
  }

  empresasData = (empresasResp.data ?? []) as Empresa[]
} else {
  const usuarioEmpresasResp = await supabase
    .from('usuario_empresas')
    .select(`
      empresa_id,
      rol,
      activo,
      empresas:empresa_id (
        id,
        nombre
      )
    `)
    .eq('usuario_id', userId)
    .eq('activo', true)

  if (usuarioEmpresasResp.error) {
    console.error(
      'No se pudieron cargar empresas del usuario:',
      usuarioEmpresasResp.error.message
    )
    setRolResuelto(true)
    return
  }

  empresasData = (usuarioEmpresasResp.data ?? [])
    .map((item: any) => item.empresas)
    .filter(Boolean) as Empresa[]
}

setEmpresas(empresasData)        
const guardada = window.localStorage.getItem(STORAGE_ID_KEY)

const empresaGuardadaValida = guardada
  ? empresasData.find((empresa) => empresa.id === guardada)
  : null

if (empresaGuardadaValida) {
  await persistEmpresaActiva(empresaGuardadaValida, email, userId)
} else if (empresasData.length > 0) {
  window.localStorage.removeItem(STORAGE_ID_KEY)
  window.localStorage.removeItem(STORAGE_NAME_KEY)

  await persistEmpresaActiva(empresasData[0], email, userId)
} else {
  window.localStorage.removeItem(STORAGE_ID_KEY)
  window.localStorage.removeItem(STORAGE_NAME_KEY)

  setEmpresaActivaId('')
  setEmpresaActivaNombreLocal('')
  setUsuarioRol('')
  setModulosHabilitados([])
  setRolResuelto(true)
}
      } catch (error) {
        console.error('Error cargando empresas:', error)
        setRolResuelto(true)
      } finally {
        setCheckingSession(false)
      }
    }

    void checkSessionAndLoadEmpresas()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleEmpresaChange = async (empresaId: string) => {
    const empresaSeleccionada = empresas.find((empresa) => empresa.id === empresaId)
    if (!empresaSeleccionada) return

    const { data } = await supabase.auth.getSession()
    const email = data.session?.user.email || ''
    const userId = data.session?.user.id || ''

    await persistEmpresaActiva(empresaSeleccionada, email, userId)
    router.refresh()
  }

  const empresaActiva = empresas.find((empresa) => empresa.id === empresaActivaId)
  const isTecnicoOT = usuarioRol === 'tecnico_ot'

  const empresasParaSelector = useMemo(() => {
    if (empresas.length > 0) return empresas
    if (empresaActivaId && empresaActivaNombreLocal) {
      return [{ id: empresaActivaId, nombre: empresaActivaNombreLocal }]
    }
    return []
  }, [empresas, empresaActivaId, empresaActivaNombreLocal])

  const visibleMenuItems = useMemo(() => {
    if (!rolResuelto) return []

    return menuItems.filter((item) =>
      canAccessModuleByRoleAndCompany(usuarioRol, item.moduleKey, modulosHabilitados)
    )
  }, [usuarioRol, rolResuelto, modulosHabilitados])

  const visibleMenuGroups = useMemo<MenuGroup[]>(() => {
    const grouped = new Map<ModuloPrincipal | 'general', MenuItem[]>()

    for (const item of visibleMenuItems) {
      const groupKey = getModuloPrincipal(item.moduleKey) ?? 'general'
      const currentItems = grouped.get(groupKey) ?? []
      grouped.set(groupKey, [...currentItems, item])
    }

    return MENU_GROUP_ORDER.map((groupKey) => ({
      key: groupKey,
      label: MENU_GROUP_LABELS[groupKey],
      items: grouped.get(groupKey) ?? [],
    })).filter((group) => group.items.length > 0)
  }, [visibleMenuItems])

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const currentRouteItem = useMemo(() => {
    return menuItems
      .filter((item) => item.href !== '/')
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  }, [pathname])

  const isRouteAccessDenied =
    rolResuelto &&
    Boolean(currentRouteItem) &&
    !canAccessModuleByRoleAndCompany(
      usuarioRol,
      currentRouteItem!.moduleKey,
      modulosHabilitados
    )

  useEffect(() => {
    if (!rolResuelto || !isTecnicoOT) return

    const isOtRoute = pathname === '/ot' || pathname.startsWith('/ot/')
    if (!isOtRoute) {
      router.replace('/ot')
    }
  }, [isTecnicoOT, pathname, rolResuelto, router])

  const empresaActivaNombreVisual =
    empresaActiva?.nombre || empresaActivaNombreLocal || 'Sin empresa activa'

  const appTitle = isTecnicoOT
    ? 'Módulo OT'
    : 'Plataforma financiera y administrativa'

  const appSubtitle = isTecnicoOT
    ? 'Órdenes de trabajo y gestión en terreno'
    : 'Plataforma financiera y administrativa'

  const sidebarSupportText = isTecnicoOT
    ? 'Acceso restringido al módulo OT para ejecución, firmas y evidencia en terreno.'
    : 'Gestión multiempresa con módulos habilitados por empresa y permisos por rol.'

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">Auren</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Verificando sesión
            </h1>
            <p className="text-sm text-slate-500">
              Estamos preparando su entorno empresarial.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900 print:bg-white">
      <AceptarInvitacionesPendientes />
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white print:hidden lg:flex lg:flex-col">
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#163A5F] text-white shadow-sm">
                <span className="text-lg font-semibold tracking-tight">A</span>
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-slate-900">
                  Auren
                </div>
                <div className="text-xs text-slate-500">{appSubtitle}</div>
              </div>
            </div>
          </div>

          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              {sidebarSupportText}
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {visibleMenuGroups.map((group) => (
              <div key={group.key}>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {group.label}
                </div>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActiveRoute(item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={active ? { color: '#ffffff' } : undefined}
                        className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium no-underline transition ${
                          active
                            ? 'bg-[#163A5F] !text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {isSuperAdmin && (
              <div>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Administración
                </div>

                <Link
                  href="/admin/empresas"
                  style={isActiveRoute('/admin/empresas') ? { color: '#ffffff' } : undefined}
                  className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium no-underline transition ${
                    isActiveRoute('/admin/empresas')
                      ? 'bg-[#163A5F] !text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Admin Empresas
                </Link>
              </div>
            )}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Auren</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {appTitle}
                  </h1>
                </div>

                <div className="flex flex-col gap-4 md:flex-row md:items-end xl:items-center">
                  <div className="min-w-[260px]">
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                      Empresa activa
                    </label>
                    <select
                      value={empresaActivaId}
                      onChange={(e) => void handleEmpresaChange(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-[#245C90]"
                      disabled={empresasParaSelector.length === 0}
                    >
                      {empresasParaSelector.length === 0 ? (
                        <option value="">Sin empresas disponibles</option>
                      ) : (
                        empresasParaSelector.map((empresa) => (
                          <option key={empresa.id} value={empresa.id}>
                            {empresa.nombre}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm md:min-w-[220px] md:text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {usuarioNombre || usuarioEmail || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {usuarioRol || 'Sin rol asignado'}
                    </p>
                  </div>

                  <button
                    onClick={() => void handleLogout()}
                    className="rounded-2xl bg-[#163A5F] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#245C90]"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Empresa activa:{' '}
                <span className="font-semibold text-slate-900">
                  {empresaActivaNombreVisual}
                </span>
              </div>

              <nav className="mt-4 flex flex-wrap gap-2 lg:hidden">
                {visibleMenuItems.map((item) => {
                  const active = isActiveRoute(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={active ? { color: '#ffffff' } : undefined}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium no-underline transition ${
                        active
                          ? 'bg-[#163A5F] !text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}

                {isSuperAdmin && (
                  <Link
                    href="/admin/empresas"
                    style={isActiveRoute('/admin/empresas') ? { color: '#ffffff' } : undefined}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium no-underline transition ${
                      isActiveRoute('/admin/empresas')
                        ? 'bg-[#163A5F] !text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    Admin Empresas
                  </Link>
                )}
              </nav>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
            {isRouteAccessDenied ? (
              <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-amber-700">Acceso restringido</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
                  No tienes acceso a este módulo
                </h2>
                <p className="mt-3 text-sm leading-6 text-amber-800">
                  El módulo solicitado no está habilitado para la empresa activa o tu rol no tiene permiso para acceder.
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Empresa activa: <span className="font-semibold">{empresaActivaNombreVisual}</span>
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="rounded-2xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#245C90]"
                  >
                    Volver al dashboard
                  </Link>

                  {isSuperAdmin && (
                    <Link
                      href="/admin/empresas"
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-50"
                    >
                      Administrar empresas
                    </Link>
                  )}
                </div>
              </section>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
