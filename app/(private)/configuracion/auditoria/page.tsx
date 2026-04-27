'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type AuditoriaRow = {
  id: string
  empresa_id: string | null
  actor_email: string | null
  actor_rol: string | null
  accion: string
  entidad: string
  entidad_id: string | null
  detalle: Record<string, unknown> | null
  created_at: string
}

type Empresa = {
  id: string
  nombre: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'

const ACCION_LABELS: Record<string, string> = {
  usuario_empresa_creado: 'Usuario asociado a empresa',
  usuario_rol_actualizado: 'Rol de usuario actualizado',
  usuario_activado: 'Usuario activado',
  usuario_desactivado: 'Usuario desactivado',

  invitacion_creada: 'Invitación creada',
  invitacion_aceptada: 'Invitación aceptada',
  invitacion_cancelada: 'Invitación cancelada',
  invitacion_estado_actualizado: 'Estado de invitación actualizado',
  invitacion_rol_actualizado: 'Rol de invitación actualizado',

  modulo_activado: 'Módulo activado',
  modulo_desactivado: 'Módulo desactivado',

  empresa_creada: 'Empresa creada',
  empresa_activada: 'Empresa activada',
  empresa_desactivada: 'Empresa desactivada',
}

function formatDateTimeCL(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function getAccionLabel(accion: string) {
  return ACCION_LABELS[accion] || accion
}

function getAccionTone(accion: string) {
  if (accion.includes('desactivado') || accion.includes('cancelada')) {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (accion.includes('activado') || accion.includes('creada') || accion.includes('aceptada')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (accion.includes('actualizado')) {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }

  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function detalleToText(detalle: Record<string, unknown> | null) {
  if (!detalle || Object.keys(detalle).length === 0) return 'Sin detalle adicional.'

  return Object.entries(detalle)
    .map(([key, value]) => {
      const valueText =
        value === null || value === undefined
          ? '-'
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)

      return `${key}: ${valueText}`
    })
    .join(' · ')
}

function Kpi({
  title,
  value,
  tone = 'slate',
}: {
  title: string
  value: string
  tone?: 'emerald' | 'blue' | 'amber' | 'slate'
}) {
  const className = {
    emerald: 'text-emerald-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    slate: 'text-slate-900',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className={`mt-2 text-xl font-semibold ${className}`}>{value}</p>
    </div>
  )
}

export default function ConfiguracionAuditoriaPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [items, setItems] = useState<AuditoriaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [puedeAdministrar, setPuedeAdministrar] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [accionFiltro, setAccionFiltro] = useState('todas')
  const [error, setError] = useState('')

  const getEmpresaActivaId = () => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_ID_KEY) || ''
  }

  const loadData = async (empresaActivaId?: string) => {
    const empresaActualId = empresaActivaId || getEmpresaActivaId()

    setEmpresaId(empresaActualId)

    if (!empresaActualId) {
      setEmpresa(null)
      setItems([])
      setPuedeAdministrar(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session?.user) {
        setPuedeAdministrar(false)
        setEmpresa(null)
        setItems([])
        return
      }

      const { data: allowedData, error: allowedError } = await supabase.rpc(
        'puede_administrar_empresa',
        { p_empresa_id: empresaActualId }
      )

      if (allowedError) throw new Error(allowedError.message)

      const allowed = Boolean(allowedData)

      setPuedeAdministrar(allowed)

      if (!allowed) {
        setEmpresa(null)
        setItems([])
        return
      }

      const [empresaResp, auditoriaResp] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre')
          .eq('id', empresaActualId)
          .maybeSingle(),

        supabase
          .from('auditoria_admin')
          .select('id, empresa_id, actor_email, actor_rol, accion, entidad, entidad_id, detalle, created_at')
          .eq('empresa_id', empresaActualId)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (empresaResp.error) throw new Error(empresaResp.error.message)
      if (auditoriaResp.error) throw new Error(auditoriaResp.error.message)

      setEmpresa((empresaResp.data || null) as Empresa | null)
      setItems((auditoriaResp.data || []) as AuditoriaRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()

    const handleEmpresaActivaCambiada = () => {
      void loadData()
    }

    window.addEventListener('empresa-activa-cambiada', handleEmpresaActivaCambiada)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', handleEmpresaActivaCambiada)
    }
  }, [])

  const accionesDisponibles = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.accion)))
    return unique.sort((a, b) => getAccionLabel(a).localeCompare(getAccionLabel(b)))
  }, [items])

  const itemsFiltrados = useMemo(() => {
    const q = normalize(busqueda)

    return items.filter((item) => {
      if (accionFiltro !== 'todas' && item.accion !== accionFiltro) return false

      if (!q) return true

      return [
        item.actor_email,
        item.actor_rol,
        item.accion,
        getAccionLabel(item.accion),
        item.entidad,
        detalleToText(item.detalle),
      ]
        .map(normalize)
        .join(' ')
        .includes(q)
    })
  }, [items, busqueda, accionFiltro])

  const invitaciones = items.filter((item) => item.accion.includes('invitacion')).length
  const usuarios = items.filter((item) => item.accion.includes('usuario')).length
  const modulos = items.filter((item) => item.accion.includes('modulo')).length

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando auditoría de la empresa activa...</p>
        </section>
      </main>
    )
  }

  if (!empresaId) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No hay empresa activa seleccionada.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Selecciona una empresa en el selector superior para revisar su auditoría.
          </p>
        </section>
      </main>
    )
  }

  if (!puedeAdministrar) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para ver la auditoría de esta empresa.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Solo un usuario con rol admin de la empresa activa puede revisar este historial.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Configuración de empresa
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Auditoría administrativa
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Historial de cambios administrativos realizados sobre usuarios, invitaciones,
            módulos y configuración de la empresa activa.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Empresa:{' '}
            <span className="font-semibold text-slate-900">
              {empresa?.nombre || empresaId}
            </span>
          </p>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Kpi title="Registros" value={String(items.length)} />
        <Kpi title="Usuarios" value={String(usuarios)} tone="emerald" />
        <Kpi title="Invitaciones" value={String(invitaciones)} tone="amber" />
        <Kpi title="Módulos" value={String(modulos)} tone="blue" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipo de acción
            </label>
            <select
              value={accionFiltro}
              onChange={(event) => setAccionFiltro(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todas">Todas</option>
              {accionesDisponibles.map((accion) => (
                <option key={accion} value={accion}>
                  {getAccionLabel(accion)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por usuario, acción, rol, entidad o detalle"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Usuario actor</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Entidad</th>
                  <th className="px-4 py-3">Detalle</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No hay registros de auditoría para mostrar.
                    </td>
                  </tr>
                ) : (
                  itemsFiltrados.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDateTimeCL(item.created_at)}
                      </td>

                      <td className="min-w-[220px] px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {item.actor_email || 'Sistema'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.actor_rol || 'Sin rol'}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAccionTone(item.accion)}`}
                        >
                          {getAccionLabel(item.accion)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {item.entidad}
                      </td>

                      <td className="min-w-[360px] px-4 py-3 text-xs leading-5 text-slate-600">
                        {detalleToText(item.detalle)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Se muestran los últimos 100 registros de la empresa activa.
        </p>
      </section>
    </main>
  )
}