'use client'

type ExportExcelButtonProps = {
  fileName: string
  sheetName?: string
  rows: Record<string, unknown>[]
  disabled?: boolean
}

const sanitizeFileName = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
}

export default function ExportExcelButton({
  fileName,
  sheetName = 'Reporte',
  rows,
  disabled = false,
}: ExportExcelButtonProps) {
  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx')

      const normalizedRows = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value ?? ''])
        )
      )

      const worksheet = XLSX.utils.json_to_sheet(normalizedRows)
      const workbook = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      XLSX.writeFile(workbook, sanitizeFileName(fileName))
    } catch (error) {
      console.error('Error exportando Excel:', error)
      alert('No se pudo exportar el archivo Excel.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Exportar Excel
    </button>
  )
}