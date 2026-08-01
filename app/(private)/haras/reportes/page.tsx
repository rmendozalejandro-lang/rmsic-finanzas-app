'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ModuleAccessGuard from '@/components/ModuleAccessGuard'
import { supabase } from '@/lib/supabase/client'

const EMPRESA_KEY = 'empresa_activa_id'
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
const title = (value:string) => value.replaceAll('_',' ').replace(/^./, letter => letter.toUpperCase())
const money = (value:number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(Number.isFinite(value)?value:0)
const number = (value:number) => new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(Number.isFinite(value)?value:0)
const date = (value:string|null) => value ? new Intl.DateTimeFormat('es-CL').format(new Date(`${value.slice(0,10)}T00:00:00`)) : '—'

type Animal={id:string;nombre:string}
type Protocol={id:string;nombre:string;tipo:string}
type Supply={id:string;nombre:string;unidad_medida:string}
type Procedure={id:string;animal_id:string;protocolo_id:string|null;fecha:string;tipo:string;profesional:string|null;diagnostico:string|null;detalle:string|null;proximo_control:string|null;estado:string;costo_total:number}
type Usage={id:string;procedimiento_id:string;insumo_id:string|null;descripcion:string|null;cantidad:number;unidad:string|null;costo_unitario:number|null;costo_total:number|null}
type Birth={id:string;madre_id:string;padre_id:string|null;fecha_parto_real:string|null;nombre_cria:string|null;sexo_cria:string|null;dias_gestacion_real:number|null;peso_cria:number|null;peso_placenta:number|null}

function period(year:number,month:number){
  const start=`${year}-${String(month).padStart(2,'0')}-01`
  const nextMonth=month===12?1:month+1
  const nextYear=month===12?year+1:year
  return {start,end:`${nextYear}-${String(nextMonth).padStart(2,'0')}-01`}
}

export default function HarasReportsPage(){
  const now=new Date()
  const [empresaId,setEmpresaId]=useState<string|null>(null)
  const [month,setMonth]=useState(now.getMonth()+1),[year,setYear]=useState(now.getFullYear())
  const [animalId,setAnimalId]=useState(''),[typeFilter,setTypeFilter]=useState(''),[protocolId,setProtocolId]=useState('')
  const [animals,setAnimals]=useState<Animal[]>([]),[protocols,setProtocols]=useState<Protocol[]>([]),[supplies,setSupplies]=useState<Supply[]>([])
  const [procedures,setProcedures]=useState<Procedure[]>([]),[usages,setUsages]=useState<Usage[]>([]),[births,setBirths]=useState<Birth[]>([])
  const [detailId,setDetailId]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)

  useEffect(()=>{const timer=setTimeout(()=>setEmpresaId(localStorage.getItem(EMPRESA_KEY)),0);return()=>clearTimeout(timer)},[])
  const load=useCallback(async()=>{
    if(!empresaId){setLoading(false);return}
    if(month<1||month>12||year<2000||year>2100){setError('Selecciona un mes y un año válidos.');setLoading(false);return}
    setLoading(true);setError(null);setDetailId(null)
    const {start,end}=period(year,month)
    const [a,p,i,pr,b]=await Promise.all([
      supabase.from('vet_animales').select('id,nombre').eq('empresa_id',empresaId).order('nombre'),
      supabase.from('vet_protocolos').select('id,nombre,tipo').eq('empresa_id',empresaId).order('nombre'),
      supabase.from('vet_insumos').select('id,nombre,unidad_medida').eq('empresa_id',empresaId).order('nombre'),
      supabase.from('vet_procedimientos').select('id,animal_id,protocolo_id,fecha,tipo,profesional,diagnostico,detalle,proximo_control,estado,costo_total').eq('empresa_id',empresaId).gte('fecha',`${start}T00:00:00`).lt('fecha',`${end}T00:00:00`).order('fecha',{ascending:false}),
      supabase.from('vet_partos').select('id,madre_id,padre_id,fecha_parto_real,nombre_cria,sexo_cria,dias_gestacion_real,peso_cria,peso_placenta').eq('empresa_id',empresaId).eq('estado_reproductivo','parto_registrado').gte('fecha_parto_real',start).lt('fecha_parto_real',end).order('fecha_parto_real',{ascending:false}),
    ])
    const failure=a.error||p.error||i.error||pr.error||b.error
    if(failure){setError(`No fue posible cargar el reporte: ${failure.message}`);setLoading(false);return}
    const loaded=(pr.data??[]).map(x=>({...x,costo_total:Number(x.costo_total)||0})) as Procedure[]
    let usageData:Usage[]=[]
    if(loaded.length){
      const u=await supabase.from('vet_procedimiento_insumos').select('id,procedimiento_id,insumo_id,descripcion,cantidad,unidad,costo_unitario,costo_total').eq('empresa_id',empresaId).in('procedimiento_id',loaded.map(x=>x.id))
      if(u.error){setError(`No fue posible cargar el consumo: ${u.error.message}`);setLoading(false);return}
      usageData=(u.data??[]).map(x=>({...x,cantidad:Number(x.cantidad)||0,costo_unitario:x.costo_unitario==null?null:Number(x.costo_unitario)||0,costo_total:x.costo_total==null?null:Number(x.costo_total)||0})) as Usage[]
    }
    setAnimals((a.data??[]) as Animal[]);setProtocols((p.data??[]) as Protocol[]);setSupplies((i.data??[]) as Supply[]);setProcedures(loaded);setUsages(usageData);setBirths((b.data??[]).map(x=>({...x,dias_gestacion_real:x.dias_gestacion_real==null?null:Number(x.dias_gestacion_real),peso_cria:x.peso_cria==null?null:Number(x.peso_cria),peso_placenta:x.peso_placenta==null?null:Number(x.peso_placenta)})) as Birth[]);setLoading(false)
  },[empresaId,month,year])
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load])

  const animalNames=useMemo(()=>new Map(animals.map(x=>[x.id,x.nombre])),[animals])
  const protocolNames=useMemo(()=>new Map(protocols.map(x=>[x.id,x.nombre])),[protocols])
  const supplyMap=useMemo(()=>new Map(supplies.map(x=>[x.id,x])),[supplies])
  const types=useMemo(()=>[...new Set(procedures.map(x=>x.tipo))].sort(),[procedures])
  const filtered=useMemo(()=>procedures.filter(x=>(!animalId||x.animal_id===animalId)&&(!typeFilter||x.tipo===typeFilter)&&(!protocolId||(protocolId==='none'?!x.protocolo_id:x.protocolo_id===protocolId))),[procedures,animalId,typeFilter,protocolId])
  const registered=useMemo(()=>filtered.filter(x=>x.estado==='registrado'),[filtered])
  const registeredIds=useMemo(()=>new Set(registered.map(x=>x.id)),[registered])
  const filteredUsages=useMemo(()=>usages.filter(x=>registeredIds.has(x.procedimiento_id)),[usages,registeredIds])
  const detail=filtered.find(x=>x.id===detailId)
  const detailUsages=usages.filter(x=>x.procedimiento_id===detailId)
  const usageCost=(x:Usage)=>x.costo_total??x.cantidad*(x.costo_unitario??0)
  const totalCost=registered.reduce((sum,x)=>sum+x.costo_total,0)
  const summaries=useMemo(()=>{
    const result=new Map<string,{name:string;unit:string;quantity:number;cost:number;procedures:Set<string>}>()
    filteredUsages.forEach(x=>{const supply=x.insumo_id?supplyMap.get(x.insumo_id):null;const key=x.insumo_id??`manual:${x.descripcion??'Sin identificar'}`;const row=result.get(key)??{name:supply?.nombre??x.descripcion??'Sin identificar',unit:x.unidad??supply?.unidad_medida??'—',quantity:0,cost:0,procedures:new Set<string>()};row.quantity+=x.cantidad;row.cost+=usageCost(x);row.procedures.add(x.procedimiento_id);result.set(key,row)})
    return [...result.values()].sort((a,b)=>b.cost-a.cost)
  },[filteredUsages,supplyMap])
  const byAnimal=useMemo(()=>animals.map(animal=>{const rows=registered.filter(x=>x.animal_id===animal.id);const ids=new Set(rows.map(x=>x.id));const used=filteredUsages.filter(x=>ids.has(x.procedimiento_id));const controls=rows.map(x=>x.proximo_control).filter((x):x is string=>Boolean(x)).sort();return {name:animal.nombre,count:rows.length,cost:rows.reduce((s,x)=>s+x.costo_total,0),supplies:new Set(used.map(x=>x.insumo_id??x.descripcion)).size,last:rows[0]?.fecha??null,control:controls[0]??null}}).filter(x=>x.count).sort((a,b)=>b.cost-a.cost),[animals,registered,filteredUsages])
  const byProtocol=useMemo(()=>{const map=new Map<string,{protocol:string;type:string;count:number;cost:number;animals:Set<string>}>();registered.forEach(x=>{const key=`${x.protocolo_id??'none'}:${x.tipo}`;const row=map.get(key)??{protocol:x.protocolo_id?protocolNames.get(x.protocolo_id)??'Protocolo no disponible':'Sin protocolo',type:x.tipo,count:0,cost:0,animals:new Set<string>()};row.count++;row.cost+=x.costo_total;row.animals.add(x.animal_id);map.set(key,row)});return [...map.values()].sort((a,b)=>b.count-a.count)},[registered,protocolNames])
  const badge=(state:string)=>`rounded-full px-2.5 py-1 text-xs font-semibold ${state==='registrado'?'bg-emerald-100 text-emerald-800':state==='anulado'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`
  const empty=<p className="p-8 text-center text-sm text-slate-500">No hay datos para el período y los filtros seleccionados.</p>
  const headers=(items:string[])=>items.map(x=><th key={x} className="whitespace-nowrap px-4 py-3">{x}</th>)

  return <ModuleAccessGuard moduleKey="haras"><main className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <header className="rounded-3xl bg-slate-950 px-6 py-8 text-white sm:flex sm:items-center sm:justify-between sm:px-10"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-emerald-300">Tralixia Haras</p><h1 className="mt-2 text-3xl font-semibold">Reportes mensuales</h1><p className="mt-2 text-sm text-slate-300">Actividad veterinaria, consumo, costos y partos en un solo lugar.</p></div><Link href="/haras" className="mt-5 inline-flex rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold sm:mt-0">Volver a Haras</Link></header>
    {!empresaId&&!loading&&<div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Selecciona una empresa activa para consultar los reportes.</div>}
    {error&&<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Período y filtros</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label>Mes *<select required className={field} value={month} onChange={e=>setMonth(Number(e.target.value))}>{months.map((x,index)=><option key={x} value={index+1}>{x}</option>)}</select></label><label>Año *<input required type="number" min="2000" max="2100" className={field} value={year} onChange={e=>setYear(Number(e.target.value))}/></label><label>Animal<select className={field} value={animalId} onChange={e=>setAnimalId(e.target.value)}><option value="">Todos</option>{animals.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label><label>Tipo<select className={field} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">Todos</option>{types.map(x=><option key={x}>{title(x)}</option>)}</select></label><label>Protocolo<select className={field} value={protocolId} onChange={e=>setProtocolId(e.target.value)}><option value="">Todos</option><option value="none">Sin protocolo</option>{protocols.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label></div></section>
    {loading?<p className="mt-8 text-center text-slate-500">Cargando reporte…</p>:empresaId&&<>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[
        ['Procedimientos registrados',registered.length],['Procedimientos anulados',filtered.filter(x=>x.estado==='anulado').length],['Animales atendidos',new Set(registered.map(x=>x.animal_id)).size],['Costo total mensual',money(totalCost)],['Insumos consumidos',number(filteredUsages.reduce((s,x)=>s+x.cantidad,0))],['Partos registrados',births.length],
      ].map(([label,value])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></article>)}</section>
      <ReportSection title="Procedimientos del mes">{filtered.length===0?empty:<table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{headers(['Fecha','Animal','Tipo','Protocolo','Profesional','Estado','Costo total','Próximo control','Acciones'])}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(x=><tr key={x.id}><td className="px-4 py-3">{date(x.fecha)}</td><td className="px-4 py-3 font-semibold">{animalNames.get(x.animal_id)??'—'}</td><td className="px-4 py-3">{title(x.tipo)}</td><td className="px-4 py-3">{x.protocolo_id?protocolNames.get(x.protocolo_id):'Sin protocolo'}</td><td className="px-4 py-3">{x.profesional??'—'}</td><td className="px-4 py-3"><span className={badge(x.estado)}>{title(x.estado)}</span></td><td className="px-4 py-3 font-semibold">{money(x.costo_total)}</td><td className="px-4 py-3">{date(x.proximo_control)}</td><td className="px-4 py-3"><button onClick={()=>setDetailId(x.id)} className="font-semibold text-sky-700">Ver detalle</button></td></tr>)}</tbody></table>}</ReportSection>
      {detail&&<section className="mt-6 rounded-2xl border border-sky-200 bg-white p-6 shadow-sm"><div className="flex justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-sky-700">Detalle del procedimiento</p><h2 className="mt-1 text-xl font-semibold">{animalNames.get(detail.animal_id)} · {title(detail.tipo)}</h2></div><button onClick={()=>setDetailId(null)} className="text-sm text-slate-600">Cerrar</button></div><dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Fecha</dt><dd className="font-semibold">{date(detail.fecha)}</dd></div><div><dt className="text-slate-500">Protocolo</dt><dd className="font-semibold">{detail.protocolo_id?protocolNames.get(detail.protocolo_id):'Sin protocolo'}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Diagnóstico</dt><dd className="font-semibold">{detail.diagnostico??'—'}</dd></div><div className="sm:col-span-4"><dt className="text-slate-500">Detalle</dt><dd>{detail.detalle??'—'}</dd></div></dl><div className="mt-4 overflow-x-auto">{detailUsages.length===0?empty:<table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{headers(['Insumo','Cantidad','Unidad','Costo unitario','Costo total'])}</tr></thead><tbody>{detailUsages.map(x=><tr key={x.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{x.insumo_id?supplyMap.get(x.insumo_id)?.nombre:x.descripcion??'Acción manual'}</td><td className="px-4 py-3">{number(x.cantidad)}</td><td className="px-4 py-3">{x.unidad??'—'}</td><td className="px-4 py-3">{money(x.costo_unitario??0)}</td><td className="px-4 py-3 font-semibold">{money(usageCost(x))}</td></tr>)}</tbody></table>}</div></section>}
      <ReportSection title="Consumo consolidado por insumo">{summaries.length===0?empty:<table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{headers(['Insumo','Unidad','Cantidad consumida','Costo promedio','Costo total mensual','Procedimientos'])}</tr></thead><tbody>{summaries.map(x=><tr key={`${x.name}:${x.unit}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{x.name}</td><td className="px-4 py-3">{x.unit}</td><td className="px-4 py-3">{number(x.quantity)}</td><td className="px-4 py-3">{money(x.quantity?x.cost/x.quantity:0)}</td><td className="px-4 py-3 font-semibold">{money(x.cost)}</td><td className="px-4 py-3">{x.procedures.size}</td></tr>)}</tbody></table>}</ReportSection>
      <ReportSection title="Resumen por animal">{byAnimal.length===0?empty:<table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{headers(['Animal','Procedimientos','Costo total','Insumos utilizados','Último procedimiento','Próximo control'])}</tr></thead><tbody>{byAnimal.map(x=><tr key={x.name} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{x.name}</td><td className="px-4 py-3">{x.count}</td><td className="px-4 py-3 font-semibold">{money(x.cost)}</td><td className="px-4 py-3">{x.supplies}</td><td className="px-4 py-3">{date(x.last)}</td><td className="px-4 py-3">{date(x.control)}</td></tr>)}</tbody></table>}</ReportSection>
      <ReportSection title="Resumen por protocolo y tipo">{byProtocol.length===0?empty:<table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{headers(['Protocolo','Tipo de procedimiento','Procedimientos','Costo total','Animales atendidos'])}</tr></thead><tbody>{byProtocol.map(x=><tr key={`${x.protocol}:${x.type}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{x.protocol}</td><td className="px-4 py-3">{title(x.type)}</td><td className="px-4 py-3">{x.count}</td><td className="px-4 py-3 font-semibold">{money(x.cost)}</td><td className="px-4 py-3">{x.animals.size}</td></tr>)}</tbody></table>}</ReportSection>
      <ReportSection title="Partos registrados en el mes">{births.length===0?empty:<table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{headers(['Madre','Padre','Fecha parto real','Cría','Sexo','Días gestación','Peso cría','Peso placenta'])}</tr></thead><tbody>{births.map(x=><tr key={x.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{animalNames.get(x.madre_id)??'—'}</td><td className="px-4 py-3">{x.padre_id?animalNames.get(x.padre_id)??'—':'—'}</td><td className="px-4 py-3">{date(x.fecha_parto_real)}</td><td className="px-4 py-3">{x.nombre_cria??'—'}</td><td className="px-4 py-3">{x.sexo_cria?title(x.sexo_cria):'—'}</td><td className="px-4 py-3">{x.dias_gestacion_real??'—'}</td><td className="px-4 py-3">{x.peso_cria==null?'—':`${number(x.peso_cria)} kg`}</td><td className="px-4 py-3">{x.peso_placenta==null?'—':`${number(x.peso_placenta)} kg`}</td></tr>)}</tbody></table>}</ReportSection>
    </>}
  </div></main></ModuleAccessGuard>
}

function ReportSection({title:heading,children}:{title:string;children:React.ReactNode}){
  return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">{heading}</h2><div className="overflow-x-auto">{children}</div></section>
}
