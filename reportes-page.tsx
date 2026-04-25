import Link from 'next/link'

const reportesDisponibles = [
  {
    titulo: 'Resumen financiero',
    descripcion:
      'Vista consolidada de ingresos, egresos, saldo neto, comparativos y evolución mensual.',
    href: '/reportes/resumen-financiero',
  },
  {
    titulo: 'Libro de ingresos',
    descripcion:
      'Detalle de ingresos por período, documento, descripción, estado y monto.',
    href: '/reportes/libro-ingresos',
  },
  {
    titulo: 'Libro de egresos',
    descripcion:
      'Detalle de egresos por período, documento, descripción, estado y monto.',
    href: '/reportes/libro-egresos',
  },
  {
    titulo: 'Cuentas por cobrar',
    descripcion:
      'Seguimiento de facturas pendientes, vencimientos, saldos y estado de cobranza.',
    href: '/reportes/cuentas-cobrar',
  },
  {
    titulo: 'Resumen bancario',
    descripcion:
      'Control de saldos bancarios y cuentas asociadas a la empresa activa.',
    href: '/reportes/bancos',
  },
]

export default function ReportesPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Centro de reportes</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Reportes financieros y contables
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Selecciona un reporte para revisar información de la empresa activa.
          Todos los reportes incluyen impresión y exportación PDF mediante la
          vista de impresión del navegador.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportesDisponibles.map((reporte) => (
          <Link
            key={reporte.titulo}
            href={reporte.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {reporte.titulo}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {reporte.descripcion}
              </p>
            </div>

            <div className="mt-4 text-sm font-medium text-slate-900">
              Abrir reporte →
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}