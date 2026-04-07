'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'

type Cliente = {
  id: string
  nombre: string
}

type CuentaBancaria = {
  id: string
  banco: string
  nombre_cuenta: string
}

type Categoria = {
  id: string
  nombre: string
}

type CentroCosto = {
  id: string
  nombre: string
}

type Ingreso = {
  id: string
  fecha: string
  numero_documento: string | null
  tipo_documento: string | null
  descripcion: string
  monto_total: number
  estado: string
  cliente_id: string | null
  clientes?: {
    nombre: string
  } | null
}

type CondicionPago = 'contado' | '30' | '45' | '60'
type TipoDocumento =
  | 'factura'
  | 'boleta'
  | 'nota_credito'
  | 'nota_debito'
  | 'comprobante'
  | 'otro'

const STORAGE_KEY = 'empresa_activa_id'

const formatTipoDocumento = (value: string | null) => {
  switch (value) {
    case 'factura':
      return 'Factura'
    case 'boleta':
      return 'Boleta'
    case 'nota_credito':
      return 'Nota de crédito'
    case 'nota_debito':
      return 'Nota de débito'
    case 'comprobante':
      return 'Comprobante'
    case 'otro':
      return 'Otro'
    default:
      return value || '-'
  }
}

export default function IngresosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    fecha: '',
    condicion_pago: 'contado' as CondicionPago,
    fecha_vencimiento: '',
    cliente_id: '',
    tipo_documento: 'factura' as TipoDocumento,
    numero_documento: '',
    descripcion: '',
    monto_neto: '',
    monto_iva: '',
    monto_total: '',
    estado: 'pagado',
    cuenta_bancaria_id: '',
    categoria_id: '',
    centro_costo_id: '',
    es_exento: 'false',
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
      condicion_pago: 'contado',
      fecha_vencimiento: '',
      cliente_id: '',
      tipo_documento: 'factura',
      numero_documento: '',
      descripcion: '',
      monto_neto: '',
      monto_iva: '',
      monto_total: '',
      estado: 'pagado',
      cuenta_bancaria_id: '',
      categoria_id: '',
      centro_costo_id: '',
      es_exento: 'false',
    })
  }

  const sumarDias = (fecha: string, dias: number) => {
    if (!fecha) return ''
    const base = new Date(`${fecha}T00:00:00`)
    base.setDate(base.getDate() + dias)
    return base.toISOString().slice(0, 10)
  }

  const diasCondicionPago = useMemo(() => {
    switch (form.condicion_pago) {
      case '30':
        return 30
      case '45':
        return 45
      case '60':
        return 60
      default:
        return 0
    }
  }, [form.condicion_pago])

  useEffect(() => {
    if (!form.fecha) {
      setForm((prev) => ({ ...prev, fecha_vencimiento: '' }))
      return
    }

    const nuevaFechaVencimiento =
      diasCondicionPago === 0 ? form.fecha : sumarDias(form.fecha, diasCondicionPago)

    setForm((prev) => ({
      ...prev,
      fecha_vencimiento: nuevaFechaVencimiento,
      estado: prev.condicion_pago === 'contado' ? 'pagado' : prev.estado,
    }))
  }, [form.fecha, diasCondicionPago])

  useEffect(() => {
    const neto = Number(form.monto_neto || 0)
    const exento = form.es_exento === 'true'
    const tipo = form.tipo_documento

    let iva = 0
    let total = 0

    if (tipo === 'nota_credito' || tipo === 'nota_debito') {
      iva = exento ? 0 : Math.round(neto * 0.19)
      total = neto + iva
    } else if (exento || tipo === 'boleta' || tipo === 'comprobante' || tipo === 'otro') {
      iva = 0
      total = neto
    } else {
      iva = Math.round(neto * 0.19)
      total = neto + iva
    }

    setForm((prev) => ({
      ...prev,
      monto_iva: neto ? String(iva) : '',
      monto_total: neto ? String(total) : '',
    }))
  }, [form.monto_neto, form.es_exento, form.tipo_documento])

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

      const [
        ingresosResp,
        clientesResp,
        cuentasResp,
        categoriasResp,
        centrosResp,
      ] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&select=id,fecha,numero_documento,tipo_documento,descripcion,monto_total,estado,cliente_id,clientes(nombre)&order=fecha.desc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&select=id,nombre&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?empresa_id=eq.${empresaActivaId}&select=id,banco,nombre_cuenta&activa=eq.true&order=banco.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/categorias?empresa_id=eq.${empresaActivaId}&select=id,nombre&tipo=eq.ingreso&activa=eq.true&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/centros_costo?empresa_id=eq.${empresaActivaId}&select=id,nombre&activo=eq.true&order=nombre.asc`,
          { headers }
        ),
      ])

      const ingresosJson = await ingresosResp.json()
      const clientesJson = await clientesResp.json()
      const cuentasJson = await cuentasResp.json()
      const categoriasJson = await categoriasResp.json()
      const centrosJson = await centrosResp.json()

      if (!ingresosResp.ok) {
        setError('No se pudo cargar el listado de ingresos.')
        return
      }

      if (!clientesResp.ok) {
        setError('No se pudieron cargar los clientes.')
        return
      }

      if (!cuentasResp.ok) {
        setError('No se pudieron cargar las cuentas bancarias.')
        return
      }

      if (!categoriasResp.ok) {
        setError('No se pudieron cargar las categorías.')
        return
      }

      if (!centrosResp.ok) {
        setError('No se pudieron cargar los centros de costo.')
        return
      }

      setIngresos(ingresosJson ?? [])
      setClientes(clientesJson ?? [])
      setCuentas(cuentasJson ?? [])
      setCategorias(categoriasJson ?? [])
      setCentrosCosto(centrosJson ?? [])
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

    setForm((prev) => {
      const updated = { ...prev, [name]: value }

      if (name === 'condicion_pago') {
        updated.estado = value === 'contado' ? 'pagado' : 'pendiente'
      }

      if (name === 'tipo_documento') {
        if (value === 'boleta' || value === 'comprobante' || value === 'otro') {
          updated.es_exento = 'true'
        }
      }

      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!empresaActivaId) {
      setError('Debes seleccionar una empresa activa.')
      return
    }

    if (!form.cliente_id) {
      setError('Debes seleccionar un cliente.')
      return
    }

    if (!form.descripcion.trim()) {
      setError('Debes ingresar una descripción.')
      return
    }

    if (Number(form.monto_neto) <= 0) {
      setError('El monto neto debe ser mayor a 0.')
      return
    }

    if (Number(form.monto_total) <= 0) {
      setError('El monto total debe ser mayor a 0.')
      return
    }

    if (form.estado === 'pagado' && !form.cuenta_bancaria_id) {
      setError('Debes seleccionar una cuenta bancaria para una venta pagada.')
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

      const profileResp = await fetch(
        `${baseUrl}/rest/v1/perfiles?select=id,email&email=eq.rmendozaalejandro@gmail.com`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const profileJson = await profileResp.json()

      if (!profileResp.ok || !profileJson?.[0]?.id) {
        setError('No se pudo obtener el perfil del usuario.')
        return
      }

      const esExento = form.es_exento === 'true'
      const montoNeto = Number(form.monto_neto || 0)
      const montoIva = Number(form.monto_iva || 0)

      const payload = {
        empresa_id: empresaActivaId,
        tipo_movimiento: 'ingreso',
        fecha: form.fecha,
        fecha_vencimiento: form.fecha_vencimiento || null,
        tercero_tipo: 'cliente',
        cliente_id: form.cliente_id || null,
        categoria_id: form.categoria_id || null,
        centro_costo_id: form.centro_costo_id || null,
        cuenta_bancaria_id: form.cuenta_bancaria_id || null,
        tipo_documento: form.tipo_documento,
        numero_documento: form.numero_documento || null,
        descripcion: form.descripcion,
        monto_neto: montoNeto,
        monto_iva: esExento ? 0 : montoIva,
        monto_exento: esExento ? montoNeto : 0,
        monto_total: Number(form.monto_total || 0),
        estado: form.estado,
        medio_pago: 'transferencia',
        created_by: profileJson[0].id,
      }

      const insertResp = await fetch(`${baseUrl}/rest/v1/movimientos`, {
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
        setError('No se pudo guardar la venta. Revisa los datos e inténtalo nuevamente.')
        console.error(insertJson)
        return
      }

      setSuccess('Ingreso registrado correctamente.')
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

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Ingresos</h1>
        <p className="text-slate-600 mt-2">
          Ventas e ingresos registrados en la empresa activa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listado de ingresos
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Información cargada directamente desde Supabase.
          </p>

          {loading && <div className="text-slate-500">Cargando ingresos...</div>}

          {!loading && !error && ingresos.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay ingresos registrados para la empresa activa.
            </div>
          )}

          {!loading && !error && ingresos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Cliente</th>
                    <th className="py-3 pr-4">Documento</th>
                    <th className="py-3 pr-4">N° Doc.</th>
                    <th className="py-3 pr-4">Descripción</th>
                    <th className="py-3 pr-4">Monto total</th>
                    <th className="py-3 pr-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ingresos.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{item.fecha}</td>
                      <td className="py-3 pr-4">
                        {item.clientes?.nombre ?? '-'}
                      </td>
                      <td className="py-3 pr-4">
                        {formatTipoDocumento(item.tipo_documento)}
                      </td>
                      <td className="py-3 pr-4">
                        {item.numero_documento ?? '-'}
                      </td>
                      <td className="py-3 pr-4">{item.descripcion}</td>
                      <td className="py-3 pr-4 font-medium">
                        ${Number(item.monto_total).toLocaleString('es-CL')}
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
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Nuevo ingreso
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Registrar ingreso para la empresa activa.
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
              <label className="block text-sm text-slate-600 mb-2">
                Condición de pago
              </label>
              <select
                name="condicion_pago"
                value={form.condicion_pago}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="contado">Contado</option>
                <option value="30">30 días</option>
                <option value="45">45 días</option>
                <option value="60">60 días</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Fecha vencimiento
              </label>
              <input
                type="date"
                name="fecha_vencimiento"
                value={form.fecha_vencimiento}
                readOnly
                className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Cliente</label>
              <select
                name="cliente_id"
                value={form.cliente_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Tipo de documento
              </label>
              <select
                name="tipo_documento"
                value={form.tipo_documento}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="factura">Factura</option>
                <option value="boleta">Boleta</option>
                <option value="nota_credito">Nota de crédito</option>
                <option value="nota_debito">Nota de débito</option>
                <option value="comprobante">Comprobante</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                ¿Documento exento?
              </label>
              <select
                name="es_exento"
                value={form.es_exento}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Número de documento
              </label>
              <input
                type="text"
                name="numero_documento"
                value={form.numero_documento}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Descripción
              </label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                rows={3}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Neto</label>
              <input
                type="number"
                name="monto_neto"
                value={form.monto_neto}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-2">IVA</label>
                <input
                  type="number"
                  name="monto_iva"
                  value={form.monto_iva}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Total</label>
                <input
                  type="number"
                  name="monto_total"
                  value={form.monto_total}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Estado</label>
              <select
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Cuenta bancaria
              </label>
              <select
                name="cuenta_bancaria_id"
                value={form.cuenta_bancaria_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Seleccionar cuenta</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.banco} - {cuenta.nombre_cuenta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Categoría</label>
              <select
                name="categoria_id"
                value={form.categoria_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Centro de costo
              </label>
              <select
                name="centro_costo_id"
                value={form.centro_costo_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Seleccionar centro de costo</option>
                {centrosCosto.map((centro) => (
                  <option key={centro.id} value={centro.id}>
                    {centro.nombre}
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
              {saving ? 'Guardando...' : 'Guardar ingreso'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}