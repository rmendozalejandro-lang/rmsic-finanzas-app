'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'
import { supabase } from '@/lib/supabase/client'

type Banco = {
  id: string
  banco: string | null
  nombre_cuenta: string | null
  numero_cuenta: string | null
  tipo_cuenta: string | null
  moneda: string | null
}

type PagoPrevisional = {
  id: string
  empresa_id: string
  periodo: string | null
  fecha_pago: string | null
  tipo_pago: string | null
  institucion_nombre: string | null
  descripcion: string | null
  monto_total: number | string | null
  estado: string | null
  cuenta_bancaria_id: string | null
  cuenta_bancaria_nombre: string | null
  movimiento_id: string | null
  comprobante_url: string | null
  observacion: string | null
  created_at: string | null
  updated_at: string | null
  cantidad_detalles: number | string | null
}

type FormPago = {
  periodo: string
  fecha_pago: string
  tipo_pago: string
  institucion_nombre: string
  descripcion: string
  monto_total: string
  cuenta_bancaria_id: string
  numero_documento: string
  comprobante_url: string
  observacion: string
  crear_movimiento: boolean
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const tipoPagoOptions = [
  { value: 'previred', label: 'Previred' },
  { value: 'afp', label: 'AFP' },
  { value: 'fonasa', label: 'Fonasa' },
  { value: 'isapre', label: 'Isapre' },
  { value: 'afc', label: 'AFC' },
  { value: 'achs_mutual', label: 'ACHS / Mutual' },
  { value: 'caja_compensacion', label: 'Caja de compensación' },
  { value: 'otro', label: 'Otro' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7)
}

function limpiarMonto(value: string) {
  return value.replace(/[^\d]/g, '')
}

function formatCLP(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value

  return `${day}-${month}-${year}`
}

function formatPeriodo(value: string | null | undefined) {
  if (!value) return '-'

  const [year, month] = value.slice(0, 10).split('-')
  if (!year || !month) return value

  return `${month}-${year}`
}

function getTipoPagoLabel(value: string | null | undefined) {
  return tipoPagoOptions.find((option) => option.value === value)?.label || value || '-'
}

function getBancoLabel(banco: Banco | undefined) {
  if (!banco) return 'No indicado'

  const partes = [
    banco.banco,
    banco.nombre_cuenta,
    banco.numero_cuenta,
    banco.tipo_cuenta,
  ].filter(Boolean)

  const moneda = banco.moneda ? ` (${banco.moneda})` : ''

  return `${partes.join(' - ')}${moneda}` || 'Cuenta bancaria'
}

const initialForm: FormPago = {
  periodo: currentMonthISO(),
  fecha_pago: todayISO(),
  tipo_pago: 'previred',
  institucion_nombre: 'Previred',
  descripcion: '',
  monto_total: '',
  cuenta_bancaria_id: '',
  numero_documento: '',
  comprobante_url: '',
  observacion: '',
  crear_movimiento: true,
}

function CotizacionesPrevisionalesPageContent() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [pagos, setPagos] = useState<PagoPrevisional[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormPago>(initialForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const cargarEmpresaActiva = useCallback(() => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)
  }, [])

  const cargarBancos = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setBancos([])
      return
    }

    const { data, error: bancosError } = await supabase
      .from('cuentas_bancarias')
      .select(`
        id,
        banco,
        nombre_cuenta,
        numero_cuenta,
        tipo_cuenta,
        moneda
      `)
      .eq('empresa_id', empresaId)
      .eq('activa', true)
      .is('deleted_at', null)
      .order('nombre_cuenta', { ascending: true })

    if (bancosError) {
      console.error('Error cargando cuentas bancarias:', bancosError.message)
      setBancos([])
      return
    }

    setBancos((data ?? []) as Banco[])
  }, [])

  const cargarPagos = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setPagos([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: pagosError } = await supabase
      .from('v_rrhh_pagos_previsionales_resumen')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fecha_pago', { ascending: false })
      .order('created_at', { ascending: false })

    if (pagosError) {
      setError(`No se pudieron cargar los pagos previsionales: ${pagosError.message}`)
      setPagos([])
      setLoading(false)
      return
    }

    setPagos((data ?? []) as PagoPrevisional[])
    setLoading(false)
  }, [])

  useEffect(() => {
    cargarEmpresaActiva()
  }, [cargarEmpresaActiva])

  useEffect(() => {
    if (!empresaActivaId) {
      setLoading(false)
      return
    }

    void cargarBancos(empresaActivaId)
    void cargarPagos(empresaActivaId)
  }, [empresaActivaId, cargarBancos, cargarPagos])

  const bancosById = useMemo(() => {
    return new Map(bancos.map((banco) => [banco.id, banco]))
  }, [bancos])

  const pagosActivos = useMemo(
    () => pagos.filter((pago) => pago.estado !== 'anulado'),
    [pagos]
  )

  const totalPagado = useMemo(() => {
    return pagosActivos.reduce((total, pago) => total + Number(pago.monto_total ?? 0), 0)
  }, [pagosActivos])

  const totalPendiente = useMemo(() => {
    return pagos
      .filter((pago) => pago.estado === 'pendiente')
      .reduce((total, pago) => total + Number(pago.monto_total ?? 0), 0)
  }, [pagos])

  const totalAnulado = useMemo(() => {
    return pagos
      .filter((pago) => pago.estado === 'anulado')
      .reduce((total, pago) => total + Number(pago.monto_total ?? 0), 0)
  }, [pagos])

  const resetForm = () => {
    setForm({
      ...initialForm,
      periodo: currentMonthISO(),
      fecha_pago: todayISO(),
    })
    setFormError('')
    setSuccessMessage('')
  }

  const handleTipoPagoChange = (tipoPago: string) => {
    const label = getTipoPagoLabel(tipoPago)

    setForm((prev) => ({
      ...prev,
      tipo_pago: tipoPago,
      institucion_nombre:
        !prev.institucion_nombre ||
        tipoPagoOptions.some((option) => option.label === prev.institucion_nombre)
          ? label
          : prev.institucion_nombre,
    }))
  }

  const handleMontoChange = (value: string) => {
    const limpio = limpiarMonto(value)
    setForm((prev) => ({ ...prev, monto_total: limpio }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setFormError('')
    setSuccessMessage('')

    if (!empresaActivaId) {
      setFormError('No hay empresa activa seleccionada.')
      return
    }

    if (!form.periodo) {
      setFormError('Debe indicar el período del pago.')
      return
    }

    if (!form.fecha_pago) {
      setFormError('Debe indicar la fecha de pago.')
      return
    }

    if (!form.tipo_pago) {
      setFormError('Debe indicar el tipo de pago.')
      return
    }

    const monto = Number(limpiarMonto(form.monto_total))

    if (!monto || monto <= 0) {
      setFormError('Debe indicar un monto mayor a cero.')
      return
    }

    if (form.crear_movimiento && !form.cuenta_bancaria_id) {
      setFormError('Debe seleccionar una cuenta bancaria para crear el movimiento pagado.')
      return
    }

    setSaving(true)

    const periodoDate = `${form.periodo}-01`
    const numeroDocumento =
      form.numero_documento.trim() ||
      `${form.tipo_pago.toUpperCase()}-${form.periodo.replace('-', '')}`
    const descripcion =
      form.descripcion.trim() ||
      `Pago previsional / leyes sociales ${form.periodo.slice(5, 7)}-${form.periodo.slice(0, 4)}`

    const { data, error: rpcError } = await supabase.rpc('registrar_pago_previsional', {
      p_empresa_id: empresaActivaId,
      p_periodo: periodoDate,
      p_fecha_pago: form.fecha_pago,
      p_tipo_pago: form.tipo_pago,
      p_institucion_nombre: form.institucion_nombre.trim() || getTipoPagoLabel(form.tipo_pago),
      p_descripcion: descripcion,
      p_monto_total: monto,
      p_cuenta_bancaria_id: form.cuenta_bancaria_id || null,
      p_categoria_id: null,
      p_cuenta_contable_id: null,
      p_observacion: form.observacion.trim() || null,
      p_comprobante_url: form.comprobante_url.trim() || null,
      p_numero_documento: numeroDocumento,
      p_crear_movimiento: form.crear_movimiento,
    })

    if (rpcError) {
      setFormError(`No se pudo registrar el pago previsional: ${rpcError.message}`)
      setSaving(false)
      return
    }

    const result = Array.isArray(data) ? data[0] : null

    setSuccessMessage(
      result?.movimiento_id
        ? 'Pago previsional registrado y movimiento bancario creado correctamente.'
        : 'Pago previsional registrado correctamente.'
    )
    setShowForm(false)
    resetForm()
    await cargarPagos(empresaActivaId)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cotizaciones y leyes sociales
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra pagos previsionales, Previred, AFP, salud, AFC, ACHS y otros
            pagos asociados a remuneraciones.
          </p>
          {empresaActivaNombre ? (
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Empresa activa: {empresaActivaNombre}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            if (showForm) {
              setShowForm(false)
              resetForm()
            } else {
              setShowForm(true)
              setFormError('')
              setSuccessMessage('')
            }
          }}
          style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90]"
        >
          {showForm ? 'Cerrar formulario' : 'Nuevo pago previsional'}
        </button>
      </div>

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Registros</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{pagos.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total activo</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCLP(totalPagado)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pendiente</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCLP(totalPendiente)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Anulado</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCLP(totalAnulado)}</p>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Registrar pago previsional
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              El registro se guarda como egreso no afecto tipo comprobante. Si marcas
              crear movimiento, quedará asociado a la cuenta bancaria seleccionada.
            </p>
          </div>

          {formError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Período
              </label>
              <input
                type="month"
                value={form.periodo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, periodo: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha de pago
              </label>
              <input
                type="date"
                value={form.fecha_pago}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fecha_pago: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tipo de pago
              </label>
              <select
                value={form.tipo_pago}
                onChange={(event) => handleTipoPagoChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              >
                {tipoPagoOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Institución
              </label>
              <input
                type="text"
                value={form.institucion_nombre}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, institucion_nombre: event.target.value }))
                }
                placeholder="Previred, AFP, ACHS, Isapre..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Monto total
              </label>
              <input
                type="text"
                value={form.monto_total ? formatCLP(form.monto_total) : ''}
                onChange={(event) => handleMontoChange(event.target.value)}
                placeholder="$0"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                N° comprobante / referencia
              </label>
              <input
                type="text"
                value={form.numero_documento}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, numero_documento: event.target.value }))
                }
                placeholder="Ej: PREVIRED-202605"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cuenta bancaria
              </label>
              <select
                value={form.cuenta_bancaria_id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, cuenta_bancaria_id: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              >
                <option value="">Seleccionar cuenta bancaria</option>
                {bancos.map((banco) => (
                  <option key={banco.id} value={banco.id}>
                    {getBancoLabel(banco)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Descripción
              </label>
              <input
                type="text"
                value={form.descripcion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, descripcion: event.target.value }))
                }
                placeholder="Pago cotizaciones previsionales mayo 2026"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                URL comprobante, opcional
              </label>
              <input
                type="text"
                value={form.comprobante_url}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, comprobante_url: event.target.value }))
                }
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Observación
              </label>
              <textarea
                value={form.observacion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, observacion: event.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#163A5F] focus:ring-2 focus:ring-[#163A5F]/20"
              />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.crear_movimiento}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, crear_movimiento: event.target.checked }))
              }
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Crear movimiento bancario pagado automáticamente como egreso no afecto.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando pagos previsionales...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : pagos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Aún no hay pagos previsionales registrados para esta empresa.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Período</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Fecha pago</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Institución</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Monto</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Cuenta</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Movimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pagos.map((pago) => {
                  const banco = bancosById.get(pago.cuenta_bancaria_id || '')
                  const cuenta = pago.cuenta_bancaria_nombre || getBancoLabel(banco)

                  return (
                    <tr key={pago.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatPeriodo(pago.periodo)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDate(pago.fecha_pago)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {getTipoPagoLabel(pago.tipo_pago)}
                      </td>
                      <td className="min-w-[160px] px-4 py-3 text-slate-700">
                        <div className="font-medium text-slate-900">
                          {pago.institucion_nombre || '-'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {pago.descripcion || '-'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCLP(pago.monto_total)}
                      </td>
                      <td className="min-w-[220px] px-4 py-3 text-slate-700">
                        {cuenta}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                          {pago.estado || '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {pago.movimiento_id ? 'Creado' : 'Sin movimiento'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CotizacionesPrevisionalesPage() {
  return (
    <ProtectedModuleRoute moduleKey="remuneraciones">
      <CotizacionesPrevisionalesPageContent />
    </ProtectedModuleRoute>
  )
}
