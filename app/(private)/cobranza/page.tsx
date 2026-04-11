'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'
import EmpresaActivaBanner from '../../../components/EmpresaActivaBanner'

type CobranzaPendiente = {
  fecha_emision: string
  fecha_vencimiento: string | null
  cliente: string
  numero_factura: string
  descripcion: string
  monto_total: number
  saldo_pendiente: number
  estado: string
  empresa_id?: string
}

type FiltroEstado =
  | 'todos'
  | 'pendiente'
  | 'parcial'
  | 'vencido'
  | 'por_vencer'

const STORAGE_KEY = 'empresa_activa_id'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatDate = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CL')
}

const getEstadoVisual = (estado: string, fechaVencimiento: string | null) => {
  const base = (estado || '').toLowerCase()

  if (base === 'vencido') return 'vencido'
  if (!fechaVencimiento) return estado
  if (base === 'pagado') return estado

  const hoy = new Date()
  const vencimiento = new Date(`${fechaVencimiento}T23:59:59`)

  if ((base === 'pendiente' || base === 'parcial') && vencimiento < hoy) {
    return 'vencido'
  }

  return estado
}

const isVencida = (estado: string, fechaVencimiento: string | null) => {
  const base = (estado || '').toLowerCase()

  if (base === 'vencido') return true
  if (!fechaVencimiento) return false
  if (base === 'pagado') return false

  const hoy = new Date()
  const vencimiento = new Date(`${fechaVencimiento}T23:59:59`)

  return (base === 'pendiente' || base === 'parcial') && vencimiento < hoy
}

const isPorVencerEstaSemana = (
  estado: string,
  fechaVencimiento: string | null
) => {
  if (!fechaVencimiento) return false

  const base = (estado || '').toLowerCase()
  if (base === 'pagado' || base === 'vencido') return false

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const finSemana = new Date(inicioHoy)
  finSemana.setDate(finSemana.getDate() + 7)

  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)

  return (
    (base === 'pendiente' || base === 'parcial') &&
    vencimiento >= inicioHoy &&
    vencimiento <= finSemana
  )
}

export default function CobranzaPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [documentos, setDocumentos] = useState<CobranzaPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      setEmpresaActivaId(empresaId)
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  useEffect(() => {
    const fetchCobranza = async () => {
      if (!empresaActivaId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const { data: sessionData } = await supabase.auth.getSession()

        if (!sessionData.session) {
          router.push('/login')
          return
        }

        const accessToken = sessionData.session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        const resp = await fetch(
          `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        const json = await resp.json()

        if (!resp.ok) {
          console.error(json)
          setError('No se pudo cargar la cobranza pendiente.')
          return
        }

        setDocumentos(json ?? [])
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Error desconocido')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchCobranza()
  }, [router, empresaActivaId])

  const vencidas = useMemo(
    () =>
      documentos.filter((item) =>
        isVencida(item.estado, item.fecha_vencimiento)
      ),
    [documentos]
  )

  const porVencerSemana = useMemo(
    () =>
      documentos.filter((item) =>
        isPorVencerEstaSemana(item.estado, item.fecha_vencimiento)
      ),
    [documentos]
  )

  const saldoPendienteTotal = useMemo(
    () =>
      documentos.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [documentos]
  )

  const saldoVencidoTotal = useMemo(
    () =>
      vencidas.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [vencidas]
  )

  const saldoPorVencerSemana = useMemo(
    () =>
      porVencerSemana.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [porVencerSemana]
  )

  const documentosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase()

    return documentos.filter((item) => {
      const estadoVisual = getEstadoVisual(item.estado, item.fecha_vencimiento)
        .toLowerCase()
      const texto = [
        item.cliente,
        item.numero_factura,
        item.descripcion,
        item.estado,
      ]
        .join(' ')
        .toLowerCase()

      const cumpleBusqueda = !term || texto.includes(term)

      const cumpleEstado =
        filtroEstado === 'todos'
          ? true
          : filtroEstado === 'por_vencer'
            ? isPorVencerEstaSemana(item.estado, item.fecha_vencimiento)
            : estadoVisual === filtroEstado

      return cumpleBusqueda && cumpleEstado
    })
  }, [documentos, busqueda, filtroEstado])

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Cobranza</h1>
        <p className="mt-2 text-slate-600">
          Control de facturas pendientes, vencidas y documentos próximos a
          vencer de la empresa activa.
        </p>
      </div>

      <EmpresaActivaBanner
        modulo="Cobranza"
        descripcion="Los documentos, estados y saldos visibles pertenecen únicamente a la empresa activa seleccionada."
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando información de cobranza...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Saldo pendiente total</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {formatCLP(saldoPendienteTotal)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {documentos.length} documento(s) pendientes o parciales
              </p>
            </article>

            <article className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <p className="text-sm text-red-700">Saldo vencido</p>
              <h2 className="mt-2 text-3xl font-semibold text-red-900">
                {formatCLP(saldoVencidoTotal)}
              </h2>
              <p className="mt-2 text-sm text-red-700">
                {vencidas.length} documento(s) vencidos
              </p>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-amber-700">Por vencer en 7 días</p>
              <h2 className="mt-2 text-3xl font-semibold text-amber-900">
                {formatCLP(saldoPorVencerSemana)}
              </h2>
              <p className="mt-2 text-sm text-amber-700">
                {porVencerSemana.length} documento(s) próximos a vencer
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Documentos visibles</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {documentosFiltrados.length}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Según filtros aplicados
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Documentos por cobrar
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Revisa el detalle de la cobranza pendiente de la empresa
                  activa.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                    Buscar
                  </label>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Cliente, factura o descripción"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                    Estado
                  </label>
                  <select
                    value={filtroEstado}
                    onChange={(e) =>
                      setFiltroEstado(e.target.value as FiltroEstado)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="parcial">Parcial</option>
                    <option value="vencido">Vencido</option>
                    <option value="por_vencer">Por vencer en 7 días</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {documentosFiltrados.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No hay documentos para mostrar con los filtros actuales.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-3 pr-4">Emisión</th>
                        <th className="py-3 pr-4">Vencimiento</th>
                        <th className="py-3 pr-4">Cliente</th>
                        <th className="py-3 pr-4">Factura</th>
                        <th className="py-3 pr-4">Descripción</th>
                        <th className="py-3 pr-4">Monto</th>
                        <th className="py-3 pr-4">Saldo pendiente</th>
                        <th className="py-3 pr-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentosFiltrados.map((item, index) => {
                        const estadoVisual = getEstadoVisual(
                          item.estado,
                          item.fecha_vencimiento
                        )

                        return (
                          <tr
                            key={`${item.numero_factura}-${item.cliente}-${item.fecha_emision}-${index}`}
                            className="border-b border-slate-100"
                          >
                            <td className="py-3 pr-4">
                              {formatDate(item.fecha_emision)}
                            </td>
                            <td className="py-3 pr-4">
                              {formatDate(item.fecha_vencimiento)}
                            </td>
                            <td className="py-3 pr-4">{item.cliente}</td>
                            <td className="py-3 pr-4">
                              {item.numero_factura}
                            </td>
                            <td className="py-3 pr-4">{item.descripcion}</td>
                            <td className="py-3 pr-4 font-medium">
                              {formatCLP(item.monto_total)}
                            </td>
                            <td className="py-3 pr-4 font-semibold text-slate-900">
                              {formatCLP(item.saldo_pendiente)}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusBadge status={estadoVisual} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}