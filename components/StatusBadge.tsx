type StatusBadgeProps = {
  status: string
}

const statusMap: Record<string, string> = {
  pagado: 'bg-green-100 text-green-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  parcial: 'bg-blue-100 text-blue-800',
  vencido: 'bg-red-100 text-red-800',
  por_vencer: 'bg-amber-100 text-amber-800',
  activo: 'bg-emerald-100 text-emerald-800',
  inactivo: 'bg-slate-200 text-slate-700',
  aprobado: 'bg-emerald-100 text-emerald-800',
  rechazado: 'bg-red-100 text-red-800',
  borrador: 'bg-slate-100 text-slate-800',
}

const labelMap: Record<string, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  vencido: 'Vencido',
  por_vencer: 'Por vencer',
  activo: 'Activo',
  inactivo: 'Inactivo',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  borrador: 'Borrador',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase?.().trim() || 'pendiente'
  const styles = statusMap[normalized] || 'bg-slate-100 text-slate-800'
  const label = labelMap[normalized] || status || 'Pendiente'

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  )
}