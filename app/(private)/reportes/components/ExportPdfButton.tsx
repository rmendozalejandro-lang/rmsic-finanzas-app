'use client'

export default function ExportPdfButton() {
  const handleExportPdf = () => {
    window.print()
  }

  return (
    <button
      type="button"
      onClick={handleExportPdf}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
    >
      Exportar PDF
    </button>
  )
}