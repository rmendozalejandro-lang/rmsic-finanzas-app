'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ModuleAccessGuard from '@/components/ModuleAccessGuard'
import { supabase } from '@/lib/supabase/client'

const EMPRESA_KEY = 'empresa_activa_id'
const DAY_MS = 86_400_000

type Animal = { id: string; nombre: string; categoria: string; estado: string }
type Parto = { id: string; madre_id: string; padre_id: string | null; fecha_probable_parto: string | null; fecha_parto_real: string | null; dias_gestacion_real: number | null; estado_reproductivo: string }
type Procedimiento = { id: string; animal_id: string; protocolo_id: string | null; fecha: string; tipo: string; estado: string; costo_total: number }
type Lote = { id: string; insumo_id: string; numero_lote: string; fecha_vencimiento: string | null; cantidad_actual: number; unidad: string | null; activo: boolean }
type Insumo = { id: string; nombre: string; unidad_medida: string; stock_minimo: number; activo: boolean }
type Protocolo = { id: string; nombre: string }

const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const parseDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`)
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (value: string, days: number) => { const date = parseDate(value); date.setUTCDate(date.getUTCDate() + days); return isoDate(date) }
const dateDiff = (later: string, earlier: string) => Math.round((parseDate(later).getTime() - parseDate(earlier).getTime()) / DAY_MS)
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC' }).format(parseDate(value)) : '—'
const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
const number = (value: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value)
const title = (value: string) => value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())

function Section({ title: heading, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-xl font-semibold text-slate-950">{heading}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div><div className="mt-5">{children}</div></section>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">{children}</p>
}

function Bars({ items, empty }: { items: { label: string; value: number; color: string }[]; empty: string }) {
  const max = Math.max(...items.map(item => item.value), 0)
  if (!items.length) return <Empty>{empty}</Empty>
  return <div className="space-y-4">{items.map(item => <div key={item.label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.label}</span><span className="font-semibold text-slate-950">{item.value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${max ? Math.max((item.value / max) * 100, 5) : 0}%` }} /></div></div>)}</div>
}

export default function DashboardHarasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [animales, setAnimales] = useState<Animal[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [protocolos, setProtocolos] = useState<Protocolo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { const timer = window.setTimeout(() => setEmpresaId(window.localStorage.getItem(EMPRESA_KEY)), 0); return () => window.clearTimeout(timer) }, [])
  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return }
    setLoading(true); setError(null)
    const current = today()
    const monthStart = `${current.slice(0, 7)}-01`
    const nextMonthDate = parseDate(monthStart); nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1)
    const [animalsResult, birthsResult, proceduresResult, lotsResult, suppliesResult, protocolsResult] = await Promise.all([
      supabase.from('vet_animales').select('id,nombre,categoria,estado').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('vet_partos').select('id,madre_id,padre_id,fecha_probable_parto,fecha_parto_real,dias_gestacion_real,estado_reproductivo').eq('empresa_id', empresaId).order('fecha_probable_parto'),
      supabase.from('vet_procedimientos').select('id,animal_id,protocolo_id,fecha,tipo,estado,costo_total').eq('empresa_id', empresaId).gte('fecha', `${monthStart}T00:00:00`).lt('fecha', `${isoDate(nextMonthDate)}T00:00:00`).order('fecha', { ascending: false }),
      supabase.from('vet_lotes_insumo').select('id,insumo_id,numero_lote,fecha_vencimiento,cantidad_actual,unidad,activo').eq('empresa_id', empresaId).order('fecha_vencimiento'),
      supabase.from('vet_insumos').select('id,nombre,unidad_medida,stock_minimo,activo').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('vet_protocolos').select('id,nombre').eq('empresa_id', empresaId).order('nombre'),
    ])
    const failure = animalsResult.error || birthsResult.error || proceduresResult.error || lotsResult.error || suppliesResult.error || protocolsResult.error
    if (failure) setError(`No fue posible cargar el dashboard: ${failure.message}`)
    else {
      setAnimales((animalsResult.data ?? []) as Animal[])
      setPartos((birthsResult.data ?? []).map(item => ({ ...item, dias_gestacion_real: item.dias_gestacion_real == null ? null : Number(item.dias_gestacion_real) })) as Parto[])
      setProcedimientos((proceduresResult.data ?? []).map(item => ({ ...item, costo_total: Number(item.costo_total) || 0 })) as Procedimiento[])
      setLotes((lotsResult.data ?? []).map(item => ({ ...item, cantidad_actual: Number(item.cantidad_actual) || 0 })) as Lote[])
      setInsumos((suppliesResult.data ?? []).map(item => ({ ...item, stock_minimo: Number(item.stock_minimo) || 0 })) as Insumo[])
      setProtocolos((protocolsResult.data ?? []) as Protocolo[])
    }
    setLoading(false)
  }, [empresaId])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  const dashboard = useMemo(() => {
    const current = today(), limit = addDays(current, 30)
    const animalNames = new Map(animales.map(item => [item.id, item.nombre]))
    const supplyNames = new Map(insumos.map(item => [item.id, item.nombre]))
    const protocolNames = new Map(protocolos.map(item => [item.id, item.nombre]))
    const activeAnimals = animales.filter(item => item.estado === 'activo')
    const openBirths = partos.filter(item => !item.fecha_parto_real && item.estado_reproductivo !== 'anulado')
    const upcoming = openBirths.filter(item => item.fecha_probable_parto && item.fecha_probable_parto >= current && item.fecha_probable_parto <= limit)
    const delayedBirths = openBirths.filter(item => item.fecha_probable_parto && item.fecha_probable_parto < current)
    const activeStockLots = lotes.filter(item => item.activo && item.cantidad_actual > 0)
    const expiredLots = activeStockLots.filter(item => item.fecha_vencimiento && item.fecha_vencimiento < current)
    const expiringLots = activeStockLots.filter(item => item.fecha_vencimiento && item.fecha_vencimiento >= current && item.fecha_vencimiento <= limit)
    const criticalLots = [...expiredLots, ...expiringLots].sort((a, b) => (a.fecha_vencimiento ?? '').localeCompare(b.fecha_vencimiento ?? ''))
    const validProcedures = procedimientos.filter(item => item.estado !== 'anulado')
    const gestationDays = partos.map(item => item.dias_gestacion_real).filter((value): value is number => value != null)
    const attendance = new Map<string, number>()
    validProcedures.forEach(item => attendance.set(item.animal_id, (attendance.get(item.animal_id) ?? 0) + 1))
    const categoryMap = new Map<string, number>()
    activeAnimals.forEach(item => categoryMap.set(item.categoria, (categoryMap.get(item.categoria) ?? 0) + 1))
    const stateMap = new Map<string, number>()
    procedimientos.forEach(item => stateMap.set(item.estado, (stateMap.get(item.estado) ?? 0) + 1))
    const lowStock = insumos.filter(item => item.activo).map(item => ({ ...item, stock: activeStockLots.filter(lot => lot.insumo_id === item.id && (!lot.fecha_vencimiento || lot.fecha_vencimiento >= current)).reduce((sum, lot) => sum + lot.cantidad_actual, 0) })).filter(item => item.stock <= item.stock_minimo)
    return { current, animalNames, supplyNames, protocolNames, activeAnimals, openBirths, upcoming, delayedBirths, expiredLots, expiringLots, criticalLots, validProcedures, lowStock,
      averageGestation: gestationDays.length ? gestationDays.reduce((sum, value) => sum + value, 0) / gestationDays.length : null,
      attended: [...attendance.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      categories: [...categoryMap.entries()].sort((a, b) => b[1] - a[1]), states: [...stateMap.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [animales, insumos, lotes, partos, procedimientos, protocolos])

  const kpis = [
    ['Animales activos', dashboard.activeAnimals.length, 'text-emerald-700'],
    ['Yeguas activas', dashboard.activeAnimals.filter(item => item.categoria === 'yegua').length, 'text-emerald-700'],
    ['Gestaciones abiertas', dashboard.openBirths.length, 'text-sky-700'],
    ['Partos próximos 30 días', dashboard.upcoming.length, 'text-amber-700'],
    ['Alertas atrasadas', dashboard.delayedBirths.length + dashboard.expiredLots.length, 'text-rose-700'],
    ['Procedimientos del mes', dashboard.validProcedures.length, 'text-violet-700'],
    ['Costo procedimientos del mes', money(dashboard.validProcedures.reduce((sum, item) => sum + item.costo_total, 0)), 'text-indigo-700'],
    ['Lotes críticos', dashboard.criticalLots.length, 'text-orange-700'],
  ]

  return <ModuleAccessGuard moduleKey="haras"><main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <header className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:px-10"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-cyan-300">Tralixia Haras</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard Haras</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Resumen gerencial del estado reproductivo, sanitario, operativo y de stock del Haras.</p></div><Link href="/haras" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-800 sm:mt-0">Volver a Haras</Link></header>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {!loading && !empresaId && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Selecciona una empresa activa para consultar el dashboard del Haras.</div>}
    {loading ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Cargando resumen gerencial…</div> : empresaId && <>
      <section aria-label="Indicadores principales" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(([label, value, color]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></article>)}</section>
      {(dashboard.delayedBirths.length + dashboard.expiredLots.length) === 0 && <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">No hay alertas atrasadas.</p>}

      <Section title="Estado reproductivo" description="Gestaciones, fechas probables de parto y desempeño reproductivo."><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-sky-50 p-4"><p className="text-sm text-sky-800">Gestaciones abiertas</p><p className="mt-1 text-2xl font-bold text-sky-950">{dashboard.openBirths.length}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-sm text-rose-800">Partos atrasados</p><p className="mt-1 text-2xl font-bold text-rose-950">{dashboard.delayedBirths.length}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Promedio gestación real</p><p className="mt-1 text-2xl font-bold text-emerald-950">{dashboard.averageGestation == null ? '—' : `${number(dashboard.averageGestation)} días`}</p></div></div>
        <h3 className="mt-6 font-semibold text-slate-900">Próximas 5 yeguas a parto</h3>{dashboard.openBirths.filter(item => item.fecha_probable_parto).sort((a, b) => (a.fecha_probable_parto ?? '').localeCompare(b.fecha_probable_parto ?? '')).slice(0, 5).length === 0 ? <div className="mt-3"><Empty>No hay gestaciones abiertas.</Empty></div> : <div className="mt-3 grid gap-3">{dashboard.openBirths.filter(item => item.fecha_probable_parto).sort((a, b) => (a.fecha_probable_parto ?? '').localeCompare(b.fecha_probable_parto ?? '')).slice(0, 5).map(item => { const days = dateDiff(item.fecha_probable_parto!, dashboard.current); return <article key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1.2fr_1fr_auto]"><div><p className="font-semibold text-slate-950">{dashboard.animalNames.get(item.madre_id) ?? 'Yegua sin nombre'}</p><p className="text-sm text-slate-500">Padre: {item.padre_id ? dashboard.animalNames.get(item.padre_id) ?? 'No disponible' : 'No registrado'}</p></div><div><p className="text-sm font-medium">{formatDate(item.fecha_probable_parto)}</p><p className={`text-sm ${days < 0 ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>{days < 0 ? `${Math.abs(days)} días de atraso` : days === 0 ? 'Parto previsto hoy' : `${days} días restantes`}</p></div><span className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${days < 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{title(item.estado_reproductivo)}</span></article>})}</div>}
      </Section>

      <Section title="Actividad sanitaria del mes" description="Procedimientos y costos registrados durante el mes actual."><div className="grid gap-5 lg:grid-cols-2"><div><h3 className="font-semibold text-slate-900">Principales animales atendidos</h3>{dashboard.attended.length ? <div className="mt-3 space-y-2">{dashboard.attended.map(([id, count]) => <div key={id} className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span>{dashboard.animalNames.get(id) ?? 'Animal no disponible'}</span><strong>{count} {count === 1 ? 'atención' : 'atenciones'}</strong></div>)}</div> : <div className="mt-3"><Empty>No hay procedimientos registrados este mes.</Empty></div>}</div><div><h3 className="font-semibold text-slate-900">Últimos 5 procedimientos</h3>{dashboard.validProcedures.length ? <div className="mt-3 space-y-3">{dashboard.validProcedures.slice(0, 5).map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-slate-950">{dashboard.animalNames.get(item.animal_id) ?? 'Animal no disponible'}</p><p className="text-sm text-slate-600">{item.protocolo_id ? dashboard.protocolNames.get(item.protocolo_id) ?? title(item.tipo) : title(item.tipo)}</p></div><time className="text-sm font-medium">{formatDate(item.fecha)}</time></div><div className="mt-3 flex items-center justify-between gap-3"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{title(item.estado)}</span><strong className="text-sm">{money(item.costo_total)}</strong></div></article>)}</div> : <div className="mt-3"><Empty>No hay procedimientos registrados este mes.</Empty></div>}</div></div></Section>

      <Section title="Stock e insumos críticos" description="Vencimientos y niveles de stock que requieren revisión."><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-rose-50 p-4"><p className="text-sm text-rose-800">Lotes vencidos con stock</p><strong className="mt-1 block text-2xl text-rose-950">{dashboard.expiredLots.length}</strong></div><div className="rounded-xl bg-orange-50 p-4"><p className="text-sm text-orange-800">Por vencer en 30 días</p><strong className="mt-1 block text-2xl text-orange-950">{dashboard.expiringLots.length}</strong></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-800">Insumos con bajo stock</p><strong className="mt-1 block text-2xl text-amber-950">{dashboard.lowStock.length}</strong></div></div><h3 className="mt-6 font-semibold text-slate-900">Top 5 lotes críticos</h3>{dashboard.criticalLots.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{dashboard.criticalLots.slice(0, 5).map(item => { const days = dateDiff(item.fecha_vencimiento!, dashboard.current); const state = days < 0 ? 'Vencido' : days === 0 ? 'Vence hoy' : 'Por vencer'; return <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{dashboard.supplyNames.get(item.insumo_id) ?? 'Insumo no disponible'}</p><p className="text-sm text-slate-500">Lote {item.numero_lote}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${days < 0 ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'}`}>{state}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Vencimiento</dt><dd className="font-medium">{formatDate(item.fecha_vencimiento)}</dd></div><div><dt className="text-slate-500">Cantidad actual</dt><dd className="font-medium">{number(item.cantidad_actual)} {item.unidad ?? ''}</dd></div></dl></article>})}</div> : <div className="mt-3"><Empty>No hay lotes críticos.</Empty></div>}{dashboard.lowStock.length > 0 && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Bajo stock:</strong> {dashboard.lowStock.map(item => `${item.nombre} (${number(item.stock)} ${item.unidad_medida})`).join(', ')}</div>}</Section>

      <Section title="Resumen operativo" description="Distribución simple de la operación actual, sin alterar los registros."><div className="grid gap-8 lg:grid-cols-3"><div><h3 className="mb-4 font-semibold text-slate-900">Animales por categoría</h3><Bars empty="No hay animales activos." items={dashboard.categories.map(([label, value]) => ({ label: title(label), value, color: 'bg-emerald-500' }))} /></div><div><h3 className="mb-4 font-semibold text-slate-900">Procedimientos por estado</h3><Bars empty="No hay procedimientos registrados este mes." items={dashboard.states.map(([label, value]) => ({ label: title(label), value, color: 'bg-violet-500' }))} /></div><div><h3 className="mb-4 font-semibold text-slate-900">Alertas críticas</h3><Bars empty="No hay alertas atrasadas." items={[{ label: 'Partos atrasados', value: dashboard.delayedBirths.length, color: 'bg-rose-500' }, { label: 'Lotes vencidos', value: dashboard.expiredLots.length, color: 'bg-orange-500' }].filter(item => item.value > 0)} /></div></div></Section>
    </>}
  </div></main></ModuleAccessGuard>
}
