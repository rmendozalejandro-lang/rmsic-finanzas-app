'use client'

import PrintButton from './PrintButton'
import ExportPdfButton from './ExportPdfButton'

type ReportHeaderProps = {
  title: string
  subtitle?: string
}

export default function ReportHeader({
  title,
  subtitle,
}: ReportHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>

        <div className="no-print flex gap-2">
          <ExportPdfButton />
          <PrintButton />
        </div>
      </div>
    </div>
  )
}