import { PrintButton } from "./PrintButton";
import { PdfButton } from "./PdfButton";

type ReportHeaderProps = {
  empresaNombre: string;
  empresaRut?: string | null;
};

export function ReportHeader({
  empresaNombre,
  empresaRut,
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Centro de Reportes</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Reportes financieros y contables
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisa, imprime y exporta información filtrada por la empresa activa.
          </p>
        </div>

        <div className="flex gap-2 no-print">
          <PrintButton />
          <PdfButton />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Empresa activa
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-base font-semibold">{empresaNombre}</span>
          {empresaRut ? (
            <span className="text-sm text-muted-foreground">{empresaRut}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}