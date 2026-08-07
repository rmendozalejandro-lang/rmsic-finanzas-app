'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Props =
  | {
      modo: 'cotizacion'
      cotizacionId: string
      empresaId: string
    }
  | {
      modo: 'ot'
      otId: string
      empresaId: string
    }

type OtRelacionada = {
  id: string
  folio: string | null
  titulo: string | null
  fecha_ot: string | null
  fecha_cierre: string | null
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

const TIPO_RELACION_LABELS: Record<string, string> = {
  vinculo_manual: 'Vínculo manual',
  origen_ot: 'Origen de OT',
  cotizacion_postservicio: 'Cotización postservicio',
  consolidacion_mensual: 'Consolidación mensual',
  trabajo_adicional: 'Trabajo adicional',
  ampliacion_alcance: 'Ampliación de alcance',
  regularizacion: 'Regularización',
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value: number | string | null) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount == null || !Number.isFinite(amount)) return null

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export default function CotizacionOtRelacionesPanel(props: Props) {
  const [relaciones, setRelaciones] = useState<Relacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { modo, empresaId } = props
  const registroId = modo === 'cotizacion' ? props.cotizacionId : props.otId

  useEffect(() => {
    let active = true

    async function loadRelaciones() {
      setLoading(true)
      setError(null)

      const select =
        modo === 'cotizacion'
          ? 'id, tipo_relacion, monto_asociado, observacion, ot:ot_ordenes_trabajo(id, folio, titulo, fecha_ot, fecha_cierre, cliente_id)'
          : 'id, tipo_relacion, monto_asociado, observacion, cotizacion:cotizaciones(id, codigo, folio, titulo, estado, fecha_emision, total, cliente_id)'

      const filterColumn = modo === 'cotizacion' ? 'cotizacion_id' : 'ot_id'
      const { data, error: queryError } = await supabase
        .from('cotizacion_ot_relaciones')
        .select(select)
        .eq('empresa_id', empresaId)
        .eq(filterColumn, registroId)
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (!active) return

      if (queryError) {
        console.error('Error al cargar relaciones Cotización ↔ OT:', queryError)
        setRelaciones([])
        setError('No fue posible cargar las relaciones en este momento.')
      } else {
        const rows = (data ?? []) as unknown as Array<
          Omit<Relacion, 'ot' | 'cotizacion'> & {
            ot?: OtRelacionada | OtRelacionada[] | null
            cotizacion?: CotizacionRelacionada | CotizacionRelacionada[] | null
          }
        >

        setRelaciones(
          rows.map((row) => ({
            ...row,
            ot: normalizeRelation(row.ot ?? null),
            cotizacion: normalizeRelation(row.cotizacion ?? null),
          }))
        )
      }

      setLoading(false)
    }

    void loadRelaciones()

    return () => {
      active = false
    }
  }, [empresaId, modo, registroId])

  const title = modo === 'cotizacion' ? 'OT relacionadas' : 'Cotizaciones relacionadas'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          La relación Cotización ↔ OT es opcional y se muestra solo como referencia.
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Cargando relaciones...</p>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : relaciones.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Aún no existen relaciones registradas.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {relaciones.map((relacion) => {
            const destino = modo === 'cotizacion' ? relacion.ot : relacion.cotizacion
            if (!destino) return null

            const monto = formatCurrency(relacion.monto_asociado)
            const identifier =
              modo === 'cotizacion'
                ? `OT ${relacion.ot?.folio || 'sin folio'}`
                : relacion.cotizacion?.codigo ||
                  (relacion.cotizacion?.folio != null
                    ? `Folio ${relacion.cotizacion.folio}`
                    : 'Cotización sin folio')
            const href =
              modo === 'cotizacion' ? `/ot/${destino.id}` : `/cotizaciones/${destino.id}`

            return (
              <article key={relacion.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={href} className="font-semibold text-blue-700 hover:text-blue-900 hover:underline">
                      {identifier}
                    </Link>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {destino.titulo || 'Sin título'}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {TIPO_RELACION_LABELS[relacion.tipo_relacion] || relacion.tipo_relacion}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                  {modo === 'cotizacion' ? (
                    <>
                      <span>Fecha OT: {formatDate(relacion.ot?.fecha_ot ?? null)}</span>
                      {relacion.ot?.fecha_cierre ? (
                        <span>Fecha cierre: {formatDate(relacion.ot.fecha_cierre)}</span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span>Emisión: {formatDate(relacion.cotizacion?.fecha_emision ?? null)}</span>
                      <span>Estado: {relacion.cotizacion?.estado || '—'}</span>
                      <span>Total: {formatCurrency(relacion.cotizacion?.total ?? null) || '—'}</span>
                    </>
                  )}
                  {monto ? <span>Monto asociado: {monto}</span> : null}
                </div>

                {relacion.observacion ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    <span className="font-medium">Observación:</span> {relacion.observacion}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
