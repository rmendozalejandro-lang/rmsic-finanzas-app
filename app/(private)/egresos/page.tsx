'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'

type Proveedor = {
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

type Egreso = {
  id: string
  fecha: string
  numero_documento: string | null
  descripcion: string
  monto_total: number
  monto_iva: number
  impuesto_especifico: number
  tratamiento_tributario: string
  tipo_documento: string | null
  estado: string
  proveedor_id: string | null
  proveedores?: {
    nombre: string
  } | null
  cuentas_bancarias?: {
    banco: string
    nombre_cuenta: string
  } | null
}

type TratamientoTributario = 'afecto_iva' | 'exento' | 'combustible'
type TipoDocumento = 'factura' | 'boleta' | 'comprobante' | 'otro'

const STORAGE_KEY = 'empresa_activa_id'

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

const formatTipoDocumento = (value: string | null) => {
  switch (value) {
    case 'factura':
      return 'Factura'
    case 'boleta':
      return 'Boleta'
    case 'comprobante':
      return 'Comprobante'
    case 'otro':
      return 'Otro'
    case 'nota_credito':
      return 'Nota de crédito'
    case 'nota_debito':
      return 'Nota de débito'
    default:
      return value ?? '-'
  }
}

export default function EgresosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    fecha: '',
    proveedor_id: '',
    tipo_documento: 'factura' as TipoDocumento,
    numero_documento: '',
    descripcion: '',
    tratamiento_tributario: 'afecto_iva' as TratamientoTributario,
    monto_neto: '',
    monto_iva: '',
    impuesto_especifico: '',
    monto_total: '',
    estado: 'pagado',
    cuenta_bancaria_id: '',
    categoria_id: '',
    centro_costo_id: '',
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
      proveedor_id: '',
      tipo_documento: 'factura',
      numero_documento: '',
      descripcion: '',
      tratamiento_tributario: 'afecto_iva',
      monto_neto: '',
      monto_iva: '',
      impuesto_especifico: '',
      monto_total: '',
      estado: 'pagado',
      cuenta_bancaria_id: '',
      categoria_id: '',
      centro_costo_id: '',
    })
  }

  useEffect(() => {
    const neto = Number(form.monto_neto || 0)
    const impuestoEspecifico = Number(form.impuesto_especifico || 0)

    let iva = 0
    let total = 0

    if (form.tratamiento_tributario === 'afecto_iva') {
      iva = Math.round(neto * 0.19)
      total = neto + iva
    } else if (form.tratamiento_tributario === 'exento') {
      iva = 0
      total = neto
    } else if (form.tratamiento_tributario === 'combustible') {
      iva = Math.round(neto * 0.19)
      total = neto + iva + impuestoEspecifico
    }

    setForm((prev) => ({
      ...prev,
      monto_iva: neto ? String(iva) : '',
      monto_total: neto || impuestoEspecifico ? String(total) : '',
    }))
  }, [form.monto_neto, form.impuesto_especifico, form.tratamiento_tributario])

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
        egresosResp,
        proveedoresResp,
        cuentasResp,
        categoriasResp,
        centrosResp,
      ] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.egreso&select=id,fecha,numero_documento,descripcion,monto_total,monto_iva,impuesto_especifico,tratamiento_tributario,tipo_documento,estado,proveedor_id,proveedores(nombre),cuentas_bancarias(banco,nombre_cuenta)&order=fecha.desc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/proveedores?empresa_id=eq.${empresaActivaId}&select=id,nombre&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?empresa_id=eq.${empresaActivaId}&select=id,banco,nombre_cuenta&activa=eq.true&order=banco.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/categorias?empresa_id=eq.${empresaActivaId}&select=id,nombre&tipo=eq.egreso&activa=eq.true&order=nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/centros_costo?empresa_id=eq.${empresaActivaId}&select=id,nombre&activo=eq.true&order=nombre.asc`,
          { headers }
        ),
      ])

      const egresosJson = await egresosResp.json()
      const proveedoresJson = await proveedoresResp.json()
      const cuentasJson = await cuentasResp.json()
      const categoriasJson = await categoriasResp.json()
      const centrosJson = await centrosResp.json()

      if (!egresosResp.ok) {
        setError('No se pudo cargar el listado de egresos.')
        return
      }

      if (!proveedoresResp.ok) {
        setError('No se pudieron cargar los proveedores.')
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

      setEgresos(egresosJson ?? [])
      setProveedores(proveedoresJson ?? [])
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

      if (name === 'tipo_documento') {
        if (value === 'factura') {
          updated.tratamiento_tributario = 'afecto_iva'
        } else if (value === 'boleta' || value === 'comprobante' || value === 'otro') {
          updated.tratamiento_tributario = 'exento'
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

    if (!form.proveedor_id) {
      setError('Debes seleccionar un proveedor.')
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
      setError('Debes seleccionar una cuenta bancaria para un egreso pagado.')
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

      const payload = {
        empresa_id: empresaActivaId,
        tipo_movimiento: 'egreso',
        fecha: form.fecha,
        fecha_vencimiento: null,
        tercero_tipo: 'proveedor',
        proveedor_id: form.proveedor_id || null,
        categoria_id: form.categoria_id || null,
        centro_costo_id: form.centro_costo_id || null,
        cuenta_bancaria_id: form.cuenta_bancaria_id || null,
        tipo_documento: form.tipo_documento,
        numero_documento: form.numero_documento || null,
        descripcion: form.descripcion,
        tratamiento_tributario: form.tratamiento_tributario,
        monto_neto: Number(form.monto_neto || 0),
        monto_iva: Number(form.monto_iva || 0),
        impuesto_especifico:
          form.tratamiento_tributario === 'combustible'
            ? Number(form.impuesto_especifico || 0)
            : 0,
        monto_exento:
          form.tratamiento_tributario === 'exento'
            ? Number(form.monto_neto || 0)
            : 0,
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
        setError('No se pudo guardar el egreso. Revisa los datos e inténtalo nuevamente.')
        console.error(insertJson)
        return
      }

      setSuccess('Egreso registrado correctamente.')
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
        <h1 className="text-4xl font-semibold text-slate-900">Egresos</h1>
        <p className="text-slate-600 mt-2">
          Compras y gastos registrados en la empresa activa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listado de egresos
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Información cargada directamente desde Supabase.
          </p>

          {loading && <div className="text-slate-500">Cargando egresos...</div>}

          {!loading && !error && egresos.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay egresos registrados para la empresa activa.
            </div>
          )}

          {!loading && !error && egresos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Proveedor</th>
                    <th className="py-3 pr-4">Documento</th>
                    <th className="py-3 pr-4">N° Doc.</th>
                    <th className="py-3 pr-4">Descripción</th>
                    <th className="py-3 pr-4">Monto total</th>
                    <th className="py-3 pr-4">Tratamiento</th>
                    <th className="py-3 pr-4">Banco</th>
                    <th className="py-3 pr-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {egresos.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{item.fecha}</td>
                      <td className="py-3 pr-4">
                        {item.proveedores?.nombre ?? '-'}
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
                        {formatTratamientoTributario(item.tratamiento_tributario)}
                      </td>
                      <td className="py-3 pr-4">
                        {item.cuentas_bancarias
                          ? `${item.cuentas_bancarias.banco} - ${item.cuentas_bancarias.nombre_cuenta}`
                          : '-'}
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
            Nuevo egreso
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Registrar gasto para la empresa activa.
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
                Proveedor
              </label>
              <select
                name="proveedor_id"
                value={form.proveedor_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="">Seleccionar proveedor</option>
                {proveedores.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre}
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
                <option value="comprobante">Comprobante / gasto menor</option>
                <option value="otro">Otro</option>
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
              <label className="block text-sm text-slate-600 mb-2">
                Tratamiento tributario
              </label>
              <select
                name="tratamiento_tributario"
                value={form.tratamiento_tributario}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              >
                <option value="afecto_iva">Afecto IVA 19%</option>
                <option value="exento">Exento / no afecto</option>
                <option value="combustible">Combustible con impuesto específico</option>
              </select>
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

            {form.tratamiento_tributario === 'combustible' && (
              <div>
                <label className="block text-sm text-slate-600 mb-2">
                  Impuesto específico
                </label>
                <input
                  type="number"
                  name="impuesto_especifico"
                  value={form.impuesto_especifico}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>
            )}

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
              {saving ? 'Guardando...' : 'Guardar egreso'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}