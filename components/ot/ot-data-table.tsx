'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { OTResumen } from '../../lib/ot/types'
import { isOTOfflineOperative } from '../../lib/offline/ot'

const OT_LIST_CONTEXT_KEY = 'tralixia:ot:list-context'
const OT_LIST_CONTEXT_TTL_MS = 30 * 60 * 1000

const EMPTY_ADVANCED_FILTERS = {
  estado: '',
  tipo: '',
  tecnico: '',
}

type Props = {
  data: OTResumen[]
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  allRowsSelected?: boolean
  onToggleSelect?: (otId: string) => void
  onToggleSelectAll?: () => void
  offlinePreparedIds?: ReadonlySet<string>
}

type OTResumenConPlantilla = OTResumen & {
  plantilla_id?: string | null
  plantilla_codigo?: string | null
  plantilla_nombre?: string | null
  plantilla_vista_principal?: string | null
  plantilla_ruta_principal?: string | null
  plantilla_ruta_base?: string | null
  plantilla_ruta_pdf?: string | null
  plantilla_requiere_equipo?: boolean | null
  plantilla_usa_equipos_multiples?: boolean | null
  plantilla_usa_checklist?: boolean | null
  plantilla_checklist_codigo?: string | null
  plantilla_informe_codigo?: string | null
  tipo_equipo_permitido?: string | null
  finalizado_tecnico_at?: string | null
  permitir_edicion_tecnico?: boolean | null
  equipos_asociados_count?: number | null
}

type OTListFilters = {
  cliente: string
  fechaDesde: string
  fechaHasta: string
}

type OTAdvancedFilters = {
  estado: string
  tipo: string
  tecnico: string
}

type OTListContext = {
  otId: string
  empresaId: string
  scrollY: number
  savedAt: number
  filters?: OTListFilters
  advancedFilters?: OTAdvancedFilters
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'

  const dateOnly = value.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)

  if (match) {
    return `${match[3]}/${match[2]}/${match[1].slice(2)}`
  }

  return value
}

function formatDateTimeAsChile(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatDateOnly(value)

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Santiago',
  }).format(date)
}

function formatServiceDate(ot: OTResumen) {
  if (ot.hora_inicio) return formatDateTimeAsChile(ot.hora_inicio)
  return formatDateOnly(ot.fecha_ot)
}

function getServiceDateSortValue(ot: OTResumen) {
  if (ot.hora_inicio) {
    const timestamp = new Date(ot.hora_inicio).getTime()
    if (!Number.isNaN(timestamp)) return timestamp
  }

  const dateOnly = ot.fecha_ot?.slice(0, 10)
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const timestamp = Date.parse(`${dateOnly}T12:00:00Z`)
    if (!Number.isNaN(timestamp)) return timestamp
  }

  const createdTimestamp = new Date(ot.created_at).getTime()
  return Number.isNaN(createdTimestamp) ? 0 : createdTimestamp
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '-'

  const horas = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (horas === 0) return `${mins} min`
  if (mins === 0) return `${horas} h`

  return `${horas} h ${mins} min`
}

function labelOrDash(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'
  return value
}

function buildOtMainHref(ot: OTResumenConPlantilla) {
  // La acción principal del listado debe abrir la OT para trabajarla.
  // El informe final queda disponible dentro del detalle, una vez revisado/cerrado.
  return `/ot/${ot.id}`
}

function buildOtActionLabel(_ot: OTResumenConPlantilla) {
  return 'Trabajar OT'
}

function toTitleCase(text: string) {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function buildEquipoSubtitle(ot: OTResumen) {
  const descripcion = ot.equipo_nombre || ot.equipo_descripcion || ''
  const ubicacion = [
    ot.equipo_planta,
    ot.equipo_area,
    ot.equipo_linea,
    ot.equipo_ubicacion,
  ]
    .filter(Boolean)
    .join(' / ')

  if (descripcion && ubicacion) return `${descripcion} · ${ubicacion}`
  return descripcion || ubicacion || ''
}

function humanizePerson(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'

  const raw = value.trim()
  const lower = raw.toLowerCase()

  const knownMap: Record<string, string> = {
    'rmendoza@rmsic.cl': 'Raúl Mendoza',
    'dallendes@rmsic.cl': 'David Allendes',
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raul mendoza': 'Raúl Mendoza',
    'raúl mendoza': 'Raúl Mendoza',
    'raul mendoza c.': 'Raúl Mendoza',
    'raúl mendoza c.': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
    'david allendes a.': 'David Allendes',
    'rmendoza': 'Raúl Mendoza',
    'dallendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raúl') && lower.includes('mendoza'))
  ) {
    return 'Raúl Mendoza'
  }

  if (lower.includes('dallendes') || (lower.includes('david') && lower.includes('allendes'))) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0].toLowerCase().trim()

    if (knownMap[localPart]) return knownMap[localPart]

    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function priorityBadgeClass(priority: string | null | undefined) {
  switch ((priority || '').toLowerCase()) {
    case 'critica':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'alta':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'media':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'baja':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function estadoBadgeClass(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'cerrada':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'en proceso':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'asignada':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'cancelada':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function isSoftysMultiEquipoFlow(ot: OTResumenConPlantilla) {
  const codigo = (ot.plantilla_codigo || '').toLowerCase()
  const informeCodigo = (ot.plantilla_informe_codigo || '').toLowerCase()
  const checklistCodigo = (ot.plantilla_checklist_codigo || '').toLowerCase()
  const tipoEquipo = (ot.tipo_equipo_permitido || '').toLowerCase()

  return Boolean(
    ot.plantilla_usa_equipos_multiples ||
      codigo.includes('softys') ||
      informeCodigo.includes('softys') ||
      checklistCodigo.includes('softys') ||
      ['motor', 'valvula', 'valvula_control'].includes(tipoEquipo)
  )
}

function buildEquipoResumen(ot: OTResumenConPlantilla) {
  if (ot.equipo_tag) {
    return {
      titulo: labelOrDash(ot.equipo_tag),
      subtitulo: buildEquipoSubtitle(ot),
      neutral: false,
    }
  }

  const totalEquipos = Number(ot.equipos_asociados_count || 0)

  if (totalEquipos > 0) {
    return {
      titulo: `${totalEquipos} equipo${totalEquipos === 1 ? '' : 's'} asociado${totalEquipos === 1 ? '' : 's'}`,
      subtitulo: 'Ver detalle de equipos en la OT/OM',
      neutral: true,
    }
  }

  if (isSoftysMultiEquipoFlow(ot)) {
    return {
      titulo: 'Equipos por asociar',
      subtitulo: 'Se cargan en planificación de la OM',
      neutral: true,
    }
  }

  return {
    titulo: 'Sin equipo/TAG',
    subtitulo: '',
    neutral: true,
  }
}

function buildEstadoVisual(ot: OTResumenConPlantilla) {
  const estado = labelOrDash(ot.estado_nombre)
  const isClosed = (ot.estado_nombre || '').toLowerCase() === 'cerrada'

  if (ot.finalizado_tecnico_at && !isClosed) {
    if (ot.permitir_edicion_tecnico) {
      return {
        label: 'Corrección autorizada',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      }
    }

    return {
      label: 'Finalizada técnico',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  return {
    label: estado,
    className: estadoBadgeClass(ot.estado_nombre),
  }
}

function getFilterPanel() {
  if (typeof document === 'undefined') return null

  const heading = Array.from(document.querySelectorAll('h2')).find(
    (element) => element.textContent?.trim() === 'Filtros de búsqueda'
  )

  return heading?.parentElement?.parentElement ?? null
}

function readVisibleListFilters(): OTListFilters | undefined {
  const panel = getFilterPanel()
  if (!panel) return undefined

  const clienteSelect = panel.querySelector<HTMLSelectElement>('select')
  const dateInputs = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="date"]'))

  if (!clienteSelect && dateInputs.length === 0) return undefined

  return {
    cliente: clienteSelect?.value ?? '',
    fechaDesde: dateInputs[0]?.value ?? '',
    fechaHasta: dateInputs[1]?.value ?? '',
  }
}

function setNativeControlValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')

  descriptor?.set?.call(element, value)

  if (element instanceof HTMLInputElement) {
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function restoreVisibleListFilters(filters: OTListFilters | undefined) {
  if (!filters) return

  const panel = getFilterPanel()
  if (!panel) return

  const clienteSelect = panel.querySelector<HTMLSelectElement>('select')
  const dateInputs = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="date"]'))

  if (clienteSelect) setNativeControlValue(clienteSelect, filters.cliente)
  if (dateInputs[0]) setNativeControlValue(dateInputs[0], filters.fechaDesde)
  if (dateInputs[1]) setNativeControlValue(dateInputs[1], filters.fechaHasta)
}

function normalizeAdvancedFilters(value: unknown): OTAdvancedFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_ADVANCED_FILTERS
  }

  const record = value as Partial<OTAdvancedFilters>

  return {
    estado: typeof record.estado === 'string' ? record.estado : '',
    tipo: typeof record.tipo === 'string' ? record.tipo : '',
    tecnico: typeof record.tecnico === 'string' ? record.tecnico : '',
  }
}

function rememberListContext(otId: string, advancedFilters: OTAdvancedFilters) {
  if (typeof window === 'undefined') return

  const context: OTListContext = {
    otId,
    empresaId: window.localStorage.getItem('empresa_activa_id') || '',
    scrollY: window.scrollY,
    savedAt: Date.now(),
    filters: readVisibleListFilters(),
    advancedFilters,
  }

  window.sessionStorage.setItem(OT_LIST_CONTEXT_KEY, JSON.stringify(context))
}

function uniqueSortedOptions(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || '').filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'))
}

export function OTDataTable({
  data,
  selectable = false,
  selectedIds,
  allRowsSelected = false,
  onToggleSelect,
  onToggleSelectAll,
  offlinePreparedIds,
}: Props) {
  const [highlightedOtId, setHighlightedOtId] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState<OTAdvancedFilters>(EMPTY_ADVANCED_FILTERS)

  const estadoOptions = useMemo(
    () => uniqueSortedOptions(data.map((ot) => ot.estado_nombre)),
    [data]
  )

  const tipoOptions = useMemo(
    () => uniqueSortedOptions(data.map((ot) => ot.tipo_servicio_nombre)),
    [data]
  )

  const tecnicoOptions = useMemo(
    () => uniqueSortedOptions(data.map((ot) => ot.tecnico_nombre)),
    [data]
  )

  const filteredData = useMemo(() => {
    return data.filter((ot) => {
      if (advancedFilters.estado && (ot.estado_nombre || '') !== advancedFilters.estado) {
        return false
      }

      if (advancedFilters.tipo && (ot.tipo_servicio_nombre || '') !== advancedFilters.tipo) {
        return false
      }

      if (advancedFilters.tecnico && (ot.tecnico_nombre || '') !== advancedFilters.tecnico) {
        return false
      }

      return true
    })
  }, [advancedFilters, data])

  const orderedData = useMemo(
    () => [...filteredData].sort((a, b) => getServiceDateSortValue(b) - getServiceDateSortValue(a)),
    [filteredData]
  )

  const advancedFiltersActive = Boolean(
    advancedFilters.estado || advancedFilters.tipo || advancedFilters.tecnico
  )

  useEffect(() => {
    if (typeof window === 'undefined' || data.length === 0) return

    const rawContext = window.sessionStorage.getItem(OT_LIST_CONTEXT_KEY)
    if (!rawContext) return

    let context: OTListContext | null = null

    try {
      const parsed = JSON.parse(rawContext) as Partial<OTListContext>
      if (
        typeof parsed.otId === 'string' &&
        typeof parsed.scrollY === 'number' &&
        typeof parsed.savedAt === 'number'
      ) {
        context = {
          otId: parsed.otId,
          empresaId: typeof parsed.empresaId === 'string' ? parsed.empresaId : '',
          scrollY: parsed.scrollY,
          savedAt: parsed.savedAt,
          filters: parsed.filters,
          advancedFilters: normalizeAdvancedFilters(parsed.advancedFilters),
        }
      }
    } catch {
      window.sessionStorage.removeItem(OT_LIST_CONTEXT_KEY)
      return
    }

    if (!context || Date.now() - context.savedAt > OT_LIST_CONTEXT_TTL_MS) {
      window.sessionStorage.removeItem(OT_LIST_CONTEXT_KEY)
      return
    }

    const currentEmpresaId = window.localStorage.getItem('empresa_activa_id') || ''
    if (context.empresaId && currentEmpresaId && context.empresaId !== currentEmpresaId) {
      window.sessionStorage.removeItem(OT_LIST_CONTEXT_KEY)
      return
    }

    if (!data.some((ot) => ot.id === context?.otId)) return

    restoreVisibleListFilters(context.filters)
    setAdvancedFilters(normalizeAdvancedFilters(context.advancedFilters))
    window.sessionStorage.removeItem(OT_LIST_CONTEXT_KEY)
    setHighlightedOtId(context.otId)

    const restoreTimer = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-ot-row="${context?.otId}"]`)

      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'auto' })
      } else {
        window.scrollTo({ top: context?.scrollY ?? 0, behavior: 'auto' })
      }
    }, 300)

    const highlightTimer = window.setTimeout(() => {
      setHighlightedOtId('')
    }, 3500)

    return () => {
      window.clearTimeout(restoreTimer)
      window.clearTimeout(highlightTimer)
    }
    // Este efecto se ejecuta solo al montar el listado. Los filtros restaurados cambian
    // data después y no deben cancelar el scroll pendiente ni consumir el contexto otra vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-base font-medium text-slate-900">
          Aún no hay órdenes de trabajo registradas.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Cuando crees una nueva OT, aparecerá aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-800">Filtros rápidos del listado</p>
          <p className="text-xs text-slate-500">
            Combínalos con cliente y fechas. Se mantienen al abrir una OT y volver.
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            Estado
            <select
              value={advancedFilters.estado}
              onChange={(event) =>
                setAdvancedFilters((prev) => ({ ...prev, estado: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
            >
              <option value="">Todos los estados</option>
              {estadoOptions.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Tipo de servicio
            <select
              value={advancedFilters.tipo}
              onChange={(event) =>
                setAdvancedFilters((prev) => ({ ...prev, tipo: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
            >
              <option value="">Todos los tipos</option>
              {tipoOptions.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Técnico
            <select
              value={advancedFilters.tecnico}
              onChange={(event) =>
                setAdvancedFilters((prev) => ({ ...prev, tecnico: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
            >
              <option value="">Todos los técnicos</option>
              {tecnicoOptions.map((tecnico) => (
                <option key={tecnico} value={tecnico}>
                  {humanizePerson(tecnico)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mostrando <strong className="text-slate-800">{orderedData.length}</strong> de{' '}
            <strong className="text-slate-800">{data.length}</strong> OT según estos filtros.
          </span>
          {advancedFiltersActive ? (
            <button
              type="button"
              onClick={() => setAdvancedFilters(EMPTY_ADVANCED_FILTERS)}
              className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              Limpiar filtros rápidos
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
        Ordenadas por fecha real del servicio, desde la más reciente.
      </div>

      {orderedData.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-600">
          No se encontraron OT con la combinación de filtros seleccionada.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                {selectable ? (
                  <th className="w-12 px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={allRowsSelected}
                      onChange={onToggleSelectAll}
                      aria-label="Seleccionar todas las OT filtradas"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                ) : null}
                <th className="px-4 py-3 font-semibold">Fecha servicio</th>
                <th className="px-4 py-3 font-semibold">Folio</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Equipo / TAG</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Prioridad</th>
                <th className="px-4 py-3 font-semibold">Técnico</th>
                <th className="px-4 py-3 font-semibold">Duración</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {orderedData.map((ot) => {
                const otConPlantilla = ot as OTResumenConPlantilla
                const checked = Boolean(selectedIds?.has(ot.id))
                const equipoResumen = buildEquipoResumen(otConPlantilla)
                const estadoVisual = buildEstadoVisual(otConPlantilla)
                const otMainHref = buildOtMainHref(otConPlantilla)
                const otActionLabel = buildOtActionLabel(otConPlantilla)
                const isHighlighted = highlightedOtId === ot.id

                return (
                  <tr
                    key={ot.id}
                    data-ot-row={ot.id}
                    className={`border-t text-slate-700 transition-colors duration-500 ${
                      isHighlighted
                        ? 'border-blue-200 bg-blue-50 ring-1 ring-inset ring-blue-200'
                        : 'border-slate-100 hover:bg-slate-50/80'
                    }`}
                  >
                    {selectable ? (
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleSelect?.(ot.id)}
                          aria-label={`Seleccionar ${ot.folio || 'OT'}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}

                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                      {formatServiceDate(ot)}
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {labelOrDash(ot.folio)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-[220px] whitespace-normal break-words font-medium text-slate-900">
                        {labelOrDash(ot.cliente_nombre)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-[280px] whitespace-normal break-words">
                        {labelOrDash(ot.titulo)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-[180px] whitespace-normal break-words">
                        {labelOrDash(ot.tipo_servicio_nombre)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-[240px] whitespace-normal break-words">
                        <div className={equipoResumen.neutral ? 'font-medium text-slate-500' : 'font-semibold text-slate-900'}>
                          {equipoResumen.titulo}
                        </div>
                        {equipoResumen.subtitulo ? (
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {equipoResumen.subtitulo}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoVisual.className}`}
                      >
                        {estadoVisual.label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${priorityBadgeClass(
                          ot.prioridad
                        )}`}
                      >
                        {labelOrDash(ot.prioridad)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-[180px] whitespace-normal break-words">
                        {humanizePerson(ot.tecnico_nombre)}
                      </div>
                    </td>

                    <td className="px-4 py-3">{formatDuration(ot.duracion_minutos)}</td>

                    <td className="px-4 py-3 text-right">
                      {offlinePreparedIds && isOTOfflineOperative(ot) ? (
                        <span className={`mb-2 ml-auto block w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${offlinePreparedIds.has(ot.id) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {offlinePreparedIds.has(ot.id) ? 'Offline listo' : 'Pendiente offline'}
                        </span>
                      ) : null}
                      <Link
                        href={otMainHref}
                        onClick={() => rememberListContext(ot.id, advancedFilters)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                        title={otConPlantilla.plantilla_nombre || undefined}
                      >
                        {otActionLabel}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
