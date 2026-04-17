"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getFirstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialDesde = searchParams.get("desde") ?? getFirstDayOfMonth();
  const initialHasta = searchParams.get("hasta") ?? getToday();
  const initialPreset = searchParams.get("preset") ?? "este_mes";

  const [desde, setDesde] = useState(initialDesde);
  const [hasta, setHasta] = useState(initialHasta);
  const [preset, setPreset] = useState(initialPreset);

  const presets = useMemo(
    () => [
      { value: "este_mes", label: "Este mes" },
      { value: "ultimos_30", label: "Últimos 30 días" },
      { value: "anio_actual", label: "Año actual" },
      { value: "personalizado", label: "Personalizado" },
    ],
    []
  );

  const applyPreset = (value: string) => {
    const now = new Date();

    if (value === "este_mes") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);

      setDesde(from);
      setHasta(getToday());
      setPreset(value);
      return;
    }

    if (value === "ultimos_30") {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);

      setDesde(fromDate.toISOString().slice(0, 10));
      setHasta(getToday());
      setPreset(value);
      return;
    }

    if (value === "anio_actual") {
      const from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      setDesde(from);
      setHasta(getToday());
      setPreset(value);
      return;
    }

    setPreset("personalizado");
  };

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("desde", desde);
    params.set("hasta", hasta);
    params.set("preset", preset);

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm no-print">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Período rápido</label>
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            {presets.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPreset("personalizado");
            }}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPreset("personalizado");
            }}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleApply}
            className="h-10 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  );
}