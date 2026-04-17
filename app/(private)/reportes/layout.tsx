import type { ReactNode } from "react";

export default function ReportesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="space-y-6 print-container">{children}</div>;
}