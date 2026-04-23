type Props = {
  estado: string | null
}

function getStatusClasses(estado: string | null): string {
  const value = (estado ?? '').toLowerCase()

  if (value.includes('cerrada')) {
    return 'bg-green-100 text-green-800 border border-green-200'
  }

  if (value.includes('en proceso')) {
    return 'bg-blue-100 text-blue-800 border border-blue-200'
  }

  if (value.includes('asignada')) {
    return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
  }

  if (value.includes('pendiente')) {
    return 'bg-orange-100 text-orange-800 border border-orange-200'
  }

  if (value.includes('anulada')) {
    return 'bg-red-100 text-red-800 border border-red-200'
  }

  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

export function OTStatusBadge({ estado }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(estado)}`}
    >
      {estado ?? 'Sin estado'}
    </span>
  )
}