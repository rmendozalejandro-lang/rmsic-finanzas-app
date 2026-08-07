'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type RelacionBase = {
  id: string
  tipo_relacion: string
  monto_asociado: number | null
  observacion: string | null
  created_at: string
}

type OtMini = {
  id: string
  folio: string | null
  titulo: string
  fecha_ot: string
  fecha_cierre: string | null
  cliente_id: string
}

type CotizacionMini = {
  id: string
  codigo: string | null
  folio: number | null
  titulo: string
  estado: string
  fecha_emision: string | null
  total: number | null
  cliente_id: string | null
}

type RelacionCotizacion = RelacionBase & {
  ot: OtMini | OtMini[] | null
}

type RelacionOt = RelacionBase & {
  cotizacion: CotizacionMini | CotizacionMini[] | null
}

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

const TIPO_RELACION_LABELS: Record<string, string> = {
  vinculo_manual: 'Vínculo manual',
  origen_ot: 'Origen de OT',
  cotizacion_postservicio: 'Cotización postservicio',
  consolidacion_mensual: 'Consolidación mensual',
  trabajo_adicional: 'Trabajo adicional',
  ampliacion_alcance: 'Ampliación de alcance',
  regularizacion: 'Regularización',
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return null
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const normalized = value.length === 10 ? `${value}T00:00:00` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export default function CotizacionOtRelacionesPanel(props: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [relacionesCotizacion, setRelacionesCotizacion] = useState<RelacionCotizacion[]>([])
  const [relacionesOt, setRelacionesOt] = useState<RelacionOt[]>([])

  const modo = props.modo
  const empresaId = props.empresaId
  const entidadId = props.modo === 'cotizacion' ? props.cotizacionId : props.otId

  useEffect(() => {
    let active = true

    async function cargar() {
      setLoading(true)
      setError('')

      try {
        if (modo === 'cotizacion') {
          const { data, error: queryError } = await supabase
            .from('cotizacion_ot_relaciones')
            .select(`
              id,
              tipo_relacion,
              monto_asociado,
              observacion,
              created_at,
              ot:ot_ordenes_trabajo!cotizacion_ot_relaciones_ot_id_fkey(
                id,
                folio,
                titulo,
                fecha_ot,
                fecha_cierre,
                cliente_id
              )
            `)
            .eq('empresa_id', empresaId)
            .eq('cotizacion_id', entidadId)
            .eq('activo', true)
            .order('created_at', { ascending: true })

          if (queryError) throw queryError
          if (!active) return
          setRelacionesCotizacion((data ?? []) as unknown as RelacionCotizacion[])
        } else {
          const { data, error: queryError } = await supabase
            .from('cotizacion_ot_relaciones')
            .select(`
              id,
              tipo_relacion,
              monto_asociado,
              observacion,
              created_at,
              cotizacion:cotizaciones!cotizacion_ot_relaciones_cotizacion_id_fkey(
                id,
                codigo,
                folio,
                titulo,
                estado,
                fecha_emision,
                total,
                cliente_id
              )
            `)
            .eq('empresa_id', empresaId)
            .eq('ot_id', entidadId)
            .eq('activo', true)
            .order('created_at', { ascending: true })

          if (queryError) throw queryError
          if (!active) return
          setRelacionesOt((data ?? []) as unknown as RelacionOt[])
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las relaciones.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void cargar()

    return () => {
      active = false
    }
  }, [modo, empresaId, entidadId])

  const cantidad = modo === 'cotizacion' ? relacionesCotizacion.length : relacionesOt.length

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {modo === 'cotizacion' ? 'OT relacionadas' : 'Cotizaciones relacionadas'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Relaciones comerciales registradas entre cotizaciones y órdenes de trabajo.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          {cantidad} vínculo(s)
        </span>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Cargando relaciones...
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && cantidad === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          Aún no existen relaciones registradas. Esta vista no crea ni modifica documentos.
        </div>
      ) : null}

      {!loading && !error && modo === 'cotizacion' && relacionesCotizacion.length > 0 ? (
        <div className="mt-4 space-y-3">
          {relacionesCotizacion.map((relacion) => {
            const ot = firstRelation(relacion.ot)
            if (!ot) return null

            return (
              <div key={relacion.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link href={`/ot/${ot.id}`} className="font-semibold text-[#163A5F] hover:underline">
                      {ot.folio || 'OT sin folio'} · {ot.titulo}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      Fecha OT: {formatDate(ot.fecha_ot)}
                      {ot.fecha_cierre ? ` · Cierre: ${formatDate(ot.fecha_cierre)}` : ''}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {TIPO_RELACION_LABELS[relacion.tipo_relacion] || relacion.tipo_relacion}
                  </span>
                </div>
                {relacion.monto_asociado != null || relacion.observacion ? (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {relacion.monto_asociado != null ? (
                      <p>Monto asociado: {formatCurrency(relacion.monto_asociado)}</p>
                    ) : null}
                    {relacion.observacion ? <p className="mt-1">{relacion.observacion}</p> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {!loading && !error && modo === 'ot' && relacionesOt.length > 0 ? (
        <div className="mt-4 space-y-3">
          {relacionesOt.map((relacion) => {
            const cotizacion = firstRelation(relacion.cotizacion)
            if (!cotizacion) return null

            return (
              <div key={relacion.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href={`/cotizaciones/${cotizacion.id}`}
                      className="font-semibold text-[#163A5F] hover:underline"
                    >
                      {cotizacion.codigo || `Cotización ${cotizacion.folio ?? '—'}`} · {cotizacion.titulo}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      Emisión: {formatDate(cotizacion.fecha_emision)} · Estado: {cotizacion.estado}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {TIPO_RELACION_LABELS[relacion.tipo_relacion] || relacion.tipo_relacion}
                  </span>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  {cotizacion.total != null ? <p>Total cotización: {formatCurrency(cotizacion.total)}</p> : null}
                  {relacion.monto_asociado != null ? (
                    <p className="mt-1">Monto asociado: {formatCurrency(relacion.monto_asociado)}</p>
                  ) : null}
                  {relacion.observacion ? <p className="mt-1">{relacion.observacion}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
