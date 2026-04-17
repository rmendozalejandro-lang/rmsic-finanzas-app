'use client'

import { ReactNode } from 'react'
import PrintButton from './PrintButton'
import ExportPdfButton from './ExportPdfButton'

type ReportPageHeaderProps = {
  title: string
  empresaActivaNombre: string
  subtitle?: string
  desde?: string
  hasta?: string
  rightActions?: ReactNode
}

const formatFechaHoraEmision = () => {
  return new Date().toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const formatPeriodo = (desde?: string, hasta?: string) => {
  if (!desde || !hasta) return 'Sin período seleccionado'
  return `${desde} a ${hasta}`
}

export default function ReportPageHeader({
  title,
  empresaActivaNombre,
  subtitle,
  desde,
  hasta,
  rightActions,
}: ReportPageHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div>
            <p className="text-sm text-slate-500">Reporte</p>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          </div>

          {subtitle ? (
            <p className="text-sm text-slate-600">{subtitle}</p>
          ) : null}

          <div className="space-y-1 text-sm text-slate-600">
            <p>Empresa activa: {empresaActivaNombre || 'Sin empresa activa'}</p>
            <p>Período: {formatPeriodo(desde, hasta)}</p>
            <p>Fecha de emisión: {formatFechaHoraEmision()}</p>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          {rightActions}
          <ExportPdfButton />
          <PrintButton />
        </div>
      </div>
    </div>
  )
}