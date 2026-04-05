type StatusBadgeProps = {
  status: string
}

const statusMap: Record<string, string> = {
  pagado: 'bg-green-100 text-green-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  parcial: 'bg-blue-100 text-blue-800',
  vencido: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase?.() || 'pendiente'
  const styles = statusMap[normalized] || 'bg-slate-100 text-slate-800'

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles}`}>
      {status}
    </span>
  )
}