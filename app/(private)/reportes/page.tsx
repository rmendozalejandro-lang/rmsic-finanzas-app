'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'

type CobranzaPendiente = {
  empresa_id: string
  fecha_emision: string
  fecha_vencimiento: string | null
  cliente: string
  numero_factura: string
  descripcion: string
  monto_total: number
  saldo_pendiente: number
  estado: string
}

type SaldoBancario = {
  empresa_id: string
  id: string
  banco: string
  nombre_cuenta: string
  saldo_inicial: number
  ingresos_pagados: number
  egresos_pagados: number
  saldo_calculado: number
}

type EgresoTributario = {
  id: string
  empresa_id: string
  fecha: string
  descripcion: string
  tratamiento_tributario: string
  monto_neto: number
  monto_iva: number
  impuesto_especifico: number
  monto_exento: number
  monto_total: number
}

type VentaClienteRow = {
  cliente_id: string | null
  monto_total: number
  estado: string
  clientes?: {
    nombre: string
  } | null
}

type VentaPorCliente = {
  cliente: string
  cantidad_documentos: number
  total_vendido: number
  total_pagado: number
  total_pendiente: number
}

type Empresa = {
  id: string
  nombre: string
}

const STORAGE_KEY = 'empresa_activa_id'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatTratamientoTributario = (value: string) => {
  switch (value) {
    case 'afecto_iva':
      return 'Afecto IVA'
    case 'exento':
      return 'Exento'
    case 'combustible':
      return 'Combustible'
    default:
      return value || '-'
  }
}

const formatFechaLarga = (date: Date) =>
  new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)

const getEmpresaBranding = (empresaNombre: string) => {
  const nombre = (empresaNombre || '').toLowerCase()

  if (nombre.includes('rukalaf')) {
    return {
      titulo: 'Rukalaf Experience SpA',
      subtitulo: 'Plataforma financiera y contable por empresa activa.',
      logoSrc: '/rukalaf-logo.png',
      mostrarLogo: true, // cambia a true cuando subas rukalaf-logo.png
      marcaCorta: 'RUKALAF',
    }
  }

  return {
    titulo: 'RMSIC',
    subtitulo: 'Plataforma financiera y contable por empresa activa.',
    logoSrc: '/rmsic-logo.png',
    mostrarLogo: true,
    marcaCorta: 'RMSIC',
  }
}

export default function ReportesPage() {
  const router = useRouter()

  const hoy = new Date()
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const hoyStr = hoy.toISOString().slice(0, 10)

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes)
  const [fechaHasta, setFechaHasta] = useState(hoyStr)
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    desde: primerDiaMes,
    hasta: hoyStr,
  })

  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [saldos, setSaldos] = useState<SaldoBancario[]>([])
  const [egresosTributarios, setEgresosTributarios] = useState<EgresoTributario[]>([])
  const [ventasRows, setVentasRows] = useState<VentaClienteRow[]>([])
  const [ingresosFiltrados, setIngresosFiltrados] = useState<{ monto_total: number }[]>([])
  const [egresosFiltrados, setEgresosFiltrados] = useState<{ monto_total: number }[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    const fetchEmpresas = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()

        if (!sessionData.session) return

        const accessToken = sessionData.session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        const resp = await fetch(
          `${baseUrl}/rest/v1/empresas?select=id,nombre&order=nombre.asc`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        const json = await resp.json()

        if (resp.ok) {
          setEmpresas(json ?? [])
        }
      } catch (err) {
        console.error('Error cargando empresas:', err)
      }
    }

    fetchEmpresas()
  }, [])

  const fetchReportes = async (desde: string, hasta: string) => {
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
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const headers = {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
      }

      const [cobranzaResp, saldosResp, egresosResp, ventasResp, ingresosResp, egresosTotResp] =
        await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/v_cobranza_pendiente?empresa_id=eq.${empresaActivaId}&select=*&fecha_emision=gte.${desde}&fecha_emision=lte.${hasta}&order=fecha_vencimiento.asc.nullslast`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=*`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&fecha=gte.${desde}&fecha=lte.${hasta}&select=id,empresa_id,fecha,descripcion,tratamiento_tributario,monto_neto,monto_iva,impuesto_especifico,monto_exento,monto_total&order=fecha.desc`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${desde}&fecha=lte.${hasta}&select=cliente_id,monto_total,estado,clientes(nombre)`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${desde}&fecha=lte.${hasta}&select=monto_total`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&fecha=gte.${desde}&fecha=lte.${hasta}&select=monto_total`,
            { headers }
          ),
        ])

      const cobranzaJson = await cobranzaResp.json()
      const saldosJson = await saldosResp.json()
      const egresosJson = await egresosResp.json()
      const ventasJson = await ventasResp.json()
      const ingresosJson = await ingresosResp.json()
      const egresosTotJson = await egresosTotResp.json()

      if (!cobranzaResp.ok) {
        console.error(cobranzaJson)
        setError('No se pudo cargar la cobranza pendiente.')
        return
      }

      if (!saldosResp.ok) {
        console.error(saldosJson)
        setError('No se pudieron cargar los saldos bancarios.')
        return
      }

      if (!egresosResp.ok) {
        console.error(egresosJson)
        setError('No se pudo cargar el resumen tributario.')
        return
      }

      if (!ventasResp.ok) {
        console.error(ventasJson)
        setError('No se pudo cargar ventas por cliente.')
        return
      }

      if (!ingresosResp.ok || !egresosTotResp.ok) {
        setError('No se pudo cargar el resultado del período.')
        return
      }

      setCobranza(cobranzaJson ?? [])
      setSaldos(saldosJson ?? [])
      setEgresosTributarios(egresosJson ?? [])
      setVentasRows(ventasJson ?? [])
      setIngresosFiltrados(ingresosJson ?? [])
      setEgresosFiltrados(egresosTotJson ?? [])
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

  useEffect(() => {
    fetchReportes(filtrosAplicados.desde, filtrosAplicados.hasta)
  }, [router, filtrosAplicados, empresaActivaId])

  const handleAplicarFiltros = () => {
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setError('La fecha desde no puede ser mayor que la fecha hasta.')
      return
    }

    setError('')
    setFiltrosAplicados({
      desde: fechaDesde,
      hasta: fechaHasta,
    })
  }

  const handleLimpiarFiltros = () => {
    setError('')
    setFechaDesde(primerDiaMes)
    setFechaHasta(hoyStr)
    setFiltrosAplicados({
      desde: primerDiaMes,
      hasta: hoyStr,
    })
  }

  const empresaActiva = empresas.find((empresa) => empresa.id === empresaActivaId)
  const branding = getEmpresaBranding(empresaActiva?.nombre ?? '')

  const resumenTributario = useMemo(() => {
    const afecto = egresosTributarios.filter(
      (item) => item.tratamiento_tributario === 'afecto_iva'
    )
    const exento = egresosTributarios.filter(
      (item) => item.tratamiento_tributario === 'exento'
    )
    const combustible = egresosTributarios.filter(
      (item) => item.tratamiento_tributario === 'combustible'
    )

    return {
      totalAfecto: afecto.reduce((acc, item) => acc + Number(item.monto_neto || 0), 0),
      totalExento: exento.reduce((acc, item) => acc + Number(item.monto_exento || 0), 0),
      totalCombustible: combustible.reduce((acc, item) => acc + Number(item.monto_neto || 0), 0),
      ivaTotal: egresosTributarios.reduce((acc, item) => acc + Number(item.monto_iva || 0), 0),
      impuestoEspecificoTotal: egresosTributarios.reduce(
        (acc, item) => acc + Number(item.impuesto_especifico || 0),
        0
      ),
      totalEgresos: egresosTributarios.reduce((acc, item) => acc + Number(item.monto_total || 0), 0),
    }
  }, [egresosTributarios])

  const ventasPorCliente = useMemo(() => {
    const mapa = new Map<string, VentaPorCliente>()

    for (const row of ventasRows) {
      const cliente = row.clientes?.nombre ?? 'Sin cliente'
      const actual = mapa.get(cliente) ?? {
        cliente,
        cantidad_documentos: 0,
        total_vendido: 0,
        total_pagado: 0,
        total_pendiente: 0,
      }

      actual.cantidad_documentos += 1
      actual.total_vendido += Number(row.monto_total || 0)

      if ((row.estado || '').toLowerCase() === 'pagado') {
        actual.total_pagado += Number(row.monto_total || 0)
      } else {
        actual.total_pendiente += Number(row.monto_total || 0)
      }

      mapa.set(cliente, actual)
    }

    return Array.from(mapa.values()).sort((a, b) => b.total_vendido - a.total_vendido)
  }, [ventasRows])

  const resultadoPeriodo = useMemo(() => {
    const ingresos = ingresosFiltrados.reduce(
      (acc, item) => acc + Number(item.monto_total || 0),
      0
    )
    const egresos = egresosFiltrados.reduce(
      (acc, item) => acc + Number(item.monto_total || 0),
      0
    )

    return {
      ingresos,
      egresos,
      resultado: ingresos - egresos,
    }
  }, [ingresosFiltrados, egresosFiltrados])

  return (
    <main className="space-y-6 print:space-y-4 print:bg-white">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <div className="flex items-start justify-between gap-6 print:block">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-white p-2 print:h-14 print:w-14 flex items-center justify-center">
              {branding.mostrarLogo ? (
                <img
                  src={branding.logoSrc}
                  alt={`Logo ${branding.titulo}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs font-semibold text-slate-500 text-center">
                  {branding.marcaCorta}
                </span>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {branding.marcaCorta}
              </p>
              <h1 className="text-4xl font-semibold text-slate-900 mt-2 print:text-3xl">
                Informe de Reportes
              </h1>
              <p className="text-slate-600 mt-2">{branding.titulo}</p>
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                <p>
                  Período consultado:{' '}
                  <span className="font-medium text-slate-700">
                    {filtrosAplicados.desde}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium text-slate-700">
                    {filtrosAplicados.hasta}
                  </span>
                </p>
                <p>
                  Fecha de emisión:{' '}
                  <span className="font-medium text-slate-700">
                    {formatFechaLarga(hoy)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm print:hidden"
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:hidden">
        <h2 className="text-2xl font-semibold text-slate-900">Filtros</h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">
          Filtra la información por rango de fechas para la empresa activa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-2">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAplicarFiltros}
              className="w-full rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-medium"
            >
              Aplicar filtro
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleLimpiarFiltros}
              className="w-full rounded-xl bg-white border border-slate-300 px-4 py-3 text-sm font-medium"
            >
              Limpiar
            </button>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          Cargando reportes...
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 p-6 shadow-sm border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
            <h2 className="text-2xl font-semibold text-slate-900">
              Resultado del período
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Resumen general de ingresos, egresos y resultado.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Ingresos</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resultadoPeriodo.ingresos)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Egresos</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resultadoPeriodo.egresos)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Resultado</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resultadoPeriodo.resultado)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
            <h2 className="text-2xl font-semibold text-slate-900">
              Resumen tributario de egresos
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Totales del período filtrado para análisis tributario.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Total afecto IVA</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resumenTributario.totalAfecto)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Total exento</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resumenTributario.totalExento)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Base combustible</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resumenTributario.totalCombustible)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">IVA total</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resumenTributario.ivaTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Impuesto específico total</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resumenTributario.impuestoEspecificoTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">Total egresos filtrados</p>
                <p className="text-xl font-semibold mt-2">
                  {formatCLP(resumenTributario.totalEgresos)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
            <h2 className="text-2xl font-semibold text-slate-900">
              Detalle tributario de egresos
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Desglose de egresos del período según tratamiento tributario.
            </p>

            {egresosTributarios.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay egresos para el período seleccionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Tratamiento</th>
                      <th className="py-3 pr-4 text-right">Neto</th>
                      <th className="py-3 pr-4 text-right">IVA</th>
                      <th className="py-3 pr-4 text-right">Imp. específico</th>
                      <th className="py-3 pr-4 text-right">Exento</th>
                      <th className="py-3 pr-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {egresosTributarios.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{item.fecha}</td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4">
                          {formatTratamientoTributario(item.tratamiento_tributario)}
                        </td>
                        <td className="py-3 pr-4 text-right">{formatCLP(item.monto_neto)}</td>
                        <td className="py-3 pr-4 text-right">{formatCLP(item.monto_iva)}</td>
                        <td className="py-3 pr-4 text-right">
                          {formatCLP(item.impuesto_especifico)}
                        </td>
                        <td className="py-3 pr-4 text-right">{formatCLP(item.monto_exento)}</td>
                        <td className="py-3 pr-4 text-right font-medium">
                          {formatCLP(item.monto_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
            <h2 className="text-2xl font-semibold text-slate-900">
              Ventas por cliente
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Resumen comercial por cliente.
            </p>

            {ventasPorCliente.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay datos de ventas por cliente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Cliente</th>
                      <th className="py-3 pr-4 text-right">Documentos</th>
                      <th className="py-3 pr-4 text-right">Total vendido</th>
                      <th className="py-3 pr-4 text-right">Total pagado</th>
                      <th className="py-3 pr-4 text-right">Total pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasPorCliente.map((item, index) => (
                      <tr
                        key={`${item.cliente}-${index}`}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 pr-4">{item.cliente}</td>
                        <td className="py-3 pr-4 text-right">{item.cantidad_documentos}</td>
                        <td className="py-3 pr-4 text-right">{formatCLP(item.total_vendido)}</td>
                        <td className="py-3 pr-4 text-right">{formatCLP(item.total_pagado)}</td>
                        <td className="py-3 pr-4 text-right font-medium">
                          {formatCLP(item.total_pendiente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
            <h2 className="text-2xl font-semibold text-slate-900">
              Cobranza pendiente
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Facturas pendientes o vencidas del período filtrado.
            </p>

            {cobranza.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay cobranza pendiente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Cliente</th>
                      <th className="py-3 pr-4">Factura</th>
                      <th className="py-3 pr-4">Emisión</th>
                      <th className="py-3 pr-4">Vencimiento</th>
                      <th className="py-3 pr-4 text-right">Monto total</th>
                      <th className="py-3 pr-4 text-right">Saldo pendiente</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobranza.map((item, index) => (
                      <tr
                        key={`${item.numero_factura}-${index}`}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 pr-4">{item.cliente}</td>
                        <td className="py-3 pr-4">{item.numero_factura}</td>
                        <td className="py-3 pr-4">{item.fecha_emision}</td>
                        <td className="py-3 pr-4">{item.fecha_vencimiento ?? '-'}</td>
                        <td className="py-3 pr-4 text-right">{formatCLP(item.monto_total)}</td>
                        <td className="py-3 pr-4 text-right font-medium">
                          {formatCLP(item.saldo_pendiente)}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={item.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
            <h2 className="text-2xl font-semibold text-slate-900">
              Saldos bancarios
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Resumen financiero por cuenta bancaria.
            </p>

            {saldos.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay saldos bancarios disponibles.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {saldos.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-slate-50 p-5 border border-slate-200"
                  >
                    <p className="text-sm text-slate-500">{item.banco}</p>
                    <h3 className="text-xl font-semibold mt-1">
                      {item.nombre_cuenta}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-slate-500">Saldo inicial</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.saldo_inicial)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Saldo calculado</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.saldo_calculado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Ingresos pagados</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.ingresos_pagados)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Egresos pagados</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.egresos_pagados)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <footer className="hidden print:block pt-6 border-t border-slate-300 text-sm text-slate-500">
            <p>Reporte generado desde la Plataforma Financiera.</p>
            <p>Empresa: {branding.titulo}</p>
            <p>Fecha de emisión: {formatFechaLarga(hoy)}</p>
          </footer>
        </>
      )}
    </main>
  )
}