'use client'

type DateRangeFilterProps = {
  desde: string
  hasta: string
  onDesdeChange: (value: string) => void
  onHastaChange: (value: string) => void
  onPresetChange: (preset: string) => void
}

export default function DateRangeFilter({
  desde,
  hasta,
  onDesdeChange,
  onHastaChange,
  onPresetChange,
}: DateRangeFilterProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm no-print">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Período rápido
          </label>
          <select
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            onChange={(e) => onPresetChange(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Seleccionar
            </option>
            <option value="este_mes">Este mes</option>
            <option value="mes_pasado">Mes pasado</option>
            <option value="anio_actual">Año actual</option>
            <option value="ultimos_30">Últimos 30 días</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Desde
          </label>
          <input
            type="date"
            value={desde}
            onChange={(e) => onDesdeChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Hasta
          </label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => onHastaChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>

        <div className="flex items-end">
          <div className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Rango activo:
            <div className="mt-1 font-medium text-slate-900">
              {desde || '-'} a {hasta || '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}