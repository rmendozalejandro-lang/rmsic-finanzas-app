import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ESTADO_LABEL: Record<string, string> = {
  aprobado: 'Aprobado',
  en_ejecucion: 'En ejecución',
  cerrado: 'Cerrado',
}

function fechaHoraChile(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function VerificarPTSPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return <VerificationShell><InvalidCard message="No fue posible consultar la verificación en este momento." /></VerificationShell>
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error } = await supabase.rpc('pts_verificar_publico', { p_token: token })
  const permiso = Array.isArray(data) ? data[0] : null

  if (error || !permiso) {
    return <VerificationShell><InvalidCard message="No existe un PTS verificable asociado a este código." /></VerificationShell>
  }

  const cerrado = permiso.estado === 'cerrado'

  return (
    <VerificationShell>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <div className={`px-6 py-5 text-white ${cerrado ? 'bg-[#0B2947]' : 'bg-emerald-600'}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Verificación oficial</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">PTS-{String(permiso.folio ?? 0).padStart(6, '0')}</h1>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{ESTADO_LABEL[permiso.estado] ?? permiso.estado}</span>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">✓ Documento reconocido por Tralixia</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">Este código corresponde a un Permiso de Trabajo Seguro registrado y autorizado en el sistema.</p>
          </div>

          <dl className="grid gap-5 sm:grid-cols-2">
            <Info label="Empresa mandante" value={permiso.empresa_nombre} />
            <Info label="Empresa contratista" value={permiso.empresa_contratista} />
            <Info label="Trabajo" value={permiso.trabajo_a_realizar} wide />
            <Info label="Tipo de actividad" value={permiso.tipo_actividad} />
            <Info label="Lugar" value={permiso.lugar_ejecucion} />
            <Info label="Fecha programada" value={`${permiso.fecha_inicio}${permiso.fecha_termino ? ` → ${permiso.fecha_termino}` : ''}`} />
            <Info label="Aprobación" value={fechaHoraChile(permiso.aprobado_at)} />
            <Info label="Inicio real" value={fechaHoraChile(permiso.iniciado_at)} />
            <Info label="Cierre real" value={fechaHoraChile(permiso.cerrado_at)} />
          </dl>

          <p className="border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">La verificación pública confirma autenticidad y estado del permiso. Por seguridad y protección de datos, no muestra personal participante, RUT, análisis de riesgos, observaciones internas ni trazabilidad detallada.</p>
        </div>
      </section>
    </VerificationShell>
  )
}

function VerificationShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-3xl"><div className="mb-6"><p className="text-lg font-semibold text-[#0B2947]">TRALIXIA</p><p className="text-sm text-slate-500">Verificación de Permiso de Trabajo Seguro</p></div>{children}</div></main>
}

function InvalidCard({ message }: { message: string }) {
  return <section className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">Verificación no válida</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">No pudimos verificar este PTS</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p></section>
}

function Info({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900">{value || '—'}</dd></div>
}
