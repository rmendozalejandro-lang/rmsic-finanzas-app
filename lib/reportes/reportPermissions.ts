import { REPORT_CATALOG, ReportItem, ReportRole } from "./reportCatalog";

export function getReportsForRole(role: ReportRole | null | undefined): ReportItem[] {
  if (!role) return [];

  return REPORT_CATALOG.filter((report) => {
    const enabled = report.enabled ?? true;
    return enabled && report.roles.includes(role);
  });
}

export function canAccessReport(
  role: ReportRole | null | undefined,
  reportKey: string
): boolean {
  if (!role) return false;

  const report = REPORT_CATALOG.find((item) => item.key === reportKey);
  if (!report) return false;

  const enabled = report.enabled ?? true;
  return enabled && report.roles.includes(role);
}

export function groupReportsByCategory(reports: ReportItem[]) {
  return {
    financieros: reports.filter((r) => r.category === "financieros"),
    contables: reports.filter((r) => r.category === "contables"),
    gestion: reports.filter((r) => r.category === "gestion"),
  };
}