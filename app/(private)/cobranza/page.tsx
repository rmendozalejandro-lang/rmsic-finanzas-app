'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'

type CobranzaPendiente = {
  fecha_emision: string
  fecha_vencimiento: string | null
  cliente: string
  numero_factura: string
  descripcion: string
  monto_total: number
  saldo_pendiente: number
  estado: string
}

type CuentaBancaria = {
  id: string
  banco: string
  nombre_cuenta: string
}

const getEstadoVisual = (estado: string, fechaVencimiento: string | null) => {
  const base = (estado || '').toLowerCase()

  if (!fechaVencimiento) return estado

  if (base === 'pagado') return estado

  const hoy = new Date()
  const vencimiento = new Date(`${fechaVencimiento}T23:59:59`)

  if ((base === 'pendiente' || base === 'parcial') && vencimiento < hoy) {
    return 'vencido'
  }

  return estado
}

export default function CobranzaPage() {
  const router = useRouter()

  const [cobranza, setCobranza] = useState<CobranzaPendiente[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    numero_factura: '',
    monto_pagado: '',
    fecha_pago: '',
    banco: '',
    nombre_cuenta: '',
  })

  const resetForm = () => {
    setForm({
      numero_factura: '',
      monto_pagado: '',
      fecha_pago: '',
      banco: '',
      nombre_cuenta: '',
    })
  }

  const fetchData = async () => {
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

      const [cobranzaResp, cuentasResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/v_cobranza_pendiente?select=*&order=fecha_vencimiento.asc.nullslast`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?select=id,banco,nombre_cuenta&activa=eq.true&order=banco.asc`,
          { headers }
        ),
      ])

      const cobranzaJson = await cobranzaResp.json()
      const cuentasJson = await cuentasResp.json()

      if (!cobranzaResp.ok) {
        setError('No se pudo cargar la cobranza pendiente.')
        return
      }

      if (!cuentasResp.ok) {
        setError('No se pudieron cargar las cuentas bancarias.')
        return
      }

      setCobranza(cobranzaJson ?? [])
      setCuentas(cuentasJson ?? [])
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
    fetchData()
  }, [router])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    if (name === 'nombre_cuenta') {
      const cuentaSeleccionada = cuentas.find(
        (c) => `${c.banco} - ${c.nombre_cuenta}` === value
      )

      setForm((prev) => ({
        ...prev,
        banco: cuentaSeleccionada?.banco ?? '',
        nombre_cuenta: cuentaSeleccionada?.nombre_cuenta ?? '',
      }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!form.numero_factura.trim()) {
      setError('Debes ingresar el número de factura.')
      return
    }

    if (Number(form.monto_pagado) <= 0) {
      setError('El monto pagado debe ser mayor a 0.')
      return
    }

    if (!form.fecha_pago) {
      setError('Debes ingresar la fecha de pago.')
      return
    }

    if (!form.banco || !form.nombre_cuenta) {
      setError('Debes seleccionar una cuenta de ingreso.')
      return
    }

    try {
      setSaving(true)

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const response = await fetch(
        `${baseUrl}/rest/v1/rpc/registrar_pago_cxc_con_banco`,
        {
          method: 'POST',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_numero_factura: form.numero_factura,
            p_monto_pagado: Number(form.monto_pagado),
            p_fecha_pago: form.fecha_pago,
            p_banco: form.banco,
            p_nombre_cuenta: form.nombre_cuenta,
            p_created_by_email: 'rmendozaalejandro@gmail.com',
          }),
        }
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError('No se pudo registrar el pago. Revisa los datos e inténtalo nuevamente.')
        console.error(result)
        return
      }

      setSuccess('Pago registrado correctamente.')
      resetForm()
      await fetchData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al registrar pago.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Cobranza</h1>
        <p className="text-slate-600 mt-2">
          Facturas pendientes y registro de pagos.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Facturas pendientes
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Información cargada directamente desde Supabase.
          </p>

          {loading && <div className="text-slate-500">Cargando cobranza...</div>}

          {!loading && !error && cobranza.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay facturas pendientes por cobrar.
            </div>
          )}

          {!loading && !error && cobranza.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                  {cobranza.map((item, index) => {
                    const estadoVisual = getEstadoVisual(
                      item.estado,
                      item.fecha_vencimiento
                    )

                    return (
                      <tr
                        key={`${item.numero_factura}-${index}`}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 pr-4">{item.cliente}</td>
                        <td className="py-3 pr-4">{item.numero_factura}</td>
                        <td className="py-3 pr-4">{item.fecha_emision}</td>
                        <td className="py-3 pr-4">
                          {item.fecha_vencimiento ?? '-'}
                        </td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4">
                          ${Number(item.monto_total).toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          ${Number(item.saldo_pendiente).toLocaleString('es-CL')}
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

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Registrar pago
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Aplicar pago total o parcial a una factura.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Número de factura
              </label>
              <input
                type="text"
                name="numero_factura"
                value={form.numero_factura}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Monto pagado
              </label>
              <input
                type="number"
                name="monto_pagado"
                value={form.monto_pagado}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Fecha de pago
              </label>
              <input
                type="date"
                name="fecha_pago"
                value={form.fecha_pago}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Cuenta de ingreso
              </label>
              <select
                name="nombre_cuenta"
                value={
                  form.banco && form.nombre_cuenta
                    ? `${form.banco} - ${form.nombre_cuenta}`
                    : ''
                }
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="">Seleccionar cuenta</option>
                {cuentas.map((cuenta) => (
                  <option
                    key={cuenta.id}
                    value={`${cuenta.banco} - ${cuenta.nombre_cuenta}`}
                  >
                    {cuenta.banco} - {cuenta.nombre_cuenta}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-slate-900 text-white py-3 font-medium disabled:opacity-60"
            >
              {saving ? 'Registrando...' : 'Registrar pago'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}