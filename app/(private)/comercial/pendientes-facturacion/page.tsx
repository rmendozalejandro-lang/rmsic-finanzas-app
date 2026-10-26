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
type FacturaExistente = { id: string; cliente_id: string | null; empresa_id: string; numero_documento: string | null; monto_total: number; origen_tipo: string | null; origen_id: string | null }
type Vinculo = { lote_id: string; movimiento_id: string }

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
  const [facturas, setFacturas] = useState<FacturaExistente[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [vinculoDisponible, setVinculoDisponible] = useState(false)
  const [movimientosElegidos, setMovimientosElegidos] = useState<Record<string,string>>({})
  const [confirmaciones, setConfirmaciones] = useState<Record<string,boolean>>({})
  const [vinculando, setVinculando] = useState(false)
  const [preparandoLote, setPreparandoLote] = useState<string | null>(null)
  const [lotesConfirmados, setLotesConfirmados] = useState<Record<string, boolean>>({})
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [nombre, setNombre] = useState('')
  const [numeroOC, setNumeroOC] = useState('')
  const [verificacionTributaria, setVerificacionTributaria] = useState(false)
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
      const [fact, vin] = await Promise.all([
        supabase.from('movimientos').select('id,cliente_id,empresa_id,numero_documento,monto_total,origen_tipo,origen_id')
          .eq('empresa_id', empresa).eq('tipo_movimiento', 'ingreso').eq('activo', true).is('deleted_at', null)
          .in('tipo_documento', ['factura','factura_exenta']).neq('estado', 'anulado').order('fecha', { ascending: false }).limit(400),
        supabase.from('comercial_facturacion_lote_facturas').select('lote_id,movimiento_id').eq('empresa_id', empresa).limit(200),
      ])
      setFacturas((fact.data || []) as FacturaExistente[])
      setVinculoDisponible(!vin.error)
      setVinculos((vin.data || []) as Vinculo[])
      setSeleccion([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando facturación.')
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { void cargar() }, [cargar])
  const asociados = useMemo(() => new Set(items.filter(i => i.cotizacion_id).map(i => i.cotizacion_id)), [items])
  // Piloto inicial: no afirmar que una cotización histórica está pendiente solo por no tener vínculo financiero.
  // Folios anteriores al 31 quedan en revisión histórica, sin posibilidad de selección.
  const historicas = useMemo(() => cotizaciones.filter(c => c.estado === 'aprobada' && (c.folio === null || c.folio < 31)), [cotizaciones])
  const disponibles = useMemo(() => cotizaciones.filter(c =>
    c.estado === 'aprobada' && c.folio !== null && c.folio >= 31 &&
    c.cliente_id && !c.ingreso_generado_id && !asociados.has(c.id)
  ), [cotizaciones, asociados])
  const escogidas = useMemo(() => disponibles.filter(c => seleccion.includes(c.id)), [disponibles, seleccion])
  const clienteSeleccionado = escogidas[0]?.cliente_id || null
  const monedaSeleccionada = escogidas[0]?.moneda || 'CLP'
  const neto = escogidas.reduce((a, c) => a + Number(c.subtotal_neto || 0), 0)
  const exento = escogidas.reduce((a, c) => a + Number(c.subtotal_exento || 0), 0)
  const iva = escogidas.reduce((a, c) => a + Number(c.monto_iva || 0), 0)
  const total = escogidas.reduce((a, c) => a + Number(c.total || 0), 0)
  const clienteNombre = (id: string | null) => clientes.find(c => c.id === id)?.nombre || 'Cliente sin nombre'
  const cantidades = (loteId: string) => items.filter(i => i.lote_id === loteId && i.cotizacion_id)

  async function prepararLote(lote: Lote) {
    if (preparandoLote || guardando || !lotesConfirmados[lote.id]) return
    setError(''); setAviso('')
    if (!['borrador', 'esperando_oc'].includes(lote.estado)) {
      setError('Solo puedes preparar lotes en borrador o esperando OC.')
      return
    }
    const lineas = cantidades(lote.id)
    if (lineas.length < 2 || lineas.some(i => !i.cotizacion_id)) {
      setError('El lote necesita al menos dos cotizaciones vinculadas.')
      return
    }
    const cotizacionesLote = lineas.map(i => cotizaciones.find(c => c.id === i.cotizacion_id))
    if (cotizacionesLote.some(c => !c || c.estado !== 'aprobada' ||
      c.cliente_id !== lote.cliente_id || (c.moneda || 'CLP') !== lote.moneda ||
      c.ingreso_generado_id || (c.folio === null || c.folio < 31))) {
      setError('Una o más cotizaciones requieren revisión; actualiza antes de preparar el lote.')
      return
    }
    setPreparandoLote(lote.id)
    try {
      // La migración valida nuevamente el cambio desde la base de datos.
      const { data, error: cambioError } = await supabase.from('comercial_facturacion_lotes')
        .update({ estado: 'listo_facturar' }).eq('id', lote.id).eq('empresa_id', empresaId)
        .eq('estado', lote.estado).select('id')
      if (cambioError) throw new Error(cambioError.message)
      if (!data || data.length !== 1) throw new Error('El lote cambió durante la operación; vuelve a cargar.')
      await cargar()
      setAviso('Agrupación marcada como lista para facturar. No se emitió factura ni se creó ingreso.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo preparar el lote.') }
    finally { setPreparandoLote(null) }
  }

  async function vincularFactura(lote: Lote) {
    if (vinculando) return
    setError(''); setAviso('')
    const factura = facturas.find(f => f.id === movimientosElegidos[lote.id])
    const total = cantidades(lote.id).reduce((a, i) => a + Number(i.monto_referencia || 0), 0)
    if (!vinculoDisponible || !confirmaciones[lote.id] || !factura || lote.estado !== 'listo_facturar' ||
        factura.empresa_id !== empresaId || factura.cliente_id !== lote.cliente_id ||
        Number(factura.monto_total) !== total || factura.origen_id || factura.origen_tipo ||
        cantidades(lote.id).length < 2) {
      setError('Comprueba el lote, la factura existente y la confirmación de SII.')
      return
    }
    setVinculando(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Sesión caducada.')
      const { error: insertError } = await supabase.from('comercial_facturacion_lote_facturas').insert({
        empresa_id: empresaId, lote_id: lote.id, movimiento_id: factura.id, created_by: user.user.id,
      })
      if (insertError) throw new Error(insertError.message)
      setAviso('Factura vinculada sin crear otro ingreso ni otra cuenta por cobrar.')
      await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo vincular la factura.') }
    finally { setVinculando(false) }
  }

  async function crearLote() {
    if (guardando) return
    setError(''); setAviso('')
    if (!verificacionTributaria || escogidas.length < 2 || !clienteSeleccionado || !nombre.trim()) {
      setError('Selecciona al menos dos cotizaciones aprobadas, indica un nombre y confirma la revisión tributaria.')
      return
    }
    setGuardando(true)
    try {
      const { error: crearError } = await supabase.rpc('crear_lote_cotizaciones_piloto', {
        p_empresa_id: empresaId,
        p_cotizaciones: escogidas.map(c => c.id),
        p_nombre: nombre.trim(),
        p_estado: estadoInicial,
        p_numero_oc: numeroOC.trim() || null,
        p_revision_tributaria: true,
      })
      if (crearError) throw new Error(crearError.message)
      setNombre(''); setNumeroOC(''); setVerificacionTributaria(false)
      await cargar()
      setAviso('Agrupación comercial creada. No se emitió factura ni se creó un ingreso.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la agrupación.')
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
            <p className="mt-1 text-sm text-slate-600">En este piloto solo se pueden seleccionar cotizaciones desde el folio 31, cuando estén aprobadas y no tengan un ingreso o lote asociado. Antes de agrupar es obligatorio revisar la facturación real en SII.</p>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Historial protegido:</strong> {historicas.length} cotización(es) aprobada(s) anteriores al folio 31 se excluyen por seguridad. Su condición tributaria aún no está conciliada; una OC o el estado «Aprobada» no demuestran que sigan pendientes.
            </div>
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
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <input type="checkbox" className="mt-1" checked={verificacionTributaria} onChange={e => setVerificacionTributaria(e.target.checked)} disabled={guardando} />
              <span>Confirmo que revisé en el SII y en los registros de Tralixia que estas cotizaciones no han sido facturadas ni incluidas en otra factura. La verificación es manual y bajo responsabilidad del usuario.</span>
            </label>
            <button type="button" disabled={guardando || escogidas.length < 2 || !nombre.trim() || !verificacionTributaria} onClick={() => void crearLote()} className="mt-4 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Crear agrupación comercial'}
            </button>
            <p className="mt-2 text-xs text-slate-500">Esta función requiere activar una migración revisada en Supabase. La suma es referencial; antes de facturar verifica montos, descuentos, impuestos y condiciones comerciales en el SII.</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Agrupaciones existentes</h2>
            <div className="mt-3 space-y-3">
              {lotes.map(l => <div key={l.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap justify-between gap-2"><strong>{l.nombre}</strong><span className="text-sm">{estados[l.estado] || l.estado}</span></div>
                <p className="mt-1 text-sm text-slate-600">{clienteNombre(l.cliente_id)} · {cantidades(l.id).length} cotización(es) · OC: {l.numero_oc || 'Sin OC'}</p>
                <p className="mt-1 text-sm text-slate-600">{cantidades(l.id).map(i => cotizaciones.find(c => c.id === i.cotizacion_id)?.codigo || 'Cotización asociada').join(', ') || 'Sin cotizaciones asociadas en la vista'}</p>
                <p className="mt-1 text-sm font-medium">Monto referencial: {l.moneda === 'CLP' ? pesos(cantidades(l.id).reduce((a, i) => a + Number(i.monto_referencia || 0), 0)) : cantidades(l.id).reduce((a, i) => a + Number(i.monto_referencia || 0), 0).toLocaleString('es-CL') + ' ' + l.moneda}</p>
                {['borrador', 'esperando_oc'].includes(l.estado) && cantidades(l.id).length >= 2 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-semibold">Preparar para facturar</p>
                    <p>Comprueba las cotizaciones y el respaldo del cliente. Esta acción no genera una factura ni un ingreso.</p>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" checked={Boolean(lotesConfirmados[l.id])}
                        disabled={Boolean(preparandoLote)} onChange={e => setLotesConfirmados(p => ({...p, [l.id]: e.target.checked}))}/>
                      <span>Confirmo que revisé que las cotizaciones del lote están aprobadas, no han sido facturadas y corresponden al mismo cliente.</span>
                    </label>
                    <button type="button" className="rounded-lg bg-indigo-700 px-3 py-2 font-semibold text-white disabled:opacity-50"
                      disabled={!lotesConfirmados[l.id] || Boolean(preparandoLote)} onClick={() => void prepararLote(l)}>
                      {preparandoLote === l.id ? 'Validando…' : 'Marcar listo para facturar'}
                    </button>
                  </div>
                ) : null}
                {vinculos.some(v => v.lote_id === l.id) ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    Factura vinculada: {facturas.find(f => f.id === vinculos.find(v => v.lote_id === l.id)?.movimiento_id)?.numero_documento || 'Consultar ingreso'}
                  </p>
                ) : l.estado === 'listo_facturar' ? (
                  <div className="mt-3 space-y-3 rounded-lg border bg-slate-50 p-3 text-sm">
                    <strong>Vincular factura ya registrada en Ingresos</strong>
                    {!vinculoDisponible && <p className="text-amber-800">Pendiente: activar migración después de aprobar el desarrollo.</p>}
                    <select aria-label={'Factura para ' + l.nombre} className="block w-full rounded-lg border p-2"
                      value={movimientosElegidos[l.id] || ''} onChange={e => setMovimientosElegidos(p => ({...p,[l.id]:e.target.value}))}
                      disabled={!vinculoDisponible || vinculando}>
                      <option value="">Seleccionar factura existente…</option>
                      {facturas.filter(f => f.cliente_id === l.cliente_id && f.empresa_id === empresaId &&
                        !f.origen_tipo && !f.origen_id && !vinculos.some(v => v.movimiento_id === f.id) &&
                        Number(f.monto_total) === cantidades(l.id).reduce((a, i) => a + Number(i.monto_referencia || 0), 0))
                        .map(f => <option key={f.id} value={f.id}>Factura {f.numero_documento} · {pesos(Number(f.monto_total))}</option>)}
                    </select>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" disabled={!vinculoDisponible || vinculando}
                        checked={Boolean(confirmaciones[l.id])} onChange={e => setConfirmaciones(p => ({...p,[l.id]:e.target.checked}))}/>
                      <span>Confirmo que revisé en SII que esta factura cubre las cotizaciones del lote y no se ha registrado dos veces.</span>
                    </label>
                    <button type="button" onClick={() => void vincularFactura(l)}
                      disabled={!vinculoDisponible || vinculando || !movimientosElegidos[l.id] || !confirmaciones[l.id]}
                      className="rounded-lg bg-indigo-700 px-3 py-2 font-semibold text-white disabled:opacity-50">
                      Vincular factura existente
                    </button>
                  </div>
                ) : null}
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
