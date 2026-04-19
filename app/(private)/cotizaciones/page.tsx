'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedCotizacionesRoute from '@/components/ProtectedCotizacionesRoute'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type EstadoCotizacion =
  | 'borrador'
  | 'enviada'
  | 'aprobada'
  | 'rechazada'
  | 'vencida'

type CotizacionRow = {
  id: string
  empresa_id: string
  cliente_id: string | null
  folio: number | null
  codigo: string | null
  estado: EstadoCotizacion
  titulo: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  moneda: string | null
  subtotal_neto: number | null
  subtotal_exento: number | null
  monto_iva: number | null
  total: number | null
  created_at?: string | null
}

type ClienteRow = {
  id: string
  nombre?: string | null
  razon_social?: string | null
  nombre_fantasia?: string | null
  empresa?: string | null
  cliente?: string | null
  rut?: string | null
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatCurrency(
  value: number | string | null | undefined,
  currency = 'CLP'
) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: currency || 'CLP',
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getEstadoStyles(estado: EstadoCotizacion) {
  switch (estado) {
    case 'borrador':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'enviada':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'aprobada':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'rechazada':
      return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'vencida':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function isExpired(fechaVencimiento: string | null | undefined) {
  if (!fechaVencimiento) return false

  const today = new Date()
  const limit = new Date(`${fechaVencimiento}T23:59:59`)

  return limit.getTime() < today.getTime()
}

function getClienteDisplayName(cliente: ClienteRow | undefined) {
  if (!cliente) return 'Sin cliente'

  return (
    cliente.razon_social ||
    cliente.nombre ||
    cliente.nombre_fantasia ||
    cliente.empresa ||
    cliente.cliente ||
    cliente.rut ||
    'Sin cliente'
  )
}

export default function CotizacionesPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [cotizaciones, setCotizaciones] = useState<CotizacionRow[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, ClienteRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
      const empresaNombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

      setEmpresaActivaId(empresaId)
      setEmpresaActivaNombre(empresaNombre)
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!empresaActivaId) {
        setCotizaciones([])
        setClientesMap({})
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        const session = data.session

        if (sessionError || !session) {
          setError('No se pudo recuperar la sesión activa del navegador.')
          setLoading(false)
          return
        }

        const accessToken = session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        if (!apiKey || !baseUrl) {
          setError('Faltan variables públicas de Supabase.')
          setLoading(false)
          return
        }

        const [cotizacionesResp, clientesResp] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/cotizaciones?empresa_id=eq.${empresaActivaId}&select=id,empresa_id,cliente_id,folio,codigo,estado,titulo,fecha_emision,fecha_vencimiento,moneda,subtotal_neto,subtotal_exento,monto_iva,total,created_at&order=created_at.desc`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          ),
          fetch(
            `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&select=*&order=nombre.asc`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          ),
        ])

        const cotizacionesJson = await cotizacionesResp.json()
        const clientesJson = await clientesResp.json()

        if (!cotizacionesResp.ok) {
          setError(
            cotizacionesJson?.message ||
              cotizacionesJson?.error_description ||
              cotizacionesJson?.error ||
              'No se pudieron cargar las cotizaciones.'
          )
          setLoading(false)
          return
        }

        if (!clientesResp.ok) {
          setError(
            clientesJson?.message ||
              clientesJson?.error_description ||
              clientesJson?.error ||
              'No se pudieron cargar los clientes.'
          )
          setLoading(false)
          return
        }

        const clientesIndex: Record<string, ClienteRow> = {}
        for (const cliente of (clientesJson ?? []) as ClienteRow[]) {
          clientesIndex[cliente.id] = cliente
        }

        setClientesMap(clientesIndex)
        setCotizaciones((cotizacionesJson ?? []) as CotizacionRow[])
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error cargando las cotizaciones.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [empresaActivaId])

  const filteredCotizaciones = useMemo(() => {
    const term = q.trim().toLowerCase()

    return cotizaciones.filter((row) => {
      const cliente = row.cliente_id ? clientesMap[row.cliente_id] : undefined
      const clienteNombre = getClienteDisplayName(cliente).toLowerCase()

      const matchesEstado = estado ? row.estado === estado : true
      const matchesQ = term
        ? [
            row.codigo || '',
            row.titulo || '',
            String(row.folio ?? ''),
            clienteNombre,
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true

      return matchesEstado && matchesQ
    })
  }, [cotizaciones, clientesMap, q, estado])

  const resumen = useMemo(() => {
    return filteredCotizaciones.reduce(
      (acc, row) => {
        acc.total += 1
        acc.montoTotal += toNumber(row.total)

        if (row.estado === 'borrador') acc.borrador += 1
        if (row.estado === 'enviada') acc.enviada += 1
        if (row.estado === 'aprobada') acc.aprobada += 1
        if (row.estado === 'rechazada') acc.rechazada += 1
        if (row.estado === 'vencida') acc.vencida += 1

        return acc
      },
      {
        total: 0,
        borrador: 0,
        enviada: 0,
        aprobada: 0,
        rechazada: 0,
        vencida: 0,
        montoTotal: 0,
      }
    )
  }, [filteredCotizaciones])

  if (!empresaActivaId && !loading) {
    return (
      <ProtectedCotizacionesRoute>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Cotizaciones
            </h1>
            <p className="mt-2 text-sm text-slate-700">
              No se encontró una empresa activa en el navegador.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Vuelve al dashboard, selecciona una empresa y entra nuevamente a
              este módulo.
            </p>
          </div>
        </div>
      </ProtectedCotizacionesRoute>
    )
  }

  return (
    <ProtectedCotizacionesRoute>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Módulo</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Cotizaciones
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Empresa activa:{' '}
              <span className="font-medium text-slate-900">
                {empresaActivaNombre || empresaActivaId}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/cotizaciones/nueva"
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Nueva cotización
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total cotizaciones</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {resumen.total}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Borrador</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {resumen.borrador}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Enviadas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {resumen.enviada}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Aprobadas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {resumen.aprobada}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Rechazadas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {resumen.rechazada}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Monto total</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {formatCurrency(resumen.montoTotal)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_140px]">
            <div>
              <label
                htmlFor="q"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Buscar
              </label>
              <input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Código, título, folio o cliente"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="estado"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Estado
              </label>
              <select
                id="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              >
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="vencida">Vencida</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setQ('')
                  setEstado('')
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Listado</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredCotizaciones.length} resultado
              {filteredCotizaciones.length === 1 ? '' : 's'}
            </p>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-600">
              Cargando cotizaciones...
            </div>
          ) : error ? (
            <div className="p-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            </div>
          ) : filteredCotizaciones.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600">
                No hay cotizaciones para mostrar.
              </p>
              <div className="mt-4">
                <Link
                  href="/cotizaciones/nueva"
                  className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Crear primera cotización
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Folio</th>
                    <th className="px-5 py-3 font-medium">Código</th>
                    <th className="px-5 py-3 font-medium">Título</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Emisión</th>
                    <th className="px-5 py-3 font-medium">Vencimiento</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium text-right">Neto</th>
                    <th className="px-5 py-3 font-medium text-right">IVA</th>
                    <th className="px-5 py-3 font-medium text-right">Total</th>
                    <th className="px-5 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCotizaciones.map((row) => {
                    const cliente = row.cliente_id
                      ? clientesMap[row.cliente_id]
                      : undefined
                    const expired = isExpired(row.fecha_vencimiento)

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {row.folio ?? '—'}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {row.codigo || '—'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">
                            {row.titulo}
                          </div>
                          <div className="text-xs text-slate-500">{row.id}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {getClienteDisplayName(cliente)}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {formatDate(row.fecha_emision)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-slate-700">
                            {formatDate(row.fecha_vencimiento)}
                          </div>
                          {expired && row.estado !== 'vencida' ? (
                            <div className="text-xs font-medium text-amber-700">
                              Fecha vencida
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getEstadoStyles(
                              row.estado
                            )}`}
                          >
                            {row.estado}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-700">
                          {formatCurrency(row.subtotal_neto, row.moneda ?? 'CLP')}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-700">
                          {formatCurrency(row.monto_iva, row.moneda ?? 'CLP')}
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(row.total, row.moneda ?? 'CLP')}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/cotizaciones/${row.id}`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                            >
                              Ver
                            </Link>
                            <Link
                              href={`/cotizaciones/${row.id}/editar`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                            >
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ProtectedCotizacionesRoute>
  )
}