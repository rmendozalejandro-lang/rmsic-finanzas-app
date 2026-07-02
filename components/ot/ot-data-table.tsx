'use client'

import Link from 'next/link'
import type { OTResumen } from '../../lib/ot/types'

type Props = {
  data: OTResumen[]
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  allRowsSelected?: boolean
  onToggleSelect?: (otId: string) => void
  onToggleSelectAll?: () => void
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

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
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

export function OTDataTable({
  data,
  selectable = false,
  selectedIds,
  allRowsSelected = false,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
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
              <th className="px-4 py-3 font-semibold">Folio</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
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
            {data.map((ot) => {
              const otConPlantilla = ot as OTResumenConPlantilla
              const checked = Boolean(selectedIds?.has(ot.id))
              const equipoResumen = buildEquipoResumen(otConPlantilla)
              const estadoVisual = buildEstadoVisual(otConPlantilla)
              const otMainHref = buildOtMainHref(otConPlantilla)
              const otActionLabel = buildOtActionLabel(otConPlantilla)

              return (
                <tr key={ot.id} className="border-t border-slate-100 text-slate-700">
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

                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {labelOrDash(ot.folio)}
                  </td>

                  <td className="px-4 py-3">{formatDate(ot.fecha_ot)}</td>

                  <td className="px-4 py-3">
                    <div className="max-w-[220px] whitespace-normal break-words">
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
                    <Link
                      href={otMainHref}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
    </div>
  )
}
