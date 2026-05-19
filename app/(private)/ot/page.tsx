'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../components/ProtectedModuleRoute'
import { OTDataTable } from '../../../components/ot/ot-data-table'
import { supabase } from '../../../lib/supabase/client'
import type { OTResumen } from '../../../lib/ot/types'

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

function OTPageContent() {
  const [ots, setOts] = useState<OTResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [checkingRole, setCheckingRole] = useState(true)
  const [canManageTecnicos, setCanManageTecnicos] = useState(false)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          throw new Error('No se pudo validar la sesión actual.')
        }

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(STORAGE_ID_KEY) || ''
            : ''

        if (!empresaActivaId) {
          throw new Error('No hay empresa activa seleccionada.')
        }

        const userId = session.user.id

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

        if (active) {
          setOts(otsData)
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
  }, [])

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

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(STORAGE_ID_KEY) || ''
            : ''

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
  }, [])

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

  const filtrosActivos = Boolean(filtroCliente || fechaDesde || fechaHasta)

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
    () =>
      otsFiltradas.filter((ot) => ot.estado_nombre?.toLowerCase() === 'cerrada').length,
    [otsFiltradas]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Órdenes de Trabajo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona las OT, revisa estados y controla el avance de los trabajos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageTecnicos && !checkingRole ? (
            <Link
              href="/ot/tecnicos"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Técnicos OT
            </Link>
          ) : null}

          <Link
            href="/ot/nueva"
            style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
            className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90]"
          >
            Nueva OT
          </Link>
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

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            Mostrando{' '}
            <span className="font-semibold text-slate-900">{otsFiltradas.length}</span>{' '}
            de <span className="font-semibold text-slate-900">{ots.length}</span> OT.
          </p>

          {filtrosActivos ? (
            <button
              type="button"
              onClick={() => {
                setFiltroCliente('')
                setFechaDesde('')
                setFechaHasta('')
              }}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Limpiar filtros
            </button>
          ) : null}
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
      ) : (
        <OTDataTable data={otsFiltradas} />
      )}
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
