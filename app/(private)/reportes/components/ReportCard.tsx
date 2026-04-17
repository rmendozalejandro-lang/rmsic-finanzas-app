import Link from "next/link";
import { ReportItem } from "@/lib/reportes/reportCatalog";

type ReportCardProps = {
  report: ReportItem;
};

export function ReportCard({ report }: ReportCardProps) {
  return (
    <Link
      href={report.href}
      className="group rounded-2xl border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {report.category}
          </p>
          <h3 className="mt-2 text-lg font-semibold group-hover:text-primary">
            {report.title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.description}
          </p>
        </div>

        <div className="pt-2">
          <span className="text-sm font-medium text-primary">
            Ver reporte →
          </span>
        </div>
      </div>
    </Link>
  );
}