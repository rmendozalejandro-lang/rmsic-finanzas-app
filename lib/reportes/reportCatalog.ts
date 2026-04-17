export type ReportRole =
  | "admin"
  | "administracion_financiera"
  | "cobranzas"
  | "operaciones";

export type ReportCategory =
  | "financieros"
  | "contables"
  | "gestion";

export type ReportItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  category: ReportCategory;
  roles: ReportRole[];
  enabled?: boolean;
};

export const REPORT_CATALOG: ReportItem[] = [
  {
    key: "resumen_financiero",
    title: "Resumen financiero",
    description: "Vista general de ingresos, egresos, saldos y KPIs del período.",
    href: "/dashboard/reportes/resumen-financiero",
    category: "financieros",
    roles: ["admin", "administracion_financiera"],
    enabled: true,
  },
  {
    key: "libro_ingresos",
    title: "Libro de ingresos",
    description: "Detalle de ingresos por período, folio, cliente y montos.",
    href: "/dashboard/reportes/libro-ingresos",
    category: "contables",
    roles: ["admin", "administracion_financiera"],
    enabled: true,
  },
  {
    key: "libro_egresos",
    title: "Libro de egresos",
    description: "Detalle de egresos por período, proveedor, categoría e impuestos.",
    href: "/dashboard/reportes/libro-egresos",
    category: "contables",
    roles: ["admin", "administracion_financiera"],
    enabled: true,
  },
  {
    key: "cuentas_cobrar",
    title: "Cuentas por cobrar",
    description: "Seguimiento de documentos pendientes, vencimientos y saldos.",
    href: "/dashboard/reportes/cuentas-cobrar",
    category: "gestion",
    roles: ["admin", "administracion_financiera", "cobranzas"],
    enabled: true,
  },
  {
    key: "bancos",
    title: "Resumen bancario",
    description: "Movimientos, saldos y conciliación por cuentas bancarias.",
    href: "/dashboard/reportes/bancos",
    category: "gestion",
    roles: ["admin", "administracion_financiera"],
    enabled: true,
  },
];