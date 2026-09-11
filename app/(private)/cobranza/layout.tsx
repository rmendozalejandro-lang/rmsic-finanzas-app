import Link from 'next/link'

export default function CobranzaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/cobranza"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cobranza
        </Link>
        <Link
          href="/cobranza/historial"
          className="inline-flex items-center rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          Historial de recordatorios
        </Link>
      </div>
      {children}
    </div>
  )
}
