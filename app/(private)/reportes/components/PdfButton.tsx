"use client";

export function PdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
    >
      Exportar PDF
    </button>
  );
}