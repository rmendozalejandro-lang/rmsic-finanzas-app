'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../components/ProtectedModuleRoute'
import { OTDataTable } from '../../../components/ot/ot-data-table'
import { supabase } from '../../../lib/supabase/client'
import type { OTResumen } from '../../../lib/ot/types'
import { readOTOfflineCache, otHasPendingLocalChanges } from '../../../lib/offline/ot'

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
    () => new Set(ots.map((ot) => otHasPendingLocalChanges(empresaActivaId, currentUserId, ot.id) ? ot.id : '').filter(Boolean)),
    [empresaActivaId, currentUserId, ots]
  )

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
          <div className="space-y-3">
            {otsFiltradas.map((ot) => (
              <Link key={ot.id} href={`/ot/${ot.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 no-underline shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{ot.folio || 'OT preparada'}</p>
                    <h3 className="mt-1 text-lg font-semibold">{ot.titulo}</h3>
                    <p className="mt-1 text-sm text-slate-600">{ot.cliente_nombre || 'Sin cliente'} · {ot.estado_nombre || 'Estado no disponible'}</p>
                  </div>
                  {otsConPendiente.has(ot.id) ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pendiente local</span> : null}
                </div>
              </Link>
            ))}
          </div>
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
    <ProtectedModuleRoute moduleKey="ot">
      <OTPageContent />
    </ProtectedModuleRoute>
  )
}
