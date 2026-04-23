type Props = {
  prioridad: string | null
}

function getPriorityClasses(prioridad: string | null): string {
  switch ((prioridad ?? '').toLowerCase()) {
    case 'critica':
      return 'bg-red-100 text-red-800 border border-red-200'
    case 'alta':
      return 'bg-orange-100 text-orange-800 border border-orange-200'
    case 'media':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
    case 'baja':
      return 'bg-green-100 text-green-800 border border-green-200'
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200'
  }
}

function formatLabel(prioridad: string | null): string {
  if (!prioridad) return 'Sin prioridad'
  return prioridad.charAt(0).toUpperCase() + prioridad.slice(1)
}

export function OTPriorityBadge({ prioridad }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClasses(prioridad)}`}
    >
      {formatLabel(prioridad)}
    </span>
  )
}