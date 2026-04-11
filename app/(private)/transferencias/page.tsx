'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'
import ModuleAccessGuard from '../../../components/ModuleAccessGuard'

type CuentaBancaria = {
  id: string
  banco: string
  nombre_cuenta: string
}

type Transferencia = {
  id: string
  empresa_id: string
  fecha: string
  cuenta_origen_id: string
  cuenta_destino_id: string
  monto: number
  descripcion: string | null
  estado: string
  created_at: string
}

const STORAGE_KEY = 'empresa_activa_id'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

export default function TransferenciasPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [mapaCuentas, setMapaCuentas] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    fecha: '',
    cuenta_origen_id: '',
    cuenta_destino_id: '',
    monto: '',
    descripcion: '',
    estado: 'aplicada',
  })

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

  const resetForm = () => {
    setForm({
      fecha: '',
      cuenta_origen_id: '',
      cuenta_destino_id: '',
      monto: '',
      descripcion: '',
      estado: 'aplicada',
    })
  }

  const fetchData = async () => {
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

      const [transferenciasResp, cuentasResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/transferencias_bancarias?empresa_id=eq.${empresaActivaId}&select=*&order=fecha.desc,created_at.desc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?empresa_id=eq.${empresaActivaId}&select=id,banco,nombre_cuenta&activa=eq.true&order=banco.asc,nombre_cuenta.asc`,
          { headers }
        ),
      ])

      const transferenciasJson = await transferenciasResp.json()
      const cuentasJson = await cuentasResp.json()

      if (!transferenciasResp.ok) {
        console.error(transferenciasJson)
        setError('No se pudieron cargar las transferencias.')
        return
      }

      if (!cuentasResp.ok) {
        console.error(cuentasJson)
        setError('No se pudieron cargar las cuentas bancarias.')
        return
      }

      const cuentasData = cuentasJson ?? []
      const mapa = Object.fromEntries(
        cuentasData.map((cuenta: CuentaBancaria) => [
          cuenta.id,
          `${cuenta.banco} - ${cuenta.nombre_cuenta}`,
        ])
      )

      setTransferencias(transferenciasJson ?? [])
      setCuentas(cuentasData)
      setMapaCuentas(mapa)
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
  }, [router, empresaActivaId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!empresaActivaId) {
      setError('Debes seleccionar una empresa activa.')
      return
    }

    if (!form.fecha) {
      setError('Debes ingresar la fecha.')
      return
    }

    if (!form.cuenta_origen_id) {
      setError('Debes seleccionar la cuenta de origen.')
      return
    }

    if (!form.cuenta_destino_id) {
      setError('Debes seleccionar la cuenta de destino.')
      return
    }

    if (form.cuenta_origen_id === form.cuenta_destino_id) {
      setError('La cuenta de origen y destino deben ser distintas.')
      return
    }

    if (Number(form.monto) <= 0) {
      setError('El monto debe ser mayor a 0.')
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

      const payload = {
        empresa_id: empresaActivaId,
        fecha: form.fecha,
        cuenta_origen_id: form.cuenta_origen_id,
        cuenta_destino_id: form.cuenta_destino_id,
        monto: Number(form.monto || 0),
        descripcion: form.descripcion.trim() || null,
        estado: form.estado,
      }

      const insertResp = await fetch(`${baseUrl}/rest/v1/transferencias_bancarias`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })

      const insertJson = await insertResp.json().catch(() => null)

      if (!insertResp.ok) {
        console.error(insertJson)
        setError('No se pudo guardar la transferencia.')
        return
      }

      setSuccess('Transferencia registrada correctamente.')
      resetForm()
      await fetchData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al guardar.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAnular = async (transferencia: Transferencia) => {
    const confirmar = window.confirm(
      '¿Deseas anular esta transferencia? Dejará de considerarse en los cálculos bancarios.'
    )

    if (!confirmar) return

    try {
      setError('')
      setSuccess('')

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const resp = await fetch(
        `${baseUrl}/rest/v1/transferencias_bancarias?id=eq.${transferencia.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            estado: 'anulada',
          }),
        }
      )

      const json = await resp.json().catch(() => null)

      if (!resp.ok) {
        console.error(json)
        setError('No se pudo anular la transferencia.')
        return
      }

      setSuccess('Transferencia anulada correctamente.')
      await fetchData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al anular.')
      }
    }
  }

  return (
  <ModuleAccessGuard moduleKey="transferencias">
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Transferencias</h1>
        <p className="text-slate-600 mt-2">
          Traspasos entre cuentas bancarias propias, sin afectar ingresos ni egresos.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listado de transferencias
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Movimientos entre bancos de la empresa activa.
          </p>

          {loading && <div className="text-slate-500">Cargando transferencias...</div>}

          {!loading && !error && transferencias.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay transferencias registradas para esta empresa.
            </div>
          )}

          {!loading && !error && transferencias.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Origen</th>
                    <th className="py-3 pr-4">Destino</th>
                    <th className="py-3 pr-4">Monto</th>
                    <th className="py-3 pr-4">Descripción</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {transferencias.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{item.fecha}</td>
                      <td className="py-3 pr-4">
                        {mapaCuentas[item.cuenta_origen_id] ?? item.cuenta_origen_id}
                      </td>
                      <td className="py-3 pr-4">
                        {mapaCuentas[item.cuenta_destino_id] ?? item.cuenta_destino_id}
                      </td>
                      <td className="py-3 pr-4 font-medium">{formatCLP(item.monto)}</td>
                      <td className="py-3 pr-4">{item.descripcion ?? '-'}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={item.estado} />
                      </td>
                      <td className="py-3 pr-4">
                        {item.estado !== 'anulada' && (
                          <button
                            type="button"
                            onClick={() => handleAnular(item)}
                            className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Nueva transferencia
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Registra un traspaso entre tus propias cuentas.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Fecha</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Cuenta origen</label>
              <select
                name="cuenta_origen_id"
                value={form.cuenta_origen_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="">Seleccionar cuenta origen</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.banco} - {cuenta.nombre_cuenta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Cuenta destino</label>
              <select
                name="cuenta_destino_id"
                value={form.cuenta_destino_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="">Seleccionar cuenta destino</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.banco} - {cuenta.nombre_cuenta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Monto</label>
              <input
                type="number"
                name="monto"
                value={form.monto}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Descripción</label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
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
              {saving ? 'Guardando...' : 'Guardar transferencia'}
            </button>
          </form>
        </div>
      </div>
       </main>
  </ModuleAccessGuard>
  )
}