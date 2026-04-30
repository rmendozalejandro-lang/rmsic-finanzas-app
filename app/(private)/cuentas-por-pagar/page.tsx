'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'
import { supabase } from '@/lib/supabase/client'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type CxpEstado = 'pendiente' | 'pagado' | 'parcial' | 'anulado'

type ProveedorRelacionado = {
  id: string
  nombre: string
  rut: string | null
}

type MovimientoRelacionado = {
  id: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string | null
  monto_total: number | string | null
}

type CuentaPorPagar = {
  id: string
  empresa_id: string
  movimiento_id: string
  proveedor_id: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  monto_total: number | string
  monto_pagado: number | string
  saldo_pendiente: number | string
  estado: CxpEstado
  activo: boolean
  created_at: string
  proveedores?: ProveedorRelacionado | ProveedorRelacionado[] | null
  movimientos?: MovimientoRelacionado | MovimientoRelacionado[] | null
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getEstadoLabel(estado: string) {
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    pagado: 'Pagado',
    parcial: 'Parcial',
    anulado: 'Anulado',
  }

  return labels[estado] || estado
}

function getEstadoClass(estado: string) {
  switch (estado) {
    case 'pendiente':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'parcial':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'pagado':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'anulado':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function diasHastaVencimiento(fecha: string | null | undefined) {
  if (!fecha) return null

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const vencimiento = new Date(`${fecha}T00:00:00`)
  vencimiento.setHours(0, 0, 0, 0)

  if (Number.isNaN(vencimiento.getTime())) return null

  const diff = vencimiento.getTime() - hoy.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getVencimientoLabel(fecha: string | null | undefined, estado: string) {
  if (estado === 'pagado') return 'Pagado'
  if (!fecha) return 'Sin vencimiento'

  const dias = diasHastaVencimiento(fecha)

  if (dias === null) return '-'
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} día${dias === 1 ? '' : 's'}`
}

function getVencimientoClass(fecha: string | null | undefined, estado: string) {
  if (estado === 'pagado') return 'text-emerald-700'
  if (!fecha) return 'text-slate-400'

  const dias = diasHastaVencimiento(fecha)

  if (dias === null) return 'text-slate-500'
  if (dias < 0) return 'text-rose-700'
  if (dias <= 7) return 'text-amber-700'
  return 'text-slate-600'
}

function CuentasPorPagarContent() {
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [items, setItems] = useState<CuentaPorPagar[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('pendiente')
  const [soloVencidas, setSoloVencidas] = useState(false)

  useEffect(() => {
    const syncEmpresa = () => {
      setEmpresaId(window.localStorage.getItem(STORAGE_ID_KEY) || '')
      setEmpresaNombre(window.localStorage.getItem(STORAGE_NAME_KEY) || '')
    }

    syncEmpresa()
    window.addEventListener('empresa-activa-cambiada', syncEmpresa)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresa)
    }
  }, [])

  const loadData = async () => {
    if (!empresaId) {
      setItems([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data, error: cxpError } = await supabase
        .from('cuentas_por_pagar')
        .select(`
          id,
          empresa_id,
          movimiento_id,
          proveedor_id,
          fecha_emision,
          fecha_vencimiento,
          monto_total,
          monto_pagado,
          saldo_pendiente,
          estado,
          activo,
          created_at,
          proveedores:proveedor_id (
            id,
            nombre,
            rut
          ),
          movimientos:movimiento_id (
            id,
            tipo_documento,
            numero_documento,
            descripcion,
            monto_total
          )
        `)
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .is('deleted_at', null)
        .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (cxpError) {
        throw new Error(cxpError.message)
      }

      setItems((data ?? []) as CuentaPorPagar[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas por pagar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [empresaId])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()

    return items.filter((item) => {
      const proveedor = firstOrNull(item.proveedores)
      const movimiento = firstOrNull(item.movimientos)

      const matchesEstado = estado ? item.estado === estado : true

      const matchesQ = term
        ? [
            proveedor?.nombre || '',
            proveedor?.rut || '',
            movimiento?.numero_documento || '',
            movimiento?.descripcion || '',
            movimiento?.tipo_documento || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true

      const dias = diasHastaVencimiento(item.fecha_vencimiento)

      const matchesVencidas = soloVencidas
        ? item.estado !== 'pagado' && dias !== null && dias < 0
        : true

      return matchesEstado && matchesQ && matchesVencidas
    })
  }, [items, q, estado, soloVencidas])

  const resumen = useMemo(() => {
    return filtered.reduce(
      (acc, item) => {
        acc.totalDocumentos += 1
        acc.montoTotal += toNumber(item.monto_total)
        acc.pagado += toNumber(item.monto_pagado)
        acc.pendiente += toNumber(item.saldo_pendiente)

        if (item.estado === 'pendiente') acc.pendientes += 1
        if (item.estado === 'parcial') acc.parciales += 1
        if (item.estado === 'pagado') acc.pagados += 1

        const dias = diasHastaVencimiento(item.fecha_vencimiento)
        if (item.estado !== 'pagado' && dias !== null && dias < 0) {
          acc.vencidas += 1
        }

        return acc
      },
      {
        totalDocumentos: 0,
        montoTotal: 0,
        pagado: 0,
        pendiente: 0,
        pendientes: 0,
        parciales: 0,
        pagados: 0,
        vencidas: 0,
      }
    )
  }, [filtered])

  const limpiarFiltros = () => {
    setQ('')
    setEstado('pendiente')
    setSoloVencidas(false)
  }

  if (!empresaId && !loading) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        No hay empresa activa seleccionada.
      </div>
    )
  }

  return (
    <main className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Módulo</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              Cuentas por pagar
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Control de facturas de compra pendientes, pagos a proveedores y vencimientos.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-medium text-slate-900">
                {empresaNombre || empresaId}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Documentos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumen.totalDocumentos}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Saldo pendiente</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatCurrency(resumen.pendiente)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pagado</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatCurrency(resumen.pagado)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Monto total</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatCurrency(resumen.montoTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumen.pendientes}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Vencidas</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {resumen.vencidas}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px_140px]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Proveedor, RUT, folio o descripción"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#163A5F]"
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={soloVencidas}
                onChange={(event) => setSoloVencidas(event.target.checked)}
              />
              Solo vencidas
            </label>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={limpiarFiltros}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Documentos pendientes de pago
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-600">
            Cargando cuentas por pagar...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            No hay cuentas por pagar para mostrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Proveedor</th>
                  <th className="px-4 py-3 font-semibold">Documento</th>
                  <th className="px-4 py-3 font-semibold">Fecha emisión</th>
                  <th className="px-4 py-3 font-semibold">Vencimiento</th>
                  <th className="px-4 py-3 text-right font-semibold">Monto total</th>
                  <th className="px-4 py-3 text-right font-semibold">Pagado</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filtered.map((item) => {
                  const proveedor = firstOrNull(item.proveedores)
                  const movimiento = firstOrNull(item.movimientos)

                  return (
                    <tr key={item.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {proveedor?.nombre || 'Proveedor no asignado'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {proveedor?.rut || '-'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {movimiento?.tipo_documento || 'Documento'} N°{' '}
                          {movimiento?.numero_documento || '-'}
                        </div>
                        <div className="max-w-[280px] whitespace-normal break-words text-xs text-slate-500">
                          {movimiento?.descripcion || '-'}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(item.fecha_emision)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-slate-700">
                          {formatDate(item.fecha_vencimiento)}
                        </div>
                        <div className={`text-xs font-medium ${getVencimientoClass(item.fecha_vencimiento, item.estado)}`}>
                          {getVencimientoLabel(item.fecha_vencimiento, item.estado)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(item.monto_total)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(item.monto_pagado)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(item.saldo_pendiente)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getEstadoClass(item.estado)}`}
                        >
                          {getEstadoLabel(item.estado)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default function CuentasPorPagarPage() {
  return (
    <ProtectedModuleRoute moduleKey="egresos">
      <CuentasPorPagarContent />
    </ProtectedModuleRoute>
  )
}