'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ModuleAccessGuard from '@/components/ModuleAccessGuard'
import { supabase } from '@/lib/supabase/client'

const EMPRESA_KEY = 'empresa_activa_id'
const DAY_MS = 86_400_000
const ranges = [7, 15, 30, 60, 90] as const

type AlertType = 'partos' | 'protocolos' | 'insumos'
type AlertState = 'atrasado' | 'hoy' | 'próximo' | 'informativo'
type Animal = { id: string; nombre: string; categoria: string; fecha_nacimiento: string | null }
type Parto = { id: string; madre_id: string; padre_id: string | null; fecha_ultima_monta: string | null; fecha_probable_parto: string | null; fecha_parto_real: string | null; estado_reproductivo: string }
type Protocolo = { id: string; nombre: string; tipo: string; categoria_aplicable: string | null; evento_base: string | null; dias_desde_evento: number | null; instrucciones: string | null; activo: boolean }
type Lote = { id: string; insumo_id: string; numero_lote: string; fecha_vencimiento: string | null; cantidad_actual: number; unidad: string | null; activo: boolean }
type Insumo = { id: string; nombre: string }
type Alert = { id: string; date: string; type: AlertType; typeLabel: string; description: string; subject: string; state: AlertState; days: number; detail?: string; action: string }

const parseDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`)
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const today = () => isoDate(new Date())
const addDays = (value: string, days: number) => { const date = parseDate(value); date.setUTCDate(date.getUTCDate() + days); return isoDate(date) }
const dateDiff = (later: string, earlier: string) => Math.round((parseDate(later).getTime() - parseDate(earlier).getTime()) / DAY_MS)
const formatDate = (value: string) => new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC' }).format(parseDate(value))
const stateFor = (days: number): AlertState => days < 0 ? 'atrasado' : days === 0 ? 'hoy' : 'próximo'
const stateLabels: Record<AlertState, string> = { atrasado: 'Atrasado', hoy: 'Hoy', próximo: 'Próximo', informativo: 'Informativo' }
const stateStyles: Record<AlertState, string> = { atrasado: 'bg-rose-100 text-rose-800', hoy: 'bg-amber-100 text-amber-800', próximo: 'bg-sky-100 text-sky-800', informativo: 'bg-slate-100 text-slate-700' }
const typeStyles: Record<AlertType, string> = { partos: 'bg-rose-50 text-rose-800', protocolos: 'bg-violet-50 text-violet-800', insumos: 'bg-emerald-50 text-emerald-800' }

export default function CalendarioHarasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [range, setRange] = useState<(typeof ranges)[number]>(30)
  const [typeFilter, setTypeFilter] = useState<'todos' | AlertType>('todos')
  const [stateFilter, setStateFilter] = useState<'todos' | AlertState>('todos')
  const [animales, setAnimales] = useState<Animal[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [protocolos, setProtocolos] = useState<Protocolo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { const timer = window.setTimeout(() => setEmpresaId(localStorage.getItem(EMPRESA_KEY)), 0); return () => window.clearTimeout(timer) }, [])
  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return }
    setLoading(true); setError(null)
    const [animalsResult, partosResult, protocolsResult, lotsResult, suppliesResult] = await Promise.all([
      supabase.from('vet_animales').select('id,nombre,categoria,fecha_nacimiento').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('vet_partos').select('id,madre_id,padre_id,fecha_ultima_monta,fecha_probable_parto,fecha_parto_real,estado_reproductivo').eq('empresa_id', empresaId).order('fecha_probable_parto'),
      supabase.from('vet_protocolos').select('id,nombre,tipo,categoria_aplicable,evento_base,dias_desde_evento,instrucciones,activo').eq('empresa_id', empresaId).eq('activo', true).order('nombre'),
      supabase.from('vet_lotes_insumo').select('id,insumo_id,numero_lote,fecha_vencimiento,cantidad_actual,unidad,activo').eq('empresa_id', empresaId).order('fecha_vencimiento'),
      supabase.from('vet_insumos').select('id,nombre').eq('empresa_id', empresaId).order('nombre'),
    ])
    const failure = animalsResult.error || partosResult.error || protocolsResult.error || lotsResult.error || suppliesResult.error
    if (failure) setError(`No fue posible cargar las alertas: ${failure.message}`)
    else {
      setAnimales((animalsResult.data ?? []) as Animal[])
      setPartos((partosResult.data ?? []) as Parto[])
      setProtocolos((protocolsResult.data ?? []).map(item => ({ ...item, dias_desde_evento: item.dias_desde_evento == null ? null : Number(item.dias_desde_evento) })) as Protocolo[])
      setLotes((lotsResult.data ?? []).map(item => ({ ...item, cantidad_actual: Number(item.cantidad_actual) })) as Lote[])
      setInsumos((suppliesResult.data ?? []) as Insumo[])
    }
    setLoading(false)
  }, [empresaId])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  const allAlerts = useMemo(() => {
    const current = today(), names = new Map(animales.map(animal => [animal.id, animal.nombre])), supplyNames = new Map(insumos.map(insumo => [insumo.id, insumo.nombre]))
    const alerts: Alert[] = []
    partos.filter(parto => !parto.fecha_parto_real && parto.estado_reproductivo !== 'anulado' && parto.fecha_probable_parto).forEach(parto => {
      const target = parto.fecha_probable_parto!, days = dateDiff(target, current)
      alerts.push({ id: `parto-${parto.id}`, date: target, type: 'partos', typeLabel: 'Parto', description: `Parto probable de ${names.get(parto.madre_id) ?? 'Yegua sin nombre'}`, subject: names.get(parto.madre_id) ?? 'Yegua sin nombre', state: stateFor(days), days, detail: `Padre: ${parto.padre_id ? names.get(parto.padre_id) ?? 'No disponible' : 'No registrado'} · Última monta: ${parto.fecha_ultima_monta ? formatDate(parto.fecha_ultima_monta) : 'No registrada'}`, action: days <= 7 ? 'Preparar atención de parto' : 'Revisar yegua' })
    })
    protocolos.filter(protocol => protocol.activo && protocol.dias_desde_evento != null).forEach(protocol => {
      const event = protocol.evento_base?.toLowerCase() ?? ''
      const addProtocol = (key: string, base: string, animalId: string) => {
        const target = addDays(base, protocol.dias_desde_evento!), days = dateDiff(target, current)
        alerts.push({ id: `protocolo-${protocol.id}-${key}`, date: target, type: 'protocolos', typeLabel: protocol.tipo === 'vacuna' ? 'Vacuna' : 'Protocolo', description: protocol.nombre, subject: names.get(animalId) ?? 'Animal sin nombre', state: stateFor(days), days, detail: `Evento base: ${event.replaceAll('_', ' ')}${protocol.instrucciones ? ` · ${protocol.instrucciones}` : ''}`, action: 'Evaluar aplicación de protocolo' })
      }
      if (event.includes('monta')) partos.filter(parto => parto.estado_reproductivo !== 'anulado' && parto.fecha_ultima_monta).forEach(parto => addProtocol(parto.id, parto.fecha_ultima_monta!, parto.madre_id))
      else if (event.includes('parto')) partos.filter(parto => parto.estado_reproductivo !== 'anulado' && parto.fecha_parto_real).forEach(parto => addProtocol(parto.id, parto.fecha_parto_real!, parto.madre_id))
      else if (event.includes('nacimiento')) animales.filter(animal => animal.fecha_nacimiento && (!protocol.categoria_aplicable || protocol.categoria_aplicable === 'todos' || protocol.categoria_aplicable === animal.categoria)).forEach(animal => addProtocol(animal.id, animal.fecha_nacimiento!, animal.id))
    })
    lotes.filter(lote => lote.activo && lote.cantidad_actual > 0 && lote.fecha_vencimiento).forEach(lote => {
      const target = lote.fecha_vencimiento!, days = dateDiff(target, current)
      alerts.push({ id: `insumo-${lote.id}`, date: target, type: 'insumos', typeLabel: 'Insumo', description: `${supplyNames.get(lote.insumo_id) ?? 'Insumo sin nombre'} · Lote ${lote.numero_lote}`, subject: supplyNames.get(lote.insumo_id) ?? 'Insumo sin nombre', state: stateFor(days), days, detail: `Stock disponible: ${lote.cantidad_actual.toLocaleString('es-CL')} ${lote.unidad ?? ''}`.trim(), action: days < 0 ? 'Reponer o retirar lote vencido' : 'Revisar lote antes de usar' })
    })
    return alerts
  }, [animales, insumos, lotes, partos, protocolos])

  const visible = useMemo(() => allAlerts.filter(alert => alert.days <= range && (alert.days >= 0 || alert.state === 'atrasado') && (typeFilter === 'todos' || alert.type === typeFilter) && (stateFilter === 'todos' || alert.state === stateFilter)).sort((a, b) => Number(a.state !== 'atrasado') - Number(b.state !== 'atrasado') || a.date.localeCompare(b.date)), [allAlerts, range, stateFilter, typeFilter])
  const summary = { partos: visible.filter(alert => alert.type === 'partos' && alert.state !== 'atrasado').length, delayed: visible.filter(alert => alert.state === 'atrasado').length, protocols: visible.filter(alert => alert.type === 'protocolos' && alert.state !== 'atrasado').length, supplies: visible.filter(alert => alert.type === 'insumos' && alert.state !== 'atrasado').length }
  const daysLabel = (alert: Alert) => alert.days < 0 ? `${Math.abs(alert.days)} días de atraso` : alert.days === 0 ? 'Hoy' : `${alert.days} días`

  return <ModuleAccessGuard moduleKey="haras"><main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <header className="rounded-3xl bg-slate-950 px-6 py-8 text-white sm:flex sm:items-center sm:justify-between sm:px-10"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-emerald-300">Tralixia Haras</p><h1 className="mt-2 text-3xl font-semibold">Alertas y calendario operativo</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Vista de actividades críticas del Haras: partos, protocolos, vacunas e insumos próximos a vencer.</p></div><Link href="/haras" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold sm:mt-0">Volver a Haras</Link></header>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {!loading && !empresaId && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Selecciona una empresa activa para consultar las alertas del Haras.</div>}
    <section aria-label="Filtros de alertas" className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
      <label className="text-sm font-semibold text-slate-700">Rango<select value={range} onChange={event => setRange(Number(event.target.value) as (typeof ranges)[number])} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal">{ranges.map(days => <option key={days} value={days}>Próximos {days} días</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Tipo<select value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'todos' | AlertType)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal"><option value="todos">Todos</option><option value="partos">Partos</option><option value="protocolos">Protocolos</option><option value="insumos">Insumos</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Estado<select value={stateFilter} onChange={event => setStateFilter(event.target.value as 'todos' | AlertState)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal"><option value="todos">Todos</option><option value="atrasado">Atrasado</option><option value="próximo">Próximo</option><option value="hoy">Hoy</option><option value="informativo">Informativo</option></select></label>
    </section>
    <section aria-label="Resumen de alertas" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Partos próximos', summary.partos, 'Gestaciones dentro del rango'], ['Alertas atrasadas', summary.delayed, 'Actividades y vencimientos pasados'], ['Protocolos/vacunas próximas', summary.protocols, 'Aplicaciones calculables en el rango'], ['Insumos por vencer', summary.supplies, 'Lotes con stock disponible'],
    ].map(([label, value, detail]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></article>)}</section>
    <section className="mt-6" aria-labelledby="agenda-operativa"><div className="mb-4"><h2 id="agenda-operativa" className="text-2xl font-semibold text-slate-900">Agenda operativa</h2><p className="mt-1 text-sm text-slate-600">Alertas ordenadas con las atrasadas primero y luego por fecha.</p></div>
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Cargando alertas…</div> : visible.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">No hay alertas para el rango seleccionado.</div> : <div className="space-y-3">{visible.map(alert => <article key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeStyles[alert.type]}`}>{alert.typeLabel}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${stateStyles[alert.state]}`}>{stateLabels[alert.state]}</span></div><time dateTime={alert.date} className="font-semibold text-slate-900">{formatDate(alert.date)}</time></div><div className="mt-4 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]"><div><h3 className="font-semibold text-slate-950">{alert.description}</h3><p className="mt-1 text-sm text-slate-600">{alert.detail}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Animal / Insumo</p><p className="mt-1 text-sm font-medium text-slate-900">{alert.subject}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días</p><p className={`mt-1 text-sm font-semibold ${alert.days < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{daysLabel(alert)}</p></div></div><div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><strong>Acción sugerida:</strong> {alert.action}</div></article>)}</div>}
    </section>
  </div></main></ModuleAccessGuard>
}
