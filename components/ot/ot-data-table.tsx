'use client'

import Link from 'next/link'
import type { OTResumen } from '../../lib/ot/types'

type Props = {
  data: OTResumen[]
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

export function OTDataTable({ data }: Props) {
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
              <th className="px-4 py-3 font-semibold">Folio</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Título</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Prioridad</th>
              <th className="px-4 py-3 font-semibold">Técnico</th>
              <th className="px-4 py-3 font-semibold">Duración</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {data.map((ot) => (
              <tr key={ot.id} className="border-t border-slate-100 text-slate-700">
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
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClass(
                      ot.estado_nombre
                    )}`}
                  >
                    {labelOrDash(ot.estado_nombre)}
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
                    {labelOrDash(ot.tecnico_nombre)}
                  </div>
                </td>

                <td className="px-4 py-3">{formatDuration(ot.duracion_minutos)}</td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/ot/${ot.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}