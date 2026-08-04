"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import {
  MODULO_PRINCIPAL_LABELS,
  canAccessModuleByRoleAndCompany,
  getModuloPrincipal,
  getRecursoTransversalFromModule,
  type ModuleKey,
  type ModuloPrincipal,
} from '../../lib/auth/permissions'
import AceptarInvitacionesPendientes from '../../components/AceptarInvitacionesPendientes'
import OfflineStatusBanner from '../../components/offline/OfflineStatusBanner'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import {
  HARAS_PARTOS_MODULE,
  HARAS_PARTOS_ROUTE,
  OT_MODULE,
  OT_ROUTE,
  prepareHarasPartosRegistry,
  upsertTerrainModule,
  readTerrainRegistry,
  type TerrainRegistry,
} from '../../lib/offline/terrain-registry'
import { isOTPendingPayload, mergeOTOfflineCache, OT_PENDING_ACTION, readOTOfflineCache, type OTOfflinePendingPayload } from '../../lib/offline/ot'

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

type UsuarioEmpresaRow = {
  empresas: Empresa | Empresa[] | null
}

type MenuGroup = {
  key: ModuloPrincipal | 'general' | 'maestros'
  label: string
  items: MenuItem[]
}

const menuItems: MenuItem[] = [
  { href: '/', label: 'Dashboard', moduleKey: 'dashboard' },

  { href: '/haras', label: 'Tralixia Haras', moduleKey: 'haras' },

  { href: '/clientes', label: 'Clientes', moduleKey: 'clientes' },
  { href: '/contactos', label: 'Contactos', moduleKey: 'contactos' },
  { href: '/cotizaciones', label: 'Cotizaciones', moduleKey: 'cotizaciones' },
  { href: '/ingresos', label: 'Ingresos / Ventas', moduleKey: 'ingresos' },
  { href: '/cobranza', label: 'Cobranzas', moduleKey: 'cobranza' },

  { href: '/bancos', label: 'Bancos', moduleKey: 'bancos' },
  { href: '/egresos', label: 'Egresos', moduleKey: 'egresos' },
  { href: '/cuentas-por-pagar', label: 'Cuentas por pagar', moduleKey: 'egresos' },
  { href: '/documentos-sii', label: 'Documentos SII', moduleKey: 'egresos' },
  { href: '/proveedores', label: 'Proveedores', moduleKey: 'proveedores' },
  { href: '/transferencias', label: 'Transferencias', moduleKey: 'transferencias' },

 { href: '/plan-cuentas', label: 'Plan de Cuentas', moduleKey: 'plan_cuentas' },
{ href: '/asientos', label: 'Asientos contables', moduleKey: 'plan_cuentas' },
{
  label: 'Activos fijos',
  href: '/activos-fijos',
  moduleKey: 'plan_cuentas',
},
{ href: '/reportes', label: 'Reportes', moduleKey: 'reportes' },

  { href: '/ot', label: 'OT', moduleKey: 'ot' },
  { href: '/ot/equipos', label: 'Equipos / Activos', moduleKey: 'ot' },
{ href: '/operacional/tecnicos-dyf', label: 'Técnicos DyF', moduleKey: 'ot' },
  { href: '/informes', label: 'Informes Técnicos', moduleKey: 'ot' },

  { href: '/remuneraciones', label: 'Remuneraciones', moduleKey: 'remuneraciones' },
{ href: '/remuneraciones/prestamos', label: 'Prestamos y anticipos', moduleKey: 'remuneraciones' },
{ href: '/remuneraciones/cotizaciones', label: 'Cotizaciones / Leyes sociales', moduleKey: 'remuneraciones' },

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
    label: 'Auditori­a',
    moduleKey: 'configuracion_auditoria',
  },
]

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type MenuGroupKey = ModuloPrincipal | 'general' | 'maestros'

const MENU_GROUP_ORDER: MenuGroupKey[] = [
  'general',
  'maestros',
  'comercial',
  'financiero',
  'contable',
  'operacional',
  'rrhh',
  'administracion',
  'haras',
]

const MENU_GROUP_LABELS: Record<MenuGroupKey, string> = {
  general: 'General',
  maestros: 'Maestros',
  ...MODULO_PRINCIPAL_LABELS,
}

const RMSIC_EMPRESA_ID = '557a054c-71ef-4c5f-8637-594755ad669b'
const DYF_EMPRESA_ID = '73dd5543-2bf7-4d44-9982-4a641c8658f5'

function empresaTieneTecnicosDyf(empresaId?: string | null) {
  return empresaId === DYF_EMPRESA_ID
}

function empresaTieneInformesTecnicos(empresaId?: string | null) {
  return empresaId === RMSIC_EMPRESA_ID
}

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isOnline, isOffline } = useNetworkStatus()
  const { items: offlineQueueItems } = useOfflineQueue()

  const [checkingSession, setCheckingSession] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombreLocal, setEmpresaActivaNombreLocal] = useState('')
  const [modulosHabilitados, setModulosHabilitados] = useState<ModuloPrincipal[]>([])

  const [usuarioId, setUsuarioId] = useState('')
  const [terrainRegistry, setTerrainRegistry] = useState<TerrainRegistry | null>(null)
  const [usuarioNombre, setUsuarioNombre] = useState('')
  const [usuarioEmail, setUsuarioEmail] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [rolResuelto, setRolResuelto] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
      console.error('No se pudieron cargar modulos de empresa:', modulosResp.error.message)
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
        setUsuarioId(userId)
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
        setUsuarioId(userId)

// Primero intenta aceptar invitaciones pendientes del usuario autenticado.
// Esto es clave despuÃ©s de confirmar el correo de Supabase.
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

  empresasData = ((usuarioEmpresasResp.data ?? []) as UsuarioEmpresaRow[])
    .flatMap((item) => item.empresas ?? [])
    .filter((empresa): empresa is Empresa => Boolean(empresa))
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

  const preparePartosForTerrain = useCallback(async () => {
    if (!isOnline || !empresaActivaId || !usuarioId || !rolResuelto ||
      !canAccessModuleByRoleAndCompany(usuarioRol, 'haras', modulosHabilitados)) return

    const [animals, partos, routeResponse] = await Promise.all([
      supabase.from('vet_animales').select('id, nombre, categoria, sexo')
        .eq('empresa_id', empresaActivaId).order('nombre'),
      supabase.from('vet_partos').select('id, madre_id, padre_id, cria_id, fecha_ultima_monta, fecha_probable_parto, fecha_parto_real, dias_gestacion_real, estado_reproductivo, sexo_cria, nombre_cria, peso_cria, peso_placenta, observaciones, hora_inicio_parto, hora_expulsion_cria, hora_parada_yegua, hora_corte_cordon, hora_parada_potrillo, hora_expulsion_placenta, hora_primera_mamada')
        .eq('empresa_id', empresaActivaId).order('fecha_probable_parto', { ascending: true }),
      fetch(HARAS_PARTOS_ROUTE, { credentials: 'same-origin' }),
    ])
    if (animals.error || partos.error || !routeResponse.ok) return

    router.prefetch(HARAS_PARTOS_ROUTE)
    const validatedAt = new Date()
    try {
      const routeCache = await window.caches.open('tralixia-terrain-v1')
      await routeCache.put(HARAS_PARTOS_ROUTE, routeResponse.clone())
      window.localStorage.setItem(`tralixia_haras_partos_cache_${empresaActivaId}`, JSON.stringify({
        empresa_id: empresaActivaId,
        updated_at: validatedAt.toISOString(),
        animales: animals.data ?? [],
        gestaciones: (partos.data ?? []).filter((parto) =>
          !parto.fecha_parto_real && parto.estado_reproductivo !== 'anulado'),
      }))
      window.localStorage.setItem(
        `tralixia_terrain_access_v1_${empresaActivaId}_haras_partos`,
        JSON.stringify({
          empresaId: empresaActivaId,
          module: HARAS_PARTOS_MODULE,
          userId: usuarioId,
          allowed: true,
          validatedAt: validatedAt.toISOString(),
          expiresAt: new Date(validatedAt.getTime() + 86_400_000).toISOString(),
        })
      )
      setTerrainRegistry(prepareHarasPartosRegistry(empresaActivaId, usuarioId))
    } catch {
      // Solo se anuncia el módulo cuando ruta, permiso y datos quedaron guardados.
    }
  }, [empresaActivaId, isOnline, modulosHabilitados, rolResuelto, router, usuarioId, usuarioRol])

  useEffect(() => {
    setTerrainRegistry(
      empresaActivaId && usuarioId ? readTerrainRegistry(empresaActivaId, usuarioId) : null
    )
  }, [empresaActivaId, isOnline, usuarioId])

  useEffect(() => {
    const timer = window.setTimeout(() => void preparePartosForTerrain(), 1200)
    return () => window.clearTimeout(timer)
  }, [preparePartosForTerrain])


  const prepareOTForTerrain = useCallback(async () => {
    if (!isOnline || !empresaActivaId || !usuarioId || !rolResuelto ||
      !canAccessModuleByRoleAndCompany(usuarioRol, 'ot', modulosHabilitados)) return

    try {
      const { data: rolData } = await supabase
        .from('usuario_empresas')
        .select('rol')
        .eq('usuario_id', usuarioId)
        .eq('empresa_id', empresaActivaId)
        .eq('activo', true)
        .maybeSingle()

      let query = supabase
        .from('ot_vw_resumen')
        .select('*')
        .eq('empresa_id', empresaActivaId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (rolData?.rol === 'tecnico_ot') {
        const ownOtResp = await supabase
          .from('ot_ordenes_trabajo')
          .select('id')
          .eq('empresa_id', empresaActivaId)
          .or(`tecnico_responsable_id.eq.${usuarioId},created_by.eq.${usuarioId}`)

        if (ownOtResp.error) return
        const ownOtIds = (ownOtResp.data ?? []).map((item) => item.id).filter(Boolean)
        if (ownOtIds.length === 0) return
        query = query.in('id', ownOtIds)
      }

      const listadoResp = await query
      if (listadoResp.error) return

      const ots = ((listadoResp.data ?? []) as Array<Record<string, unknown>>).filter((ot) => {
        const estado = String(ot.estado_nombre ?? '').toLowerCase()
        return !estado.includes('cerrad') && !estado.includes('anulad')
      })

      if (ots.length === 0) return

      const ids = ots.map((ot) => ot.id).filter(Boolean)
      const detallesResp = await supabase
        .from('ot_ordenes_trabajo')
        .select('id, empresa_id, folio, cliente_id, titulo, descripcion_solicitud, problema_reportado, diagnostico, trabajo_realizado, recomendaciones, observaciones_cierre, requiere_checklist, plantilla_checklist_id, fecha_ot, fecha_programada, fecha_cierre, tecnico_responsable_id, contacto_cliente_id, contacto_cliente_nombre, contacto_cliente_email, contacto_cliente_cargo, created_by, updated_at')
        .eq('empresa_id', empresaActivaId)
        .in('id', ids)
        .is('deleted_at', null)

      if (detallesResp.error) return

      const routeResponse = await fetch(OT_ROUTE, { credentials: 'same-origin' })
      if (!routeResponse.ok) return

      router.prefetch(OT_ROUTE)
      const routeCache = await window.caches.open('tralixia-terrain-v1')
      await routeCache.put(OT_ROUTE, routeResponse.clone())

      const resumenPorId = new Map(ots.map((ot) => [String(ot.id), ot]))
      const detallesEnriquecidos = (detallesResp.data ?? []).map((detalle) => {
        const resumen = resumenPorId.get(String(detalle.id))

        return {
          ...detalle,
          cliente_nombre: resumen?.cliente_nombre ?? null,
          estado_nombre: resumen?.estado_nombre ?? null,
          folio: detalle.folio ?? resumen?.folio ?? null,
          titulo: detalle.titulo ?? resumen?.titulo ?? null,
          tipo_servicio_nombre: resumen?.tipo_servicio_nombre ?? null,
          tecnico_nombre: resumen?.tecnico_nombre ?? null,
          equipo_id: resumen?.equipo_id ?? null,
          equipo_tag: resumen?.equipo_tag ?? null,
          equipo_nombre: resumen?.equipo_nombre ?? null,
          equipo_descripcion: resumen?.equipo_descripcion ?? null,
          equipo_tipo: resumen?.equipo_tipo ?? null,
          equipo_planta: resumen?.equipo_planta ?? null,
          equipo_area: resumen?.equipo_area ?? null,
          equipo_linea: resumen?.equipo_linea ?? null,
          equipo_ubicacion: resumen?.equipo_ubicacion ?? null,
          equipo_marca: resumen?.equipo_marca ?? null,
          equipo_modelo: resumen?.equipo_modelo ?? null,
          equipo_serie: resumen?.equipo_serie ?? null,
          equipo_potencia: resumen?.equipo_potencia ?? null,
        }
      })

      mergeOTOfflineCache({
        empresa_id: empresaActivaId,
        user_id: usuarioId,
        ots: ots as Parameters<typeof mergeOTOfflineCache>[0]['ots'],
        detalles: detallesEnriquecidos as Parameters<typeof mergeOTOfflineCache>[0]['detalles'],
      })

      setTerrainRegistry(upsertTerrainModule(empresaActivaId, usuarioId, OT_MODULE, OT_ROUTE))
    } catch {
      // La OT offline se anuncia solo si permisos, ruta y datos quedaron preparados.
    }
  }, [empresaActivaId, isOnline, modulosHabilitados, rolResuelto, router, usuarioId, usuarioRol])

  const syncOTPendingForTerrain = useCallback(async () => {
    if (!isOnline || !empresaActivaId || !usuarioId) return

    const pendingItems = offlineQueueItems.filter((item) =>
      item.module === OT_MODULE && item.action === OT_PENDING_ACTION && item.status === 'pendiente' &&
      isOTPendingPayload(item.payload) && item.payload.empresa_id === empresaActivaId &&
      item.payload.user_id === usuarioId
    )

    for (const item of pendingItems) {
      const payload = item.payload as OTOfflinePendingPayload
      try {
        const { updateOfflineQueueItem } = await import('../../lib/offline/offline-queue')
        updateOfflineQueueItem(item.id, { status: 'sincronizando', error: undefined })

        const { data: otActual, error: otReadError } = await supabase
          .from('ot_ordenes_trabajo')
          .select('id, empresa_id, trabajo_realizado, updated_at')
          .eq('id', payload.ot_id)
          .eq('empresa_id', payload.empresa_id)
          .maybeSingle()

        if (otReadError) throw otReadError
        if (!otActual) throw new Error('No se encontró la OT para sincronizar el avance offline.')

        const updatedAtActual = typeof otActual.updated_at === 'string' ? otActual.updated_at : null
        if (updatedAtActual !== payload.base_updated_at) {
          throw new Error('La OT cambió en línea después de prepararse offline. Revisa y sincroniza manualmente.')
        }

        const lineasAvance = [
          payload.observacion_terreno.trim() && `Observación terreno: ${payload.observacion_terreno.trim()}`,
          payload.estado_local_avance.trim() && `Estado local: ${payload.estado_local_avance.trim()}`,
          payload.notas_internas_ejecucion.trim() && `Notas internas: ${payload.notas_internas_ejecucion.trim()}`,
        ].filter(Boolean)

        const { removeOfflineQueueItem } = await import('../../lib/offline/offline-queue')

        if (lineasAvance.length > 0) {
          const fechaSincronizacion = new Date().toISOString()
          const avanceOffline = [
            '--- Avance registrado offline ---',
            `Fecha sincronización: ${fechaSincronizacion}`,
            ...lineasAvance,
          ].join('\n')
          const trabajoRealizadoActual = typeof otActual.trabajo_realizado === 'string'
            ? otActual.trabajo_realizado.trim()
            : ''
          const trabajoRealizado = trabajoRealizadoActual
            ? `${trabajoRealizadoActual}\n\n${avanceOffline}`
            : avanceOffline

          const updateResp = await supabase
            .from('ot_ordenes_trabajo')
            .update({ trabajo_realizado: trabajoRealizado })
            .eq('id', payload.ot_id)
            .eq('empresa_id', payload.empresa_id)

          if (updateResp.error) throw updateResp.error
        }

        window.localStorage.removeItem(`tralixia_ot_draft_${payload.empresa_id}_${payload.user_id}_${payload.ot_id}`)
        removeOfflineQueueItem(item.id)
      } catch (error) {
        const { updateOfflineQueueItem } = await import('../../lib/offline/offline-queue')
        updateOfflineQueueItem(item.id, { status: 'error', error: error instanceof Error ? error.message : 'No se pudo sincronizar OT.' })
      }
    }
  }, [empresaActivaId, isOnline, offlineQueueItems, usuarioId])

  useEffect(() => {
    const timer = window.setTimeout(() => void prepareOTForTerrain(), 1800)
    return () => window.clearTimeout(timer)
  }, [prepareOTForTerrain])

  useEffect(() => {
    void syncOTPendingForTerrain()
  }, [syncOTPendingForTerrain])

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

    if (usuarioRol === 'tecnico_ot') {
      return menuItems.filter((item) => item.href === '/ot')
    }

    return menuItems.filter((item) => {
      if (item.href === '/operacional/tecnicos-dyf' && !empresaTieneTecnicosDyf(empresaActivaId)) {
        return false
      }

      if (item.href === '/informes' && !empresaTieneInformesTecnicos(empresaActivaId)) {
        return false
      }

      return canAccessModuleByRoleAndCompany(
        usuarioRol,
        item.moduleKey,
        modulosHabilitados
      )
    })
  }, [usuarioRol, rolResuelto, modulosHabilitados, empresaActivaId])

  const visibleMenuGroups = useMemo<MenuGroup[]>(() => {
    if (isOffline) {
      const items: MenuItem[] = []
      if (terrainRegistry?.modules.some((module) => module.module === HARAS_PARTOS_MODULE)) {
        items.push({ href: HARAS_PARTOS_ROUTE, label: 'Partos', moduleKey: 'haras' })
      }
      if (terrainRegistry?.modules.some((module) => module.module === OT_MODULE)) {
        items.push({ href: OT_ROUTE, label: 'OT', moduleKey: 'ot' })
      }
      return items.length > 0 ? [{ key: 'haras', label: 'Modo terreno', items }] : []
    }
    const grouped = new Map<MenuGroupKey, MenuItem[]>()

    for (const item of visibleMenuItems) {
      const groupKey = getRecursoTransversalFromModule(item.moduleKey)
        ? 'maestros'
        : getModuloPrincipal(item.moduleKey) ?? 'general'
      const currentItems = grouped.get(groupKey) ?? []
      grouped.set(groupKey, [...currentItems, item])
    }

    return MENU_GROUP_ORDER.map((groupKey) => ({
      key: groupKey,
      label: MENU_GROUP_LABELS[groupKey],
      items: grouped.get(groupKey) ?? [],
    })).filter((group) => group.items.length > 0)
  }, [isOffline, terrainRegistry, visibleMenuItems])

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const currentRouteItem = useMemo(() => {
    return menuItems
      .filter((item) => item.href !== '/')
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  }, [pathname])

  const isTecnicosDyfRoute =
    pathname === '/operacional/tecnicos-dyf' ||
    pathname.startsWith('/operacional/tecnicos-dyf/')

  const isInformesTecnicosRoute =
    pathname === '/informes' || pathname.startsWith('/informes/')

  const isRouteAccessDenied =
    rolResuelto &&
    (
      (
        Boolean(currentRouteItem) &&
        !canAccessModuleByRoleAndCompany(
          usuarioRol,
          currentRouteItem!.moduleKey,
          modulosHabilitados
        )
      ) ||
      (isTecnicosDyfRoute && !empresaTieneTecnicosDyf(empresaActivaId)) ||
      (isInformesTecnicosRoute && !empresaTieneInformesTecnicos(empresaActivaId))
    )

  useEffect(() => {
    if (!rolResuelto || !isTecnicoOT) return

    const isOtRoute = pathname === '/ot' || pathname.startsWith('/ot/')
    if (!isOtRoute) {
      router.replace('/ot')
    }
  }, [isTecnicoOT, pathname, rolResuelto, router])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMobileMenuOpen])

  const empresaActivaNombreVisual =
    empresaActiva?.nombre || empresaActivaNombreLocal || 'Sin empresa activa'

  const appTitle = isTecnicoOT
    ? 'Modulo OT'
    : 'Plataforma modular de gestion empresarial'

  const appSubtitle = isTecnicoOT
    ? 'Ordenes de trabajo y gestion en terreno'
    : 'Control, trazabilidad y crecimiento en una sola plataforma'

  const sidebarSupportText = isTecnicoOT
    ? 'Acceso operativo al modulo OT para ejecutar trabajos, registrar evidencias y revisar informes autorizados.'
    : 'Gestion multiempresa con modulos habilitados por empresa, roles y recursos transversales.'

  const pendingLocalCount = offlineQueueItems.filter((item) =>
    (item.module === HARAS_PARTOS_MODULE || item.module === OT_MODULE) &&
    item.payload && typeof item.payload === 'object' &&
    (item.payload as { empresa_id?: string }).empresa_id === empresaActivaId
  ).length
  const isCachedOtDetailRoute = useMemo(() => {
    if (!empresaActivaId || !usuarioId) return false
    const match = pathname.match(/^\/ot\/([^/]+)$/)
    if (!match?.[1]) return false
    const cache = readOTOfflineCache(empresaActivaId, usuarioId)
    return Boolean(cache?.detalles.some((detalle) => detalle.id === match[1]))
  }, [empresaActivaId, pathname, usuarioId])

  const isOfflineSafeRoute = pathname === HARAS_PARTOS_ROUTE ||
    pathname.startsWith(`${HARAS_PARTOS_ROUTE}/`) ||
    pathname === OT_ROUTE ||
    isCachedOtDetailRoute
  const showOfflineRouteBlocked = isOffline && !isOfflineSafeRoute
  const showOtOfflineRouteBlocked = showOfflineRouteBlocked && pathname.startsWith(`${OT_ROUTE}/`)

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">Tralixia</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Verificando sesión
            </h1>
            <p className="text-sm text-slate-500">
              Estamos preparando su entorno empresarial.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#F6F8FB] text-slate-900 print:bg-white">
      <AceptarInvitacionesPendientes />
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white print:hidden lg:flex lg:flex-col">
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#163A5F] text-white shadow-sm">
                <span className="text-lg font-semibold tracking-tight">T</span>
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-slate-900">
                  Tralixia
                </div>
                <div className="text-xs text-slate-500">{appSubtitle}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Desarrollado por RM Servicios de Ingenieria y Construccion
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              {sidebarSupportText}
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {isOffline && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                <p className="font-semibold">Modo terreno activo</p>
                <p className="mt-1 text-xs">
                  {pendingLocalCount} pendientes locales
                </p>
              </div>
            )}
            {visibleMenuGroups.map((group) => (
              <div key={group.key}>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {group.label}
                </div>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActiveRoute(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={active ? { color: "#ffffff" } : undefined}
                        className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium no-underline transition ${
                          active
                            ? "bg-[#163A5F] !text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {isOffline && (
              <div className="space-y-1 border-t border-slate-200 pt-3">
                <div className="rounded-xl px-3 py-2 text-sm text-slate-600">
                  Pendientes locales: <strong>{pendingLocalCount}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reintentar conexión
                </button>
              </div>
            )}

            {isOnline && isSuperAdmin && !isTecnicoOT && (
              <div>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Administracion
                </div>

                <Link
                  href="/admin/empresas"
                  style={
                    isActiveRoute("/admin/empresas")
                      ? { color: "#ffffff" }
                      : undefined
                  }
                  className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium no-underline transition ${
                    isActiveRoute("/admin/empresas")
                      ? "bg-[#163A5F] !text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  Admin Empresas
                </Link>
              </div>
            )}
          </nav>

          <div className="border-t border-slate-100 px-5 py-4 text-[11px] leading-5 text-slate-400">
            <p>Tralixia Suite</p>
            <p>Desarrollado por RM Servicios de Ingenieria y Construccion</p>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 print:hidden lg:backdrop-blur">
            <div className="px-4 py-3 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-slate-900">
                    Tralixia
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    Empresa activa:{" "}
                    <span className="font-medium text-slate-700">
                      {empresaActivaNombreVisual}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="mobile-modules-menu"
                  onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
                  aria-label={
                    isMobileMenuOpen
                      ? "Cerrar menú de navegación"
                      : "Abrir menú de navegación"
                  }
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {isMobileMenuOpen ? "×" : "☰"}
                  </span>
                  Menú
                </button>
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <div className="min-w-0">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Empresa
                  </label>
                  <select
                    value={empresaActivaId}
                    onChange={(e) => void handleEmpresaChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#245C90]"
                    disabled={isOffline || empresasParaSelector.length === 0}
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

                <button
                  onClick={() => void handleLogout()}
                  className="rounded-xl bg-[#163A5F] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#245C90]"
                >
                  Cerrar sesión
                </button>
              </div>

              <div className="mt-2 min-w-0 text-xs text-slate-500">
                <span className="font-medium text-slate-800">
                  {usuarioNombre || usuarioEmail || "Usuario"}
                </span>
                {usuarioRol && <span> · {usuarioRol}</span>}
              </div>

              {isMobileMenuOpen && (
                <div className="fixed inset-0 top-[var(--mobile-header-height,0px)] z-50 lg:hidden">
                  <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute inset-0 bg-slate-950/40"
                  />
                  <nav
                    id="mobile-modules-menu"
                    aria-label="Módulos"
                    className="absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col overflow-y-auto bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          Navegación
                        </p>
                        <p className="text-xs text-slate-500">
                          Selecciona un módulo
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-2xl text-slate-600"
                        aria-label="Cerrar menú de navegación"
                      >
                        ×
                      </button>
                    </div>
                    <div className="space-y-5">
                      {visibleMenuGroups.map((group) => (
                        <div key={group.key}>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {group.label}
                          </p>
                          <div className="space-y-1">
                            {group.items.map((item) => {
                      const active = isActiveRoute(item.href)

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onNavigate={() => setIsMobileMenuOpen(false)}
                          style={active ? { color: '#ffffff' } : undefined}
                          className={`flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-sm font-medium no-underline transition ${
                            active
                              ? 'bg-[#163A5F] !text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {item.label}
                        </Link>
                      )
                            })}
                          </div>
                        </div>
                      ))}

                    {isSuperAdmin && !isTecnicoOT && (
                      <Link
                        href="/admin/empresas"
                        onNavigate={() => setIsMobileMenuOpen(false)}
                        style={isActiveRoute('/admin/empresas') ? { color: '#ffffff' } : undefined}
                        className={`flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-sm font-medium no-underline transition ${
                          isActiveRoute('/admin/empresas')
                            ? 'bg-[#163A5F] !text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                        }`}
                      >
                        Admin Empresas
                      </Link>
                    )}
                    </div>
                  </nav>
                  </div>
              )}
            </div>

            <div className="hidden px-4 py-4 sm:px-6 lg:block lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Tralixia</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {appTitle}
                  </h1>
                  <p className="mt-1 text-xs text-slate-400">
                    Desarrollado por RM Servicios de Ingenieria y Construccion
                  </p>
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
                      disabled={isOffline || empresasParaSelector.length === 0}
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
                      {usuarioNombre || usuarioEmail || "Usuario"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {usuarioRol || "Sin rol asignado"}
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
                Empresa activa:{" "}
                <span className="font-semibold text-slate-900">
                  {empresaActivaNombreVisual}
                </span>
              </div>
            </div>
          </header>

          <OfflineStatusBanner />

          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:overflow-visible print:px-0 print:py-0">
            {showOfflineRouteBlocked ? (
              <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                  Modo terreno activo
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-amber-950">
                  {showOtOfflineRouteBlocked ? 'Esta acción requiere conexión.' : 'Este módulo requiere conexión.'}
                </h2>
                <p className="mt-3 text-sm text-amber-800">
                  Solo puedes abrir módulos preparados para esta empresa y
                  usuario.
                </p>
                {terrainRegistry?.lastSafeRoute ? (
                  <Link
                    href={showOtOfflineRouteBlocked ? OT_ROUTE : terrainRegistry.lastSafeRoute}
                    className="mt-5 inline-flex rounded-2xl bg-[#163A5F] px-4 py-3 text-sm font-semibold text-white no-underline"
                  >
                    {showOtOfflineRouteBlocked
                      ? "Volver a OT"
                      : terrainRegistry?.lastModule
                        ? "Volver al último trabajo offline"
                        : "Volver a Partos"}
                  </Link>
                ) : (
                  <p className="mt-4 font-medium text-amber-950">
                    No hay módulos preparados para trabajo sin conexión. Conecta
                    a internet para preparar datos.
                  </p>
                )}
              </section>
            ) : isRouteAccessDenied ? (
              <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-amber-700">
                  Acceso restringido
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
                  No tienes acceso a este modulo
                </h2>
                <p className="mt-3 text-sm leading-6 text-amber-800">
                  El modulo solicitado no esta habilitado para la empresa activa
                  o tu rol no tiene permiso para acceder.
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Empresa activa:{" "}
                  <span className="font-semibold">
                    {empresaActivaNombreVisual}
                  </span>
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="rounded-2xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#245C90]"
                  >
                    Volver al dashboard
                  </Link>

                  {isOnline && isSuperAdmin && !isTecnicoOT && (
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
  );
}
