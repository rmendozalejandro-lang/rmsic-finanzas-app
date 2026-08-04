'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../components/ProtectedModuleRoute'
import { OTDataTable } from '../../../components/ot/ot-data-table'
import { supabase } from '../../../lib/supabase/client'
import type { OTResumen } from '../../../lib/ot/types'
import { addOTOfflineDraft, findCachedOTDetail, readOTOfflineCache, otHasPendingLocalChanges, type OTOfflineDetail, type OTOfflineDraft } from '../../../lib/offline/ot'

const STORAGE_ID_KEY = 'empresa_activa_id'

type OTRecord = OTResumen & Record<string, unknown>

function valueToString(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function pickStringValue(ot: OTResumen, keys: string[]) {
  const record = ot as OTRecord

  for (const key of keys) {
    const value = valueToString(record[key]).trim()

    if (value) {
      return value
    }
  }

  return ''
}


function offlineValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function OfflineInfoItem({ label, value }: { label: string; value: unknown }) {
  const text = offlineValue(value) || 'No disponible'

  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">{text}</dd>
    </div>
  )
}

function OfflineTextSection({ title, value }: { title: string; value: unknown }) {
  const text = offlineValue(value)
  if (!text) return null

  return (
    <div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-600">{text}</p>
    </div>
  )
}

function buildOfflineEquipoResumen(detail: OTOfflineDetail) {
  const parts = [
    offlineValue(detail.equipo_tag),
    offlineValue(detail.equipo_nombre),
    offlineValue(detail.equipo_descripcion),
  ].filter(Boolean)

  return parts.join(' - ')
}

function buildOfflineEquipoUbicacion(detail: OTOfflineDetail) {
  return [
    offlineValue(detail.equipo_planta),
    offlineValue(detail.equipo_area),
    offlineValue(detail.equipo_linea),
    offlineValue(detail.equipo_ubicacion),
  ].filter(Boolean).join(' / ')
}

function buildOfflineEquipoCaracteristicas(detail: OTOfflineDetail) {
  return [
    offlineValue(detail.equipo_tipo),
    offlineValue(detail.equipo_marca),
    offlineValue(detail.equipo_modelo),
    offlineValue(detail.equipo_serie),
    offlineValue(detail.equipo_potencia),
  ].filter(Boolean).join(' / ')
}

function offlineBooleanLabel(value: unknown) {
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  return 'No disponible'
}

function offlineMinutesLabel(value: unknown) {
  const text = offlineValue(value)
  return text ? `${text} min` : 'No disponible'
}

function getOfflineArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
}

function getOfflineRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function buildAssociatedEquipoTitle(equipoAsociado: Record<string, unknown>) {
  const equipo = getOfflineRecord(equipoAsociado.equipo)
  return [offlineValue(equipo.tag), offlineValue(equipo.nombre), offlineValue(equipo.descripcion)]
    .filter(Boolean)
    .join(' - ') || `Equipo asociado ${offlineValue(equipoAsociado.orden) || ''}`.trim()
}

function buildAssociatedEquipoUbicacion(equipoAsociado: Record<string, unknown>) {
  const equipo = getOfflineRecord(equipoAsociado.equipo)
  return [offlineValue(equipo.planta), offlineValue(equipo.area), offlineValue(equipo.linea), offlineValue(equipo.ubicacion)]
    .filter(Boolean)
    .join(' / ')
}

function buildAssociatedEquipoTecnico(equipoAsociado: Record<string, unknown>) {
  const equipo = getOfflineRecord(equipoAsociado.equipo)
  return [offlineValue(equipo.tipo_equipo), offlineValue(equipo.marca), offlineValue(equipo.modelo), offlineValue(equipo.serie), offlineValue(equipo.potencia)]
    .filter(Boolean)
    .join(' / ')
}

function normalizarFechaFiltro(fecha: string) {
  if (!fecha) return ''

  return fecha.slice(0, 10)
}

function obtenerFechaOt(ot: OTResumen) {
  return pickStringValue(ot, [
    'fecha_inicio',
    'fecha_inicio_servicio',
    'fecha_servicio',
    'fecha_programada',
    'fecha_cierre',
    'fecha_ot',
    'fecha',
    'created_at',
  ])
}

function obtenerClienteId(ot: OTResumen) {
  return pickStringValue(ot, [
    'cliente_id',
    'clienteId',
    'cliente_nombre',
    'cliente_razon_social',
    'razon_social_cliente',
    'nombre_cliente',
    'cliente',
  ])
}

function obtenerClienteNombre(ot: OTResumen) {
  return (
    pickStringValue(ot, [
      'cliente_nombre',
      'cliente_razon_social',
      'razon_social_cliente',
      'nombre_cliente',
      'cliente',
      'razon_social',
      'nombre_fantasia',
    ]) || 'Sin cliente'
  )
}


async function enriquecerOtsConEstadoTecnicoYEquipos(otsData: OTResumen[]) {
  const ids = otsData.map((ot) => ot.id).filter(Boolean)

  if (ids.length === 0) return otsData

  const [estadoTecnicoResp, equiposResp] = await Promise.all([
    supabase
      .from('ot_ordenes_trabajo')
      .select('id, finalizado_tecnico_at, permitir_edicion_tecnico')
      .in('id', ids),
    supabase
      .from('ot_orden_equipos')
      .select('ot_id, activo')
      .in('ot_id', ids)
      .eq('activo', true),
  ])

  const estadoTecnicoMap = new Map<string, Record<string, unknown>>()
  const equiposCountMap = new Map<string, number>()

  if (!estadoTecnicoResp.error) {
    ;(estadoTecnicoResp.data ?? []).forEach((row) => {
      const record = row as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id : ''
      if (id) estadoTecnicoMap.set(id, record)
    })
  }

  if (!equiposResp.error) {
    ;(equiposResp.data ?? []).forEach((row) => {
      const record = row as Record<string, unknown>
      const otId = typeof record.ot_id === 'string' ? record.ot_id : ''
      if (otId) equiposCountMap.set(otId, (equiposCountMap.get(otId) ?? 0) + 1)
    })
  }

  return otsData.map((ot) => ({
    ...ot,
    ...(estadoTecnicoMap.get(ot.id) ?? {}),
    equipos_asociados_count: equiposCountMap.get(ot.id) ?? 0,
  })) as OTResumen[]
}

function OTPageContent() {
  const [ots, setOts] = useState<OTResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [checkingRole, setCheckingRole] = useState(true)
  const [canManageTecnicos, setCanManageTecnicos] = useState(false)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [otIdsSeleccionadas, setOtIdsSeleccionadas] = useState<Set<string>>(new Set())
  const [generandoPdfLote, setGenerandoPdfLote] = useState(false)
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [currentUserId, setCurrentUserId] = useState('')
  const [selectedOfflineOtId, setSelectedOfflineOtId] = useState('')
  const [offlineDraft, setOfflineDraft] = useState<OTOfflineDraft>({
    observacion_terreno: '',
    estado_local_avance: '',
    checklist_local: {},
    notas_internas_ejecucion: '',
  })
  const [offlineDraftSuccess, setOfflineDraftSuccess] = useState('')
  const [offlinePendingRefresh, setOfflinePendingRefresh] = useState(0)

  const [empresaActivaId, setEmpresaActivaId] = useState(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_ID_KEY) || '' : ''
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncEmpresaActiva = () => {
      const nextEmpresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''

      setEmpresaActivaId((prevEmpresaId) =>
        prevEmpresaId === nextEmpresaId ? prevEmpresaId : nextEmpresaId
      )
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_ID_KEY || event.key === null) {
        syncEmpresaActiva()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncEmpresaActiva()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', syncEmpresaActiva)
    window.addEventListener('empresa-activa-change', syncEmpresaActiva)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // El cambio de empresa ocurre en el mismo tab, y el evento storage no se dispara
    // en el mismo documento. Este respaldo evita que el usuario tenga que refrescar.
    const intervalId = window.setInterval(syncEmpresaActiva, 750)

    syncEmpresaActiva()

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', syncEmpresaActiva)
      window.removeEventListener('empresa-activa-change', syncEmpresaActiva)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    setFiltroCliente('')
    setFechaDesde('')
    setFechaHasta('')
    setOtIdsSeleccionadas(new Set())
    setSelectedOfflineOtId('')
    setOfflineDraftSuccess('')
  }, [empresaActivaId])

  useEffect(() => {
    const syncNetwork = () => setIsOffline(!navigator.onLine)
    window.addEventListener('online', syncNetwork)
    window.addEventListener('offline', syncNetwork)
    syncNetwork()
    return () => {
      window.removeEventListener('online', syncNetwork)
      window.removeEventListener('offline', syncNetwork)
    }
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        setOts([])

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          throw new Error('No se pudo validar la sesión actual.')
        }

        if (!empresaActivaId) {
          throw new Error('No hay empresa activa seleccionada.')
        }

        const userId = session.user.id
        setCurrentUserId(userId)

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cache = readOTOfflineCache(empresaActivaId, userId)
          if (!cache || cache.ots.length === 0) {
            throw new Error('No hay OT preparadas para trabajar sin conexión.')
          }
          if (active) setOts(cache.ots)
          return
        }

        const { data: rolData, error: rolError } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', userId)
          .eq('empresa_id', empresaActivaId)
          .eq('activo', true)
          .maybeSingle()

        if (rolError) {
          throw new Error(`No se pudo validar el rol del usuario: ${rolError.message}`)
        }

        const currentRole = rolData?.rol || ''

        let otsData: OTResumen[] = []

        if (currentRole === 'tecnico_ot') {
          const { data: ownOtRows, error: ownOtError } = await supabase
            .from('ot_ordenes_trabajo')
            .select('id')
            .eq('empresa_id', empresaActivaId)
            .or(`tecnico_responsable_id.eq.${userId},created_by.eq.${userId}`)

          if (ownOtError) {
            throw new Error(`No se pudo cargar las OT del técnico: ${ownOtError.message}`)
          }

          const ownOtIds = (ownOtRows ?? []).map((item) => item.id).filter(Boolean)

          if (ownOtIds.length > 0) {
            const { data, error } = await supabase
              .from('ot_vw_resumen')
              .select('*')
              .in('id', ownOtIds)
              .order('created_at', { ascending: false })

            if (error) {
              throw new Error(`No se pudo cargar el listado OT: ${error.message}`)
            }

            otsData = (data ?? []) as OTResumen[]
          }
        } else {
          const { data, error } = await supabase
            .from('ot_vw_resumen')
            .select('*')
            .eq('empresa_id', empresaActivaId)
            .order('created_at', { ascending: false })

          if (error) {
            throw new Error(`No se pudo cargar el listado OT: ${error.message}`)
          }

          otsData = (data ?? []) as OTResumen[]
        }

        const otsEnriquecidas = await enriquecerOtsConEstadoTecnicoYEquipos(otsData)

        if (active) {
          setOts(otsEnriquecidas)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar las OT.'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [empresaActivaId])

  useEffect(() => {
    let active = true

    const resolveRole = async () => {
      try {
        setCheckingRole(true)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          if (active) {
            setCanManageTecnicos(false)
          }
          return
        }

        if (!empresaActivaId) {
          if (active) {
            setCanManageTecnicos(false)
          }
          return
        }

        const { data, error } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', session.user.id)
          .eq('empresa_id', empresaActivaId)
          .eq('activo', true)
          .maybeSingle()

        if (error) {
          if (active) {
            setCanManageTecnicos(false)
          }
          return
        }

        const rol = data?.rol || ''

        if (active) {
          setCanManageTecnicos(rol !== 'tecnico_ot')
        }
      } finally {
        if (active) {
          setCheckingRole(false)
        }
      }
    }

    void resolveRole()

    return () => {
      active = false
    }
  }, [empresaActivaId])

  const clientesFiltro = useMemo(() => {
    const mapaClientes = new Map<string, string>()

    ots.forEach((ot) => {
      const clienteId = obtenerClienteId(ot)
      const clienteNombre = obtenerClienteNombre(ot)
      const key = clienteId || clienteNombre

      if (key && !mapaClientes.has(key)) {
        mapaClientes.set(key, clienteNombre)
      }
    })

    return Array.from(mapaClientes.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [ots])

  const otsFiltradas = useMemo(() => {
    return ots.filter((ot) => {
      const clienteOt = obtenerClienteId(ot) || obtenerClienteNombre(ot)
      const fechaOt = normalizarFechaFiltro(obtenerFechaOt(ot))

      if (filtroCliente && clienteOt !== filtroCliente) {
        return false
      }

      if (fechaDesde && (!fechaOt || fechaOt < fechaDesde)) {
        return false
      }

      if (fechaHasta && (!fechaOt || fechaOt > fechaHasta)) {
        return false
      }

      return true
    })
  }, [ots, filtroCliente, fechaDesde, fechaHasta])

  useEffect(() => {
    setOtIdsSeleccionadas((prev) => {
      const idsVisibles = new Set(otsFiltradas.map((ot) => ot.id))
      const next = new Set<string>()

      prev.forEach((id) => {
        if (idsVisibles.has(id)) {
          next.add(id)
        }
      })

      if (next.size === prev.size && Array.from(next).every((id) => prev.has(id))) {
        return prev
      }

      return next
    })
  }, [otsFiltradas])

  const filtrosActivos = Boolean(filtroCliente || fechaDesde || fechaHasta)
  const otsConPendiente = useMemo(
    () => {
      void offlinePendingRefresh
      return new Set(ots.map((ot) => otHasPendingLocalChanges(empresaActivaId, currentUserId, ot.id) ? ot.id : '').filter(Boolean))
    },
    [empresaActivaId, currentUserId, offlinePendingRefresh, ots]
  )

  const selectedOfflineOt = useMemo(() => {
    if (!selectedOfflineOtId) return null
    return ots.find((ot) => ot.id === selectedOfflineOtId) ?? null
  }, [ots, selectedOfflineOtId])

  const selectedOfflineDetail = useMemo<OTOfflineDetail | null>(() => {
    if (!selectedOfflineOtId || !empresaActivaId || !currentUserId) return null
    return findCachedOTDetail(empresaActivaId, currentUserId, selectedOfflineOtId)
  }, [empresaActivaId, currentUserId, selectedOfflineOtId])

  const selectOfflineOt = (otId: string) => {
    const detail = findCachedOTDetail(empresaActivaId, currentUserId, otId)
    setSelectedOfflineOtId(otId)
    setOfflineDraftSuccess('')

    try {
      const draftRaw = window.localStorage.getItem(`tralixia_ot_draft_${empresaActivaId}_${currentUserId}_${otId}`)
      setOfflineDraft(draftRaw ? JSON.parse(draftRaw) as OTOfflineDraft : {
        observacion_terreno: '',
        estado_local_avance: '',
        checklist_local: {},
        notas_internas_ejecucion: '',
      })
    } catch {
      setOfflineDraft({
        observacion_terreno: '',
        estado_local_avance: '',
        checklist_local: {},
        notas_internas_ejecucion: '',
      })
    }

    if (!detail) {
      setError('Esta OT no tiene detalle offline preparado. Vuelve a sincronizar con conexión.')
    }
  }

  const volverAlListadoOffline = () => {
    setSelectedOfflineOtId('')
    setOfflineDraftSuccess('')
  }

  const guardarAvanceOffline = () => {
    if (!selectedOfflineDetail || !currentUserId) return

    window.localStorage.setItem(
      `tralixia_ot_draft_${selectedOfflineDetail.empresa_id}_${currentUserId}_${selectedOfflineDetail.id}`,
      JSON.stringify(offlineDraft),
    )
    addOTOfflineDraft({
      empresa_id: selectedOfflineDetail.empresa_id,
      user_id: currentUserId,
      ot_id: selectedOfflineDetail.id,
      base_updated_at: selectedOfflineDetail.updated_at ?? null,
      ...offlineDraft,
    })
    setOfflinePendingRefresh((value) => value + 1)
    setOfflineDraftSuccess('Avance local guardado. Se sincronizará cuando vuelva la conexión.')
  }

  const totalAsignadas = useMemo(
    () =>
      otsFiltradas.filter((ot) => ot.estado_nombre?.toLowerCase() === 'asignada')
        .length,
    [otsFiltradas]
  )

  const totalEnProceso = useMemo(
    () =>
      otsFiltradas.filter((ot) => ot.estado_nombre?.toLowerCase() === 'en proceso')
        .length,
    [otsFiltradas]
  )

  const totalCerradas = useMemo(
    () => otsFiltradas.filter((ot) => ot.estado_nombre?.toLowerCase() === 'cerrada').length,
    [otsFiltradas]
  )

  const cantidadSeleccionadas = otIdsSeleccionadas.size

  const todasFiltradasSeleccionadas = useMemo(() => {
    return (
      otsFiltradas.length > 0 &&
      otsFiltradas.every((ot) => otIdsSeleccionadas.has(ot.id))
    )
  }, [otsFiltradas, otIdsSeleccionadas])

  const toggleSeleccionOt = (otId: string) => {
    setOtIdsSeleccionadas((prev) => {
      const next = new Set(prev)

      if (next.has(otId)) {
        next.delete(otId)
      } else {
        next.add(otId)
      }

      return next
    })
  }

  const seleccionarTodasFiltradas = () => {
    setOtIdsSeleccionadas(new Set(otsFiltradas.map((ot) => ot.id)))
  }

  const limpiarSeleccion = () => {
    setOtIdsSeleccionadas(new Set())
  }

  const limpiarFiltros = () => {
    setFiltroCliente('')
    setFechaDesde('')
    setFechaHasta('')
  }

  const imprimirOtSeleccionadas = async () => {
    const ids = Array.from(otIdsSeleccionadas)

    if (ids.length === 0) {
      alert('Selecciona una o más OT para generar el PDF.')
      return
    }

    try {
      setGenerandoPdfLote(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        throw new Error('No se pudo validar la sesión actual.')
      }

      const response = await fetch(
        `/api/ot-pdf-lote?ids=${encodeURIComponent(ids.join(','))}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        let message = 'No se pudo generar el PDF de OT seleccionadas.'

        if (contentType.includes('application/json')) {
          const body = await response.json()
          message = body?.error || message
        }

        throw new Error(message)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 60_000)
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el PDF de OT seleccionadas.'
      )
    } finally {
      setGenerandoPdfLote(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Órdenes de Trabajo
          </h1>
          {isOffline ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Modo terreno: listado preparado sin conexión. Cierre, firmas y PDF oficial requieren conexión.
            </p>
          ) : null}
          <p className="mt-1 text-sm text-slate-500">
            Gestiona las OT, revisa estados y controla el avance de los trabajos.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap md:w-auto">
          {!isOffline && canManageTecnicos && !checkingRole ? (
            <Link
              href="/ot/tecnicos"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto"
            >
              Técnicos OT
            </Link>
          ) : null}

          {!isOffline ? (
          <Link
            href="/ot/nueva"
            style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90] sm:w-auto"
          >
            Nueva OT
          </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-900">
            Filtros de búsqueda
          </h2>
          <p className="text-sm text-slate-500">
            Filtra las OT por cliente y rango de fechas para revisar servicios de un
            período específico.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cliente
            </label>
            <select
              value={filtroCliente}
              onChange={(event) => setFiltroCliente(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
            >
              <option value="">Todos los clientes</option>
              {clientesFiltro.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fecha desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fecha hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
          <p>
            Mostrando{' '}
            <span className="font-semibold text-slate-900">{otsFiltradas.length}</span>{' '}
            de <span className="font-semibold text-slate-900">{ots.length}</span> OT.{' '}
            <span className="font-semibold text-slate-900">{cantidadSeleccionadas}</span>{' '}
            seleccionada{cantidadSeleccionadas === 1 ? '' : 's'} para imprimir.
          </p>

          <div className="flex flex-wrap gap-2">
            {filtrosActivos ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Limpiar filtros
              </button>
            ) : null}

            <button
              type="button"
              onClick={seleccionarTodasFiltradas}
              disabled={otsFiltradas.length === 0 || todasFiltradasSeleccionadas}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Seleccionar filtradas
            </button>

            <button
              type="button"
              onClick={limpiarSeleccion}
              disabled={cantidadSeleccionadas === 0}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpiar selección
            </button>

            <button
              type="button"
              onClick={imprimirOtSeleccionadas}
              disabled={cantidadSeleccionadas === 0 || generandoPdfLote}
              className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generandoPdfLote
                ? 'Generando PDF...'
                : `Imprimir seleccionadas (${cantidadSeleccionadas})`}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total OT</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {otsFiltradas.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Asignadas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalAsignadas}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">En proceso</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalEnProceso}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cerradas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalCerradas}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando órdenes de trabajo...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : otsFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No se encontraron OT con los filtros seleccionados.
        </div>
      ) : isOffline ? (
          selectedOfflineOt && selectedOfflineDetail ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={volverAlListadoOffline}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Volver al listado OT
              </button>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide">Modo terreno OT</p>
                <h2 className="mt-2 text-2xl font-bold text-amber-950">
                  {String(selectedOfflineDetail.folio ?? selectedOfflineOt.folio ?? 'OT preparada')}
                </h2>
                <p className="mt-1 text-sm">Trabajo local en borrador. Cierre, firmas y PDF oficial requieren conexión.</p>
                {otsConPendiente.has(selectedOfflineOt.id) ? (
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold">Esta OT tiene cambios pendientes locales.</p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Datos generales</h3>
                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <OfflineInfoItem label="Folio" value={selectedOfflineDetail.folio ?? selectedOfflineOt.folio} />
                  <OfflineInfoItem label="Título" value={selectedOfflineDetail.titulo ?? selectedOfflineOt.titulo} />
                  <OfflineInfoItem label="Cliente" value={selectedOfflineDetail.cliente_nombre ?? selectedOfflineOt.cliente_nombre} />
                  <OfflineInfoItem label="Estado online cacheado" value={selectedOfflineDetail.estado_nombre ?? selectedOfflineOt.estado_nombre} />
                  <OfflineInfoItem label="Tipo de servicio" value={selectedOfflineDetail.tipo_servicio_nombre ?? selectedOfflineOt.tipo_servicio_nombre} />
                  <OfflineInfoItem label="Técnico responsable" value={selectedOfflineDetail.tecnico_nombre ?? selectedOfflineOt.tecnico_nombre} />
                  <OfflineInfoItem label="Fecha OT" value={offlineValue(selectedOfflineDetail.fecha_ot ?? selectedOfflineOt.fecha_ot).slice(0, 10)} />
                  <OfflineInfoItem label="Fecha programada" value={offlineValue(selectedOfflineDetail.fecha_programada ?? selectedOfflineOt.fecha_programada).slice(0, 10)} />
                  <OfflineInfoItem label="Contacto cliente" value={selectedOfflineDetail.contacto_cliente_nombre} />
                  <OfflineInfoItem label="Email contacto" value={selectedOfflineDetail.contacto_cliente_email} />
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Planificación / tiempos</h3>
                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <OfflineInfoItem label="OM cliente" value={selectedOfflineDetail.numero_om_cliente} />
                  <OfflineInfoItem label="Hora inicio" value={selectedOfflineDetail.hora_inicio} />
                  <OfflineInfoItem label="Hora término" value={selectedOfflineDetail.hora_termino} />
                  <OfflineInfoItem label="Duración" value={offlineMinutesLabel(selectedOfflineDetail.duracion_minutos)} />
                  <OfflineInfoItem label="Cantidad técnicos" value={selectedOfflineDetail.cantidad_tecnicos} />
                  <OfflineInfoItem label="Horas hombre" value={selectedOfflineDetail.horas_hombre_utilizadas} />
                  <OfflineInfoItem label="Supervisor contratista" value={selectedOfflineDetail.supervisor_contratista_nombre} />
                  <OfflineInfoItem label="Cargo supervisor" value={selectedOfflineDetail.supervisor_contratista_cargo} />
                </dl>
                <div className="mt-5 space-y-3 text-sm">
                  {getOfflineArray(selectedOfflineDetail.tiempos_trabajo).length > 0 ? (
                    getOfflineArray(selectedOfflineDetail.tiempos_trabajo).map((tiempo, index) => (
                      <div key={`${offlineValue(tiempo.fecha)}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-800">Registro de tiempo {index + 1}</p>
                        <p className="mt-1 text-slate-600">{offlineValue(tiempo.fecha).slice(0, 10) || 'Sin fecha'} · {offlineValue(tiempo.hora_inicio) || '--:--'} - {offlineValue(tiempo.hora_termino) || '--:--'} · {offlineMinutesLabel(tiempo.duracion_minutos)}</p>
                        <p className="mt-1 text-slate-600">Tipo: {offlineValue(tiempo.tipo_tiempo) || 'No disponible'}</p>
                        {offlineValue(tiempo.observacion) ? <p className="mt-1 whitespace-pre-wrap text-slate-600">{offlineValue(tiempo.observacion)}</p> : null}
                      </div>
                    ))
                  ) : <p className="text-slate-500">No hay registros de tiempo preparados offline.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Seguridad / condiciones de trabajo</h3>
                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                  <OfflineInfoItem label="Permiso de trabajo" value={offlineBooleanLabel(selectedOfflineDetail.seguridad_permiso_trabajo)} />
                  <OfflineInfoItem label="Uso EPP" value={offlineBooleanLabel(selectedOfflineDetail.seguridad_uso_epp)} />
                  <OfflineInfoItem label="Bloqueo / tarjeta" value={offlineBooleanLabel(selectedOfflineDetail.seguridad_bloqueo_tarjeta)} />
                </dl>
                <div className="mt-4 grid gap-4 text-sm">
                  <OfflineTextSection title="Observación seguridad" value={selectedOfflineDetail.seguridad_observacion} />
                  <OfflineTextSection title="Recomendaciones seguridad" value={selectedOfflineDetail.recomendaciones_seguridad} />
                  <OfflineTextSection title="Herramientas / materiales utilizados" value={selectedOfflineDetail.herramientas_materiales_utilizados} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Desarrollo técnico</h3>
                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <OfflineInfoItem label="Alcance ejecutado" value={offlineBooleanLabel(selectedOfflineDetail.alcance_trabajo_ejecutado)} />
                  <OfflineInfoItem label="Ejecutado según programa" value={offlineBooleanLabel(selectedOfflineDetail.ejecutado_segun_programa)} />
                  <OfflineInfoItem label="Área de trabajo" value={selectedOfflineDetail.area_trabajo} />
                  <OfflineInfoItem label="Prioridad" value={selectedOfflineDetail.prioridad} />
                </dl>
                <div className="mt-4 grid gap-4 text-sm">
                  <OfflineTextSection title="Descripción de la solicitud" value={selectedOfflineDetail.descripcion_solicitud} />
                  <OfflineTextSection title="Problema reportado" value={selectedOfflineDetail.problema_reportado} />
                  <OfflineTextSection title="Diagnóstico" value={selectedOfflineDetail.diagnostico} />
                  <OfflineTextSection title="Causa probable" value={selectedOfflineDetail.causa_probable} />
                  <OfflineTextSection title="Trabajo realizado" value={selectedOfflineDetail.trabajo_realizado} />
                  <OfflineTextSection title="Resultado servicio" value={selectedOfflineDetail.resultado_servicio} />
                  <OfflineTextSection title="Hallazgos" value={selectedOfflineDetail.hallazgos} />
                  <OfflineTextSection title="Conclusiones técnicas" value={selectedOfflineDetail.conclusiones_tecnicas} />
                  <OfflineTextSection title="Recomendaciones" value={selectedOfflineDetail.recomendaciones} />
                  <OfflineTextSection title="Observación alcance" value={selectedOfflineDetail.alcance_trabajo_observacion} />
                  <OfflineTextSection title="Observación programa" value={selectedOfflineDetail.ejecutado_segun_programa_observacion} />
                  <OfflineTextSection title="Observaciones cierre" value={selectedOfflineDetail.observaciones_cierre} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Equipos asociados</h3>
                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <OfflineInfoItem label="Equipo principal / TAG" value={buildOfflineEquipoResumen(selectedOfflineDetail) || selectedOfflineOt.equipo_tag} />
                  <OfflineInfoItem label="Ubicación equipo" value={buildOfflineEquipoUbicacion(selectedOfflineDetail)} />
                  <OfflineInfoItem label="Características equipo" value={buildOfflineEquipoCaracteristicas(selectedOfflineDetail)} />
                </dl>
                <div className="mt-5 space-y-3 text-sm">
                  {getOfflineArray(selectedOfflineDetail.equipos_asociados).length > 0 ? (
                    getOfflineArray(selectedOfflineDetail.equipos_asociados).map((equipo, index) => (
                      <div key={`${offlineValue(equipo.equipo_id)}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-800">{buildAssociatedEquipoTitle(equipo)}</p>
                        <p className="mt-1 text-slate-600">Ubicación: {buildAssociatedEquipoUbicacion(equipo) || 'No disponible'}</p>
                        <p className="mt-1 text-slate-600">Características: {buildAssociatedEquipoTecnico(equipo) || 'No disponible'}</p>
                        <OfflineTextSection title="Descripción trabajo" value={equipo.descripcion_trabajo} />
                        <OfflineTextSection title="Observación" value={equipo.observacion} />
                      </div>
                    ))
                  ) : <p className="text-slate-500">No hay equipos asociados preparados offline.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Checklist / plantilla</h3>
                <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <OfflineInfoItem label="Checklist requerido" value={selectedOfflineDetail.requiere_checklist ? 'Sí' : 'No'} />
                  <OfflineInfoItem label="Plantilla checklist" value={selectedOfflineDetail.plantilla_checklist_id} />
                </dl>
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Checklist completo requiere conexión. Checklist offline avanzado se implementará en OFF-OT-02.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Avance local de terreno</h3>
                {offlineDraftSuccess ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{offlineDraftSuccess}</p>
                ) : null}
                <div className="mt-4 grid gap-4">
                  <label className="text-sm font-medium text-slate-700">Observación de terreno<textarea rows={3} value={offlineDraft.observacion_terreno} onChange={(event) => setOfflineDraft((prev) => ({ ...prev, observacion_terreno: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                  <label className="text-sm font-medium text-slate-700">Estado local de avance<select value={offlineDraft.estado_local_avance} onChange={(event) => setOfflineDraft((prev) => ({ ...prev, estado_local_avance: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"><option value="">Seleccionar</option><option value="iniciado">Iniciado</option><option value="en_proceso">En proceso</option><option value="pausado">Pausado</option><option value="listo_para_revision_online">Listo para revisión online</option></select></label>
                  {selectedOfflineDetail.requiere_checklist ? <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={Boolean(offlineDraft.checklist_local.revision_general)} onChange={(event) => setOfflineDraft((prev) => ({ ...prev, checklist_local: { ...prev.checklist_local, revision_general: event.target.checked } }))} /> Checklist local revisado en terreno</label> : null}
                  <label className="text-sm font-medium text-slate-700">Notas internas de ejecución<textarea rows={3} value={offlineDraft.notas_internas_ejecucion} onChange={(event) => setOfflineDraft((prev) => ({ ...prev, notas_internas_ejecucion: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={guardarAvanceOffline} className="rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white">Guardar avance local</button>
                  <button type="button" onClick={() => alert('Esta acción requiere conexión.')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cerrar / firmar / PDF oficial</button>
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              {otsFiltradas.map((ot) => (
                <button key={ot.id} type="button" onClick={() => selectOfflineOt(ot.id)} className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-900 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{ot.folio || 'OT preparada'}</p>
                      <h3 className="mt-1 text-lg font-semibold">{ot.titulo}</h3>
                      <p className="mt-1 text-sm text-slate-600">{ot.cliente_nombre || 'Sin cliente'} · {ot.estado_nombre || 'Estado no disponible'}</p>
                    </div>
                    {otsConPendiente.has(ot.id) ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pendiente local</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
        <OTDataTable
          data={otsFiltradas}
          selectable
          selectedIds={otIdsSeleccionadas}
          allRowsSelected={todasFiltradasSeleccionadas}
          onToggleSelect={toggleSeleccionOt}
          onToggleSelectAll={
            todasFiltradasSeleccionadas ? limpiarSeleccion : seleccionarTodasFiltradas
          }
        />
        )
      }
    </div>
  )
}

export default function OTPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot" allowOfflineTerrainAccess>
      <OTPageContent />
    </ProtectedModuleRoute>
  )
}
