import Link from 'next/link'
import type { OTResumen } from '../../lib/ot/types'
import { OTPriorityBadge } from './ot-priority-badge'
import { OTStatusBadge } from './ot-status-badge'

type Props = {
  data: OTResumen[]
}

function formatDate(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
  }).format(date)
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '-'

  const horas = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (horas === 0) return `${mins} min`
  if (mins === 0) return `${horas} h`

  return `${horas} h ${mins} min`
}

export function OTDataTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="text-base font-semibold text-slate-900">
          No hay órdenes de trabajo
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Cuando crees una OT, aparecerá aquí.
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
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {data.map((ot) => (
              <tr
                key={ot.id}
                className="border-t border-slate-100 text-slate-700 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {ot.folio}
                </td>
                <td className="px-4 py-3">{formatDate(ot.fecha_ot)}</td>
                <td className="px-4 py-3">{ot.cliente_nombre ?? '-'}</td>
                <td className="px-4 py-3">
                  <div className="max-w-[280px] truncate" title={ot.titulo}>
                    {ot.titulo}
                  </div>
                </td>
                <td className="px-4 py-3">{ot.tipo_servicio_nombre ?? '-'}</td>
                <td className="px-4 py-3">
                  <OTStatusBadge estado={ot.estado_nombre} />
                </td>
                <td className="px-4 py-3">
                  <OTPriorityBadge prioridad={ot.prioridad} />
                </td>
                <td className="px-4 py-3">{ot.tecnico_nombre ?? '-'}</td>
                <td className="px-4 py-3">
                  {formatDuration(ot.duracion_minutos)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/ot/${ot.id}`}
                    className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Ver detalle
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