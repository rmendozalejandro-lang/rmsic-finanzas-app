'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'
import EmpresaActivaBanner from '../../../components/EmpresaActivaBanner'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'

type CobranzaItem = {
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

type FiltroEstado = 'todos' | 'pendiente' | 'parcial' | 'vencido'

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

const isPorVencerEstaSemana = (estado: string, fechaVencimiento: string | null) => {
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
  const [cobranza, setCobranza] = useState<CobranzaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

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

  const loadData = useCallback(async () => {
    if (!empresaActivaId) return

    try {
      setLoading(true)
      setError('')

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const userId = sessionData.session.user.id
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const headers = {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
      }

      const [cobranzaResp, rolResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&order=fecha_vencimiento.asc.nullslast`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/usuario_empresas?select=rol&usuario_id=eq.${userId}&empresa_id=eq.${empresaActivaId}&activo=eq.true`,
          { headers }
        ),
      ])

      const cobranzaJson = await cobranzaResp.json()
      const rolJson = await rolResp.json()

      if (!cobranzaResp.ok) {
        setError('No se pudo cargar la cobranza pendiente.')
        return
      }

      if (!rolResp.ok) {
        setError('No se pudo cargar el rol del usuario.')
        return
      }

      const rol =
        Array.isArray(rolJson) && rolJson.length > 0 ? rolJson[0].rol || '' : ''

      setUsuarioRol(rol)
      setIsAdmin(rol === 'admin')
      setCobranza(cobranzaJson ?? [])
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al cargar cobranza.')
      }
    } finally {
      setLoading(false)
    }
  }, [empresaActivaId, router])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const cobranzaConEstadoVisual = useMemo(
    () =>
      cobranza.map((item) => ({
        ...item,
        estado_visual: getEstadoVisual(item.estado, item.fecha_vencimiento),
      })),
    [cobranza]
  )

  const totalPendiente = useMemo(
    () =>
      cobranzaConEstadoVisual.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [cobranzaConEstadoVisual]
  )

  const vencidas = useMemo(
    () =>
      cobranzaConEstadoVisual.filter((item) =>
        isVencida(item.estado, item.fecha_vencimiento)
      ),
    [cobranzaConEstadoVisual]
  )

  const porVencer = useMemo(
    () =>
      cobranzaConEstadoVisual.filter((item) =>
        isPorVencerEstaSemana(item.estado, item.fecha_vencimiento)
      ),
    [cobranzaConEstadoVisual]
  )

  const montoVencido = useMemo(
    () =>
      vencidas.reduce(
        (acc, item) => acc + Number(item.saldo_pendiente || 0),
        0
      ),
    [vencidas]
  )

  const cobranzasParciales = useMemo(
    () =>
      cobranzaConEstadoVisual.filter(
        (item) => (item.estado || '').toLowerCase() === 'parcial'
      ),
    [cobranzaConEstadoVisual]
  )

  const datosFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return cobranzaConEstadoVisual

    if (filtroEstado === 'vencido') {
      return cobranzaConEstadoVisual.filter(
        (item) => item.estado_visual.toLowerCase() === 'vencido'
      )
    }

    return cobranzaConEstadoVisual.filter(
      (item) => (item.estado || '').toLowerCase() === filtroEstado
    )
  }, [cobranzaConEstadoVisual, filtroEstado])

  return (
    <ProtectedModuleRoute moduleKey="cobranza">
      <main className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">Cobranza</h1>
            <p className="mt-2 text-slate-600">
              Seguimiento de facturas pendientes y documentos por cobrar de la empresa activa.
            </p>
          </div>

          <Link
            href="/reportes"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ver reportes
          </Link>
        </div>

        <EmpresaActivaBanner
          modulo="Cobranza"
          descripcion="Todos los documentos visibles corresponden únicamente a la empresa activa seleccionada."
        />

        {!isAdmin && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El usuario actual tiene rol <span className="font-semibold">{usuarioRol || 'sin rol asignado'}</span>. En cobranza solo el administrador tendrá disponibles acciones sensibles.
          </div>
        ) : null}

        <section className="rounded-2xl border-2 border-[#163A5F] bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Filtros de cobranza
            </h2>
            <p className="text-sm text-slate-500">
              Filtre los documentos por estado del seguimiento.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'todos'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setFiltroEstado('pendiente')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'pendiente'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pendientes
            </button>

            <button
              onClick={() => setFiltroEstado('parcial')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'parcial'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Parciales
            </button>

            <button
              onClick={() => setFiltroEstado('vencido')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filtroEstado === 'vencido'
                  ? 'bg-[#163A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Vencidos
            </button>
          </div>
        </section>

        {!loading && !error && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total por cobrar</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {formatCLP(totalPendiente)}
              </h2>
            </article>

            <article className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <p className="text-sm text-red-700">Facturas vencidas</p>
              <h2 className="mt-2 text-3xl font-semibold text-red-900">
                {vencidas.length}
              </h2>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-amber-700">Monto vencido</p>
              <h2 className="mt-2 text-3xl font-semibold text-amber-900">
                {formatCLP(montoVencido)}
              </h2>
            </article>

            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <p className="text-sm text-blue-700">Por vencer esta semana</p>
              <h2 className="mt-2 text-3xl font-semibold text-blue-900">
                {porVencer.length}
              </h2>
            </article>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Listado de cobranza
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Facturas y saldos pendientes obtenidos desde la vista de cobranza.
              </p>
            </div>

            {loading && <div className="text-slate-500">Cargando cobranza...</div>}

            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && datosFiltrados.length === 0 && (
              <div className="text-sm text-slate-500">
                No hay documentos para el filtro seleccionado.
              </div>
            )}

            {!loading && !error && datosFiltrados.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Cliente</th>
                      <th className="py-3 pr-4">Factura</th>
                      <th className="py-3 pr-4">Emisión</th>
                      <th className="py-3 pr-4">Vencimiento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Monto total</th>
                      <th className="py-3 pr-4">Saldo pendiente</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosFiltrados.map((item, index) => (
                      <tr
                        key={`${item.numero_factura}-${index}`}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 pr-4">{item.cliente}</td>
                        <td className="py-3 pr-4">{item.numero_factura}</td>
                        <td className="py-3 pr-4">{formatDate(item.fecha_emision)}</td>
                        <td className="py-3 pr-4">{formatDate(item.fecha_vencimiento)}</td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4">
                          {formatCLP(Number(item.monto_total))}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {formatCLP(Number(item.saldo_pendiente))}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={item.estado_visual} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
            <h2 className="text-2xl font-semibold text-slate-900">
              Resumen de cobranza
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Indicadores rápidos de seguimiento.
            </p>

            <div className="space-y-4">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Documentos pendientes</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {
                    cobranzaConEstadoVisual.filter(
                      (item) => (item.estado || '').toLowerCase() === 'pendiente'
                    ).length
                  }
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Documentos parciales</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {cobranzasParciales.length}
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Vencidas</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {vencidas.length}
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Por vencer esta semana</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {porVencer.length}
                </p>
              </article>

              {isAdmin ? (
                <article className="rounded-xl border border-[#163A5F] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Acciones sensibles reservadas
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Este bloque queda reservado para futuras acciones de gestión de cobranza exclusivas para administrador.
                  </p>
                </article>
              ) : (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Acciones restringidas
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    El usuario actual puede visualizar y filtrar, pero no tendrá acciones sensibles habilitadas.
                  </p>
                </article>
              )}
            </div>
          </section>
        </div>
      </main>
    </ProtectedModuleRoute>
  )
}