'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedCotizacionesRoute from '@/components/ProtectedCotizacionesRoute'

type Cotizacion = {
  id: string; empresa_id: string; cliente_id: string | null; codigo: string | null
  folio: number | null; titulo: string; estado: string; moneda: string | null
  subtotal_neto: number | null; subtotal_exento: number | null
  monto_iva: number | null; total: number | null; ingreso_generado_id: string | null
}
type Lote = {
  id: string; cliente_id: string; nombre: string; estado: string
  numero_oc: string | null; moneda: string; created_at: string
}
type Item = { id: string; lote_id: string; cotizacion_id: string | null; monto_referencia: number | null; activo: boolean }
type Cliente = { id: string; nombre: string | null }

const pesos = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
const estados: Record<string, string> = {
  borrador: 'Borrador', esperando_oc: 'Esperando OC',
  listo_facturar: 'Listo para facturar', facturado: 'Facturado', anulado: 'Anulado',
}

function Pantalla() {
  const [empresaId, setEmpresaId] = useState('')
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [nombre, setNombre] = useState('')
  const [numeroOC, setNumeroOC] = useState('')
  const [estadoInicial, setEstadoInicial] = useState<'borrador' | 'esperando_oc'>('borrador')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const empresa = window.localStorage.getItem('empresa_activa_id') || ''
    setEmpresaId(empresa)
    setError('')
    setCargando(true)
    try {
      if (!empresa) throw new Error('Selecciona primero una empresa activa en Tralixia.')
      const [cot, lot, cli, it] = await Promise.all([
        supabase.from('cotizaciones').select('id,empresa_id,cliente_id,codigo,folio,titulo,estado,moneda,subtotal_neto,subtotal_exento,monto_iva,total,ingreso_generado_id')
          .eq('empresa_id', empresa).eq('activo', true).is('deleted_at', null).order('folio', { ascending: false }).limit(300),
        supabase.from('comercial_facturacion_lotes').select('id,cliente_id,nombre,estado,numero_oc,moneda,created_at')
          .eq('empresa_id', empresa).eq('activo', true).order('created_at', { ascending: false }).limit(100),
        supabase.from('clientes').select('id,nombre').eq('empresa_id', empresa).eq('activo', true).limit(1000),
        supabase.from('comercial_facturacion_lote_items').select('id,lote_id,cotizacion_id,monto_referencia,activo')
          .eq('empresa_id', empresa).eq('activo', true).limit(1500),
      ])
      if (cot.error || lot.error || cli.error || it.error) {
        throw new Error(cot.error?.message || lot.error?.message || cli.error?.message || it.error?.message)
      }
      setCotizaciones((cot.data || []) as Cotizacion[])
      setLotes((lot.data || []) as Lote[])
      setClientes((cli.data || []) as Cliente[])
      setItems((it.data || []) as Item[])
      setSeleccion([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando facturación.')
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { void cargar() }, [cargar])
  const asociados = useMemo(() => new Set(items.filter(i => i.cotizacion_id).map(i => i.cotizacion_id)), [items])
  const disponibles = useMemo(() => cotizaciones.filter(c => c.estado === 'aprobada' && c.cliente_id && !c.ingreso_generado_id && !asociados.has(c.id)), [cotizaciones, asociados])
  const escogidas = useMemo(() => disponibles.filter(c => seleccion.includes(c.id)), [disponibles, seleccion])
  const clienteSeleccionado = escogidas[0]?.cliente_id || null
  const monedaSeleccionada = escogidas[0]?.moneda || 'CLP'
  const neto = escogidas.reduce((a, c) => a + Number(c.subtotal_neto || 0), 0)
  const exento = escogidas.reduce((a, c) => a + Number(c.subtotal_exento || 0), 0)
  const iva = escogidas.reduce((a, c) => a + Number(c.monto_iva || 0), 0)
  const total = escogidas.reduce((a, c) => a + Number(c.total || 0), 0)
  const clienteNombre = (id: string | null) => clientes.find(c => c.id === id)?.nombre || 'Cliente sin nombre'
  const cantidades = (loteId: string) => items.filter(i => i.lote_id === loteId && i.cotizacion_id)

  async function crearLote() {
    if (guardando) return
    setError(''); setAviso('')
    if (escogidas.length < 2 || !clienteSeleccionado) {
      setError('Selecciona al menos dos cotizaciones aprobadas del mismo cliente.')
      return
    }
    if (!escogidas.every(c => c.cliente_id === clienteSeleccionado && (c.moneda || 'CLP') === monedaSeleccionada)) {
      setError('Todas las cotizaciones deben corresponder al mismo cliente y moneda.')
      return
    }
    if (!nombre.trim()) { setError('Indica un nombre para la agrupación.'); return }
    if (escogidas.some(c => c.ingreso_generado_id || asociados.has(c.id))) {
      setError('Una cotización ya tiene ingreso o asociación de facturación.')
      return
    }
    setGuardando(true)
    let nuevoId: string | null = null
    try {
      // Volver a comprobar en el servidor antes de asociar; el historial no se modifica.
      const [verificar, otrosItems] = await Promise.all([
        supabase.from('cotizaciones').select('id,empresa_id,cliente_id,estado,moneda,ingreso_generado_id')
          .in('id', escogidas.map(c => c.id)),
        supabase.from('comercial_facturacion_lote_items').select('cotizacion_id')
          .eq('empresa_id', empresaId).eq('activo', true).in('cotizacion_id', escogidas.map(c => c.id)),
      ])
      if (verificar.error || otrosItems.error) throw new Error(verificar.error?.message || otrosItems.error?.message)
      if ((verificar.data || []).length !== escogidas.length || (otrosItems.data || []).length > 0 ||
          !(verificar.data || []).every(c => c.empresa_id === empresaId && c.cliente_id === clienteSeleccionado &&
            c.estado === 'aprobada' && !c.ingreso_generado_id && (c.moneda || 'CLP') === monedaSeleccionada)) {
        throw new Error('Los datos cambiaron. Actualiza la lista y revisa las cotizaciones.')
      }
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Sesión caducada.')
      const crear = await supabase.from('comercial_facturacion_lotes').insert({
        empresa_id: empresaId, cliente_id: clienteSeleccionado, nombre: nombre.trim(),
        estado: estadoInicial, numero_oc: numeroOC.trim() || null, moneda: monedaSeleccionada,
        created_by: user.user.id,
      }).select('id').single()
      if (crear.error || !crear.data?.id) throw new Error(crear.error?.message || 'No fue posible crear el lote.')
      nuevoId = crear.data.id as string
      const insertados = await supabase.from('comercial_facturacion_lote_items').insert(escogidas.map(c => ({
        empresa_id: empresaId, lote_id: nuevoId, tipo_item: 'cotizacion', cotizacion_id: c.id,
        monto_referencia: c.total, created_by: user.user!.id,
      })))
      if (insertados.error) throw new Error(insertados.error.message)
      nuevoId = null
      setAviso('Agrupación comercial creada. No se emitió factura ni se creó un ingreso.')
      setNombre(''); setNumeroOC('')
      await cargar()
    } catch (e) {
      // Compensar una inserción parcial. Si falla, se advierte para revisión manual.
      let sufijo = ''
      if (nuevoId) {
        const limpieza = await supabase.from('comercial_facturacion_lotes').delete().eq('id', nuevoId).eq('empresa_id', empresaId)
        if (limpieza.error) sufijo = ' Atención: revisa si quedó un lote borrador sin ítems.'
      }
      setError((e instanceof Error ? e.message : 'No se pudo crear el lote.') + sufijo)
    } finally { setGuardando(false) }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-12 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Comercial · Facturación</p>
          <h1 className="text-2xl font-bold text-slate-900">Pendientes de facturación</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Agrupa cotizaciones aprobadas de un mismo cliente. Este paso es comercial: no emite documentos del SII, no registra ingresos ni concilia pagos.</p>
        </div>
        <button type="button" onClick={() => void cargar()} disabled={cargando || guardando} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Actualizar</button>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {aviso && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{aviso}</div>}
      {cargando ? <p className="text-sm text-slate-600">Cargando información…</p> : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">1. Seleccionar cotizaciones aprobadas</h2>
            <p className="mt-1 text-sm text-slate-600">Las cotizaciones enviadas aparecerán aquí cuando cambien a Aprobada. Las que ya tengan un ingreso o estén vinculadas a otro lote se excluyen.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[690px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-700"><tr><th className="p-3">Elegir</th><th className="p-3">Cotización</th><th className="p-3">Cliente</th><th className="p-3">Trabajo</th><th className="p-3 text-right">Total</th></tr></thead>
                <tbody>
                  {disponibles.map(c => {
                    const incompatible = Boolean(clienteSeleccionado && (clienteSeleccionado !== c.cliente_id || monedaSeleccionada !== (c.moneda || 'CLP')))
                    return <tr key={c.id} className="border-b">
                      <td className="p-3"><input type="checkbox" aria-label={'Seleccionar ' + (c.codigo || c.folio)} disabled={incompatible || guardando} checked={seleccion.includes(c.id)}
                        onChange={e => setSeleccion(actual => e.target.checked ? [...actual, c.id] : actual.filter(id => id !== c.id))}/></td>
                      <td className="p-3"><Link className="text-indigo-700 underline" href={'/cotizaciones/' + c.id}>{c.codigo || c.folio}</Link></td>
                      <td className="p-3">{clienteNombre(c.cliente_id)}</td>
                      <td className="p-3">{c.titulo}</td>
                      <td className="p-3 text-right">{(c.moneda || 'CLP') === 'CLP' ? pesos(Number(c.total || 0)) : Number(c.total || 0).toLocaleString('es-CL') + ' ' + c.moneda}</td>
                    </tr>
                  })}
                  {!disponibles.length && <tr><td colSpan={5} className="p-5 text-slate-500">No hay cotizaciones aprobadas disponibles para agrupar en la empresa seleccionada.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">2. Preparar agrupación</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">Nombre del lote
                <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} placeholder="Ej.: Facturación trabajos HMI y PLC" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/>
              </label>
              <label className="block text-sm">Número de orden de compra (opcional)
                <input value={numeroOC} onChange={e => setNumeroOC(e.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-300 p-3"/>
              </label>
              <label className="block text-sm">Estado inicial
                <select value={estadoInicial} onChange={e => setEstadoInicial(e.target.value as 'borrador' | 'esperando_oc')} className="mt-1 w-full rounded-lg border border-slate-300 p-3">
                  <option value="borrador">Borrador</option><option value="esperando_oc">Esperando OC</option>
                </select>
              </label>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p><strong>{escogidas.length}</strong> cotizaciones seleccionadas</p>
                <p>Cliente: {clienteSeleccionado ? clienteNombre(clienteSeleccionado) : 'Sin seleccionar'}</p>
                <p>Neto: {pesos(neto)} · Exento: {pesos(exento)} · IVA: {pesos(iva)}</p>
                <p className="mt-1 font-semibold">Total de referencia: {monedaSeleccionada === 'CLP' ? pesos(total) : total.toLocaleString('es-CL') + ' ' + monedaSeleccionada}</p>
              </div>
            </div>
            <button type="button" disabled={guardando || escogidas.length < 2 || !nombre.trim()} onClick={() => void crearLote()} className="mt-4 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Crear agrupación comercial'}
            </button>
            <p className="mt-2 text-xs text-slate-500">La suma es referencial; antes de facturar verifica montos, descuentos, impuestos y condiciones comerciales en el SII.</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Agrupaciones existentes</h2>
            <div className="mt-3 space-y-3">
              {lotes.map(l => <div key={l.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap justify-between gap-2"><strong>{l.nombre}</strong><span className="text-sm">{estados[l.estado] || l.estado}</span></div>
                <p className="mt-1 text-sm text-slate-600">{clienteNombre(l.cliente_id)} · {cantidades(l.id).length} cotización(es) · OC: {l.numero_oc || 'Sin OC'}</p>
                <p className="mt-1 text-sm text-slate-600">{cantidades(l.id).map(i => cotizaciones.find(c => c.id === i.cotizacion_id)?.codigo || 'Cotización asociada').join(', ') || 'Sin cotizaciones asociadas en la vista'}</p>
                <p className="mt-1 text-sm font-medium">Monto referencial: {l.moneda === 'CLP' ? pesos(cantidades(l.id).reduce((a, i) => a + Number(i.monto_referencia || 0), 0)) : cantidades(l.id).reduce((a, i) => a + Number(i.monto_referencia || 0), 0).toLocaleString('es-CL') + ' ' + l.moneda}</p>
              </div>)}
              {!lotes.length && <p className="text-sm text-slate-500">Todavía no hay agrupaciones para esta empresa.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default function PendientesFacturacionPage() {
  return <ProtectedCotizacionesRoute><Pantalla /></ProtectedCotizacionesRoute>
}
