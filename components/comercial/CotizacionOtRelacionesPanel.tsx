'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Props = {
  empresaId: string
  clienteId: string | null
  puedeAdministrar?: boolean
  crearOtHref?: string
  crearCotizacionHref?: string
} & (
  | { modo: 'cotizacion'; cotizacionId: string }
  | { modo: 'ot'; otId: string }
)

type OtRelacionada = {
  id: string
  folio: string | null
  titulo: string | null
  fecha_ot: string | null
  fecha_programada?: string | null
  fecha_cierre: string | null
  estado_nombre?: string | null
  cliente_id: string | null
}

type CotizacionRelacionada = {
  id: string
  codigo: string | null
  folio: number | string | null
  titulo: string | null
  estado: string | null
  fecha_emision: string | null
  total: number | string | null
  cliente_id: string | null
}

type Relacion = {
  id: string
  tipo_relacion: string
  monto_asociado: number | string | null
  observacion: string | null
  ot: OtRelacionada | null
  cotizacion: CotizacionRelacionada | null
}

const TIPOS_RELACION = [
  { value: 'vinculo_manual', label: 'Vínculo manual' },
  { value: 'origen_ot', label: 'Origen de OT' },
  { value: 'cotizacion_postservicio', label: 'Cotización postservicio' },
  { value: 'consolidacion_mensual', label: 'Consolidación mensual' },
  { value: 'trabajo_adicional', label: 'Trabajo adicional' },
  { value: 'ampliacion_alcance', label: 'Ampliación de alcance' },
  { value: 'regularizacion', label: 'Regularización' },
] as const

const TIPO_RELACION_LABELS = Object.fromEntries(
  TIPOS_RELACION.map((tipo) => [tipo.value, tipo.label])
) as Record<string, string>

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
}

function formatCurrency(value: number | string | null) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount == null || !Number.isFinite(amount)) return null
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(amount)
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export default function CotizacionOtRelacionesPanel(props: Props) {
  const [relaciones, setRelaciones] = useState<Relacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [opcionesOt, setOpcionesOt] = useState<OtRelacionada[]>([])
  const [opcionesCotizacion, setOpcionesCotizacion] = useState<CotizacionRelacionada[]>([])
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [tipoRelacion, setTipoRelacion] = useState('vinculo_manual')
  const [montoAsociado, setMontoAsociado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [saving, setSaving] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const searchRequestId = useRef(0)

  const {
    modo,
    empresaId,
    clienteId,
    puedeAdministrar = false,
    crearOtHref,
    crearCotizacionHref,
  } = props
  const registroId = modo === 'cotizacion' ? props.cotizacionId : props.otId

  const loadRelaciones = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    setError(null)
    const select = modo === 'cotizacion'
      ? 'id, tipo_relacion, monto_asociado, observacion, ot:ot_ordenes_trabajo(id, folio, titulo, fecha_ot, fecha_cierre, cliente_id)'
      : 'id, tipo_relacion, monto_asociado, observacion, cotizacion:cotizaciones(id, codigo, folio, titulo, estado, fecha_emision, total, cliente_id)'
    const filterColumn = modo === 'cotizacion' ? 'cotizacion_id' : 'ot_id'
    const { data, error: queryError } = await supabase
      .from('cotizacion_ot_relaciones').select(select)
      .eq('empresa_id', empresaId).eq(filterColumn, registroId).eq('activo', true)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('Error al cargar relaciones Cotización ↔ OT:', queryError)
      setRelaciones([])
      setError('No fue posible cargar las relaciones en este momento.')
    } else {
      const rows = (data ?? []) as unknown as Array<Omit<Relacion, 'ot' | 'cotizacion'> & {
        ot?: OtRelacionada | OtRelacionada[] | null
        cotizacion?: CotizacionRelacionada | CotizacionRelacionada[] | null
      }>
      setRelaciones(rows.map((row) => ({
        ...row,
        ot: normalizeRelation(row.ot ?? null),
        cotizacion: normalizeRelation(row.cotizacion ?? null),
      })))
    }
    setLoading(false)
  }, [empresaId, modo, registroId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRelaciones(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadRelaciones])

  const abrirModal = () => {
    if (!clienteId) return
    setModalOpen(true)
    setModalLoading(true)
    setModalError(null)
    setOpcionesOt([])
    setOpcionesCotizacion([])
    setSeleccionados([])
    setBusqueda('')
    setTipoRelacion('vinculo_manual')
    setMontoAsociado('')
    setObservacion('')
  }

  const buscarOpciones = useCallback(async (searchTerm: string) => {
    if (!clienteId) return
    const requestId = ++searchRequestId.current
    setModalLoading(true)
    setModalError(null)
    const relationFilter = modo === 'cotizacion' ? 'cotizacion_id' : 'ot_id'
    const relatedColumn = modo === 'cotizacion' ? 'ot_id' : 'cotizacion_id'
    const term = searchTerm.trim().replace(/[,%()]/g, ' ')

    let opcionesQuery
    if (modo === 'cotizacion') {
      opcionesQuery = supabase.from('ot_vw_resumen')
        .select('id, folio, titulo, fecha_ot, fecha_programada, fecha_cierre, estado_nombre, cliente_id')
        .eq('empresa_id', empresaId)
        .eq('cliente_id', clienteId)
        .order('fecha_ot', { ascending: false })
        .limit(50)
      if (term) opcionesQuery = opcionesQuery.or(`folio.ilike.%${term}%,titulo.ilike.%${term}%`)
    } else {
      opcionesQuery = supabase.from('cotizaciones')
        .select('id, codigo, folio, titulo, estado, fecha_emision, total, cliente_id')
        .eq('empresa_id', empresaId)
        .eq('cliente_id', clienteId)
        .eq('activo', true)
        .is('deleted_at', null)
        .order('fecha_emision', { ascending: false })
        .limit(50)
      if (term) {
        const filters = [`codigo.ilike.%${term}%`, `titulo.ilike.%${term}%`]
        if (/^\d+$/.test(term)) filters.push(`folio.eq.${term}`)
        opcionesQuery = opcionesQuery.or(filters.join(','))
      }
    }

    const [opcionesResp, relacionesResp] = await Promise.all([
      opcionesQuery,
      supabase.from('cotizacion_ot_relaciones').select(relatedColumn)
        .eq('empresa_id', empresaId).eq(relationFilter, registroId).eq('activo', true),
    ])

    if (requestId !== searchRequestId.current) return
    if (opcionesResp.error || relacionesResp.error) {
      console.error('Error al cargar documentos vinculables:', opcionesResp.error || relacionesResp.error)
      setModalError('No fue posible cargar los documentos disponibles.')
    } else {
      const activos = new Set(
        (relacionesResp.data ?? []).map((row) => String(row[relatedColumn as keyof typeof row]))
      )
      if (modo === 'cotizacion') {
        setOpcionesOt((opcionesResp.data as OtRelacionada[]).filter((item) => !activos.has(item.id)))
      } else {
        setOpcionesCotizacion(
          (opcionesResp.data as CotizacionRelacionada[]).filter((item) => !activos.has(item.id))
        )
      }
    }
    setModalLoading(false)
  }, [clienteId, empresaId, modo, registroId])

  useEffect(() => {
    if (!modalOpen) return
    const timeout = window.setTimeout(() => void buscarOpciones(busqueda), 300)
    return () => window.clearTimeout(timeout)
  }, [buscarOpciones, busqueda, modalOpen])

  const opcionesFiltradas = modo === 'cotizacion' ? opcionesOt : opcionesCotizacion

  const guardar = async () => {
    if (seleccionados.length === 0 || !clienteId) {
      setModalError(`Selecciona ${modo === 'cotizacion' ? 'al menos una OT' : 'una cotización'}.`)
      return
    }
    const monto = montoAsociado === '' ? null : Number(montoAsociado)
    if (monto != null && (!Number.isFinite(monto) || monto < 0)) {
      setModalError('El monto asociado debe ser un número mayor o igual a cero.')
      return
    }
    setSaving(true)
    setModalError(null)
    const rows = seleccionados.map((id) => ({
      empresa_id: empresaId,
      cotizacion_id: modo === 'cotizacion' ? registroId : id,
      ot_id: modo === 'cotizacion' ? id : registroId,
      tipo_relacion: tipoRelacion,
      monto_asociado: monto,
      observacion: observacion.trim() || null,
      activo: true,
    }))
    const { error: insertError } = await supabase.from('cotizacion_ot_relaciones').insert(rows)
    if (insertError) {
      console.error('Error al vincular Cotización ↔ OT:', insertError)
      setModalError('No fue posible guardar el vínculo. Verifica que no exista previamente.')
      setSaving(false)
      return
    }
    setModalOpen(false)
    setSaving(false)
    await loadRelaciones()
  }

  const desvincular = async (relacionId: string) => {
    if (!window.confirm('¿Desvincular esta OT/cotización?')) return
    setUnlinkingId(relacionId)
    setError(null)
    const { error: updateError } = await supabase.from('cotizacion_ot_relaciones')
      .update({ activo: false }).eq('id', relacionId).eq('empresa_id', empresaId)
    if (updateError) {
      console.error('Error al desvincular Cotización ↔ OT:', updateError)
      setError('No fue posible desvincular el documento.')
    } else {
      await loadRelaciones()
    }
    setUnlinkingId(null)
  }

  const title = modo === 'cotizacion' ? 'OT relacionadas' : 'Cotizaciones relacionadas'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            La relación Cotización ↔ OT es opcional y se muestra solo como referencia.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {modo === 'cotizacion' && crearOtHref ? (
            <Link href={crearOtHref}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Crear OT desde cotización
            </Link>
          ) : null}
          {modo === 'ot' && crearCotizacionHref ? (
            <Link href={crearCotizacionHref}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Crear cotización desde OT
            </Link>
          ) : null}
          {puedeAdministrar && clienteId ? (
            <button type="button" onClick={abrirModal}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              {modo === 'cotizacion' ? 'Vincular OT' : 'Vincular cotización'}
            </button>
          ) : null}
        </div>
      </div>

      {!clienteId ? (
        <p className="mt-3 text-xs text-amber-700">Se requiere un cliente asociado para vincular documentos.</p>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-slate-600">Cargando relaciones...</p> : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : relaciones.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Aún no existen relaciones registradas.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {relaciones.map((relacion) => {
            const destino = modo === 'cotizacion' ? relacion.ot : relacion.cotizacion
            if (!destino) return null
            const monto = formatCurrency(relacion.monto_asociado)
            const identifier = modo === 'cotizacion'
              ? `OT ${relacion.ot?.folio || 'sin folio'}`
              : relacion.cotizacion?.codigo || (relacion.cotizacion?.folio != null ? `Folio ${relacion.cotizacion.folio}` : 'Cotización sin folio')
            const href = modo === 'cotizacion' ? `/ot/${destino.id}` : `/cotizaciones/${destino.id}`
            return (
              <article key={relacion.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={href} className="font-semibold text-blue-700 hover:text-blue-900 hover:underline">{identifier}</Link>
                    <p className="mt-1 text-sm font-medium text-slate-900">{destino.titulo || 'Sin título'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {TIPO_RELACION_LABELS[relacion.tipo_relacion] || relacion.tipo_relacion}
                    </span>
                    {puedeAdministrar ? (
                      <button type="button" disabled={unlinkingId === relacion.id}
                        onClick={() => void desvincular(relacion.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
                        {unlinkingId === relacion.id ? 'Desvinculando...' : 'Desvincular'}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                  {modo === 'cotizacion' ? (<>
                    <span>Fecha OT: {formatDate(relacion.ot?.fecha_ot ?? null)}</span>
                    {relacion.ot?.fecha_cierre ? <span>Fecha cierre: {formatDate(relacion.ot.fecha_cierre)}</span> : null}
                  </>) : (<>
                    <span>Emisión: {formatDate(relacion.cotizacion?.fecha_emision ?? null)}</span>
                    <span>Estado: {relacion.cotizacion?.estado || '—'}</span>
                    <span>Total: {formatCurrency(relacion.cotizacion?.total ?? null) || '—'}</span>
                  </>)}
                  {monto ? <span>Monto asociado: {monto}</span> : null}
                </div>
                {relacion.observacion ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700"><span className="font-medium">Observación:</span> {relacion.observacion}</p> : null}
              </article>
            )
          })}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="relacion-modal-title">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div><h3 id="relacion-modal-title" className="font-semibold text-slate-900">{modo === 'cotizacion' ? 'Vincular OT' : 'Vincular cotización'}</h3><p className="mt-1 text-xs text-slate-500">Solo se muestran documentos activos del mismo cliente y empresa.</p></div>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-lg px-2 text-2xl leading-none text-slate-500 hover:bg-slate-100" aria-label="Cerrar">×</button>
            </div>
            <div className="overflow-y-auto p-5">
              <label className="block text-sm font-medium text-slate-700">Buscar por {modo === 'cotizacion' ? 'folio o título' : 'código, folio o título'}
                <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar..." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </label>
              <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                {modalLoading ? <p className="p-4 text-sm text-slate-500">Cargando documentos...</p> : opcionesFiltradas.length === 0 ? <p className="p-4 text-sm text-slate-500">No hay documentos disponibles.</p> : opcionesFiltradas.map((item) => {
                  const checked = seleccionados.includes(item.id)
                  const isOt = !('codigo' in item)
                  return <label key={item.id} className="flex cursor-pointer gap-3 border-b border-slate-100 p-3 last:border-0 hover:bg-slate-50">
                    <input type={modo === 'cotizacion' ? 'checkbox' : 'radio'} name="documento-relacion" checked={checked}
                      onChange={() => setSeleccionados((current) => modo === 'cotizacion' ? (checked ? current.filter((id) => id !== item.id) : [...current, item.id]) : [item.id])}
                      className="mt-1 h-4 w-4 accent-blue-600" />
                    <span className="min-w-0 text-sm"><span className="font-semibold text-slate-900">{isOt ? `OT ${item.folio || 'sin folio'}` : item.codigo || `Folio ${item.folio ?? '—'}`}</span><span className="ml-2 text-slate-700">{item.titulo || 'Sin título'}</span><span className="mt-1 block text-xs text-slate-500">{isOt ? `Fecha OT: ${formatDate(item.fecha_ot)} · Programada: ${formatDate(item.fecha_programada ?? null)}${item.estado_nombre ? ` · Estado: ${item.estado_nombre}` : ''}` : `Emisión: ${formatDate(item.fecha_emision)} · Estado: ${item.estado || '—'} · Total: ${formatCurrency(item.total) || '—'}`}</span></span>
                  </label>
                })}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Tipo de relación <select required value={tipoRelacion} onChange={(event) => setTipoRelacion(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">{TIPOS_RELACION.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Monto asociado (opcional)<input type="number" min="0" step="1" value={montoAsociado} onChange={(event) => setMontoAsociado(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Observación (opcional)<textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} rows={3} className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
              {modalError ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{modalError}</div> : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 p-5"><button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button><button type="button" onClick={() => void guardar()} disabled={saving || modalLoading || seleccionados.length === 0} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar vínculo'}</button></div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
