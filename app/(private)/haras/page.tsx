import Link from 'next/link'

const areas = [
  {
    title: 'Animales',
    description: 'Registro de animales, yeguas madres, nacimientos y trazabilidad del haras.',
    accent: 'bg-emerald-500',
    href: '/haras/animales',
  },
  {
    title: 'Insumos y stock',
    description: 'Medicamentos, insumos, proveedores, lotes, vencimientos y stock real.',
    accent: 'bg-sky-500',
    href: '/haras/insumos',
  },
  {
    title: 'Protocolos',
    description: 'Base para planes sanitarios y protocolos veterinarios reutilizables.',
    accent: 'bg-violet-500',
    href: '/haras/protocolos',
  },
  {
    title: 'Procedimientos',
    description: 'Atenciones veterinarias y consumo trazable de medicamentos e insumos.',
    accent: 'bg-amber-500',
    href: '/haras/procedimientos',
  },
  {
    title: 'Partos y nacimientos',
    description: 'Seguimiento de gestaciones, partos, crías y resultados clínicos.',
    accent: 'bg-rose-500',
    href: '/haras/partos',
  },
  {
    title: 'Reportes mensuales',
    description: 'Indicadores sanitarios, reproductivos, operativos y de existencias.',
    accent: 'bg-indigo-500',
    href: '/haras/reportes',
  },
  {
    title: 'Alertas y calendario',
    description: 'Próximos partos, vacunas, protocolos e insumos críticos.',
    accent: 'bg-orange-500',
    href: '/haras/calendario',
  },
]

export default function HarasPage() {
  return (
    <main className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-9 text-white shadow-sm sm:px-10">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Gestión veterinaria y administrativa
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Tralixia Haras
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Un espacio independiente y seguro para centralizar la operación del haras.
              La estructura inicial está lista para incorporar cada flujo en las próximas fases.
            </p>
          </div>
        </section>

        <aside
          className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 sm:px-6"
          aria-labelledby="instalar-tralixia"
        >
          <div className="flex items-start gap-4">
            <div
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white sm:flex"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
                <path d="M10 18.5h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="instalar-tralixia" className="text-base font-semibold text-slate-900">
                Usar en celular
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Puedes agregar Tralixia a la pantalla de inicio para usarlo como una app.
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <li>
                  <span className="font-semibold text-slate-800">Android:</span>{' '}
                  Chrome → menú ⋮ → Instalar app o Agregar a pantalla principal
                </li>
                <li>
                  <span className="font-semibold text-slate-800">iPhone:</span>{' '}
                  Safari → Compartir → Agregar a pantalla de inicio
                </li>
              </ul>
            </div>
          </div>
        </aside>

        <section className="mt-8" aria-labelledby="areas-haras">
          <div className="mb-5">
            <p className="text-sm font-medium text-emerald-700">Estructura inicial</p>
            <h2 id="areas-haras" className="mt-1 text-2xl font-semibold text-slate-900">
              Áreas del módulo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Las funcionalidades se habilitarán de forma progresiva.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => (
              <article key={area.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className={`h-1.5 w-12 rounded-full ${area.accent}`} aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{area.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{area.description}</p>
                {area.href ? (
                  <Link
                    href={area.href}
                    className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    Abrir {area.title}
                  </Link>
                ) : (
                  <span className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Próximamente
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
