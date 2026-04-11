'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import StatusBadge from '../../../components/StatusBadge'
import ModuleAccessGuard from '../../../components/ModuleAccessGuard'

type Remuneracion = {
  id: string
  empresa_id: string
  trabajador_nombre: string
  cargo: string | null
  periodo: string
  sueldo_base: number
  gratificacion: number
  bono_colacion: number
  bono_movilizacion: number
  horas_extra: number
  otros_haberes_imponibles: number
  otros_haberes_no_imponibles: number
  afp: number
  salud: number
  afc: number
  anticipo: number
  otros_descuentos: number
  total_imponible: number
  total_no_imponible: number
  total_descuentos: number
  liquido_pagar: number
  fecha_pago: string | null
  estado: string
  cuenta_bancaria_id: string | null
  observacion: string | null
  movimiento_id: string | null
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

const STORAGE_KEY = 'empresa_activa_id'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

export default function RemuneracionesPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [remuneraciones, setRemuneraciones] = useState<Remuneracion[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [anulandoId, setAnulandoId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    trabajador_nombre: '',
    cargo: '',
    periodo: '',
    sueldo_base: '',
    gratificacion: '',
    bono_colacion: '',
    bono_movilizacion: '',
    horas_extra: '',
    otros_haberes_imponibles: '',
    otros_haberes_no_imponibles: '',
    afp: '',
    salud: '',
    afc: '',
    anticipo: '',
    otros_descuentos: '',
    total_imponible: '',
    total_no_imponible: '',
    total_descuentos: '',
    liquido_pagar: '',
    fecha_pago: '',
    estado: 'pendiente',
    cuenta_bancaria_id: '',
    observacion: '',
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

  const calculos = useMemo(() => {
    const sueldoBase = Number(form.sueldo_base || 0)
    const gratificacion = Number(form.gratificacion || 0)
    const horasExtra = Number(form.horas_extra || 0)
    const otrosHaberesImponibles = Number(form.otros_haberes_imponibles || 0)

    const bonoColacion = Number(form.bono_colacion || 0)
    const bonoMovilizacion = Number(form.bono_movilizacion || 0)
    const otrosHaberesNoImponibles = Number(form.otros_haberes_no_imponibles || 0)

    const afp = Number(form.afp || 0)
    const salud = Number(form.salud || 0)
    const afc = Number(form.afc || 0)
    const anticipo = Number(form.anticipo || 0)
    const otrosDescuentos = Number(form.otros_descuentos || 0)

    const totalImponible =
      sueldoBase + gratificacion + horasExtra + otrosHaberesImponibles

    const totalNoImponible =
      bonoColacion + bonoMovilizacion + otrosHaberesNoImponibles

    const totalDescuentos =
      afp + salud + afc + anticipo + otrosDescuentos

    const liquidoPagar =
      totalImponible + totalNoImponible - totalDescuentos

    return {
      totalImponible,
      totalNoImponible,
      totalDescuentos,
      liquidoPagar,
    }
  }, [
    form.sueldo_base,
    form.gratificacion,
    form.horas_extra,
    form.otros_haberes_imponibles,
    form.bono_colacion,
    form.bono_movilizacion,
    form.otros_haberes_no_imponibles,
    form.afp,
    form.salud,
    form.afc,
    form.anticipo,
    form.otros_descuentos,
  ])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      total_imponible: calculos.totalImponible ? String(calculos.totalImponible) : '',
      total_no_imponible: calculos.totalNoImponible ? String(calculos.totalNoImponible) : '',
      total_descuentos: calculos.totalDescuentos ? String(calculos.totalDescuentos) : '',
      liquido_pagar: calculos.liquidoPagar ? String(calculos.liquidoPagar) : '',
    }))
  }, [calculos])

  const resetForm = () => {
    setForm({
      trabajador_nombre: '',
      cargo: '',
      periodo: '',
      sueldo_base: '',
      gratificacion: '',
      bono_colacion: '',
      bono_movilizacion: '',
      horas_extra: '',
      otros_haberes_imponibles: '',
      otros_haberes_no_imponibles: '',
      afp: '',
      salud: '',
      afc: '',
      anticipo: '',
      otros_descuentos: '',
      total_imponible: '',
      total_no_imponible: '',
      total_descuentos: '',
      liquido_pagar: '',
      fecha_pago: '',
      estado: 'pendiente',
      cuenta_bancaria_id: '',
      observacion: '',
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

      const [remResp, cuentasResp, categoriasResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/remuneraciones?empresa_id=eq.${empresaActivaId}&select=*&order=periodo.desc,trabajador_nombre.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?empresa_id=eq.${empresaActivaId}&select=id,banco,nombre_cuenta&activa=eq.true&order=banco.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/categorias?empresa_id=eq.${empresaActivaId}&tipo=eq.egreso&nombre=ilike.Remuneraciones&select=id,nombre`,
          { headers }
        ),
      ])

      const remJson = await remResp.json()
      const cuentasJson = await cuentasResp.json()
      const categoriasJson = await categoriasResp.json()

      if (!remResp.ok) {
        console.error(remJson)
        setError('No se pudieron cargar las remuneraciones.')
        return
      }

      if (!cuentasResp.ok) {
        console.error(cuentasJson)
        setError('No se pudieron cargar las cuentas bancarias.')
        return
      }

      if (!categoriasResp.ok) {
        console.error(categoriasJson)
        setError('No se pudieron cargar las categorías.')
        return
      }

      setRemuneraciones(remJson ?? [])
      setCuentas(cuentasJson ?? [])
      setCategorias(categoriasJson ?? [])
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

    if (!form.trabajador_nombre.trim()) {
      setError('Debes ingresar el nombre del trabajador.')
      return
    }

    if (!form.periodo.trim()) {
      setError('Debes ingresar el período.')
      return
    }

    if (Number(form.liquido_pagar) <= 0) {
      setError('El líquido a pagar debe ser mayor a 0.')
      return
    }

    if (form.estado === 'pagado' && !form.cuenta_bancaria_id) {
      setError('Debes seleccionar una cuenta bancaria si la remuneración está pagada.')
      return
    }

    const categoriaRemuneraciones = categorias.find(
      (item) => item.nombre.toLowerCase() === 'remuneraciones'
    )

    if (!categoriaRemuneraciones) {
      setError('No existe la categoría "Remuneraciones" para la empresa activa.')
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

    const perfilId = sessionData.session.user.id

if (!perfilId) {
  setError('No se pudo obtener el perfil del usuario autenticado.')
  return
}

      let movimientoId: string | null = null

      if (form.estado === 'pagado') {
        const movimientoPayload = {
          empresa_id: empresaActivaId,
          tipo_movimiento: 'egreso',
          fecha: form.fecha_pago || null,
          fecha_vencimiento: null,
          tercero_tipo: 'proveedor',
          proveedor_id: null,
          cliente_id: null,
          categoria_id: categoriaRemuneraciones.id,
          centro_costo_id: null,
          cuenta_bancaria_id: form.cuenta_bancaria_id || null,
          tipo_documento: 'boleta',
          numero_documento: null,
          descripcion: `Remuneración ${form.trabajador_nombre} - ${form.periodo}`,
          tratamiento_tributario: 'exento',
          monto_neto: Number(form.liquido_pagar || 0),
          monto_iva: 0,
          impuesto_especifico: 0,
          monto_exento: Number(form.liquido_pagar || 0),
          monto_total: Number(form.liquido_pagar || 0),
          estado: 'pagado',
          medio_pago: 'transferencia',
          created_by: perfilId,
        }

        const movResp = await fetch(`${baseUrl}/rest/v1/movimientos`, {
          method: 'POST',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(movimientoPayload),
        })

        const movJson = await movResp.json().catch(() => null)

        if (!movResp.ok || !movJson?.[0]?.id) {
          console.error(movJson)
          setError('No se pudo crear el egreso asociado a la remuneración.')
          return
        }

        movimientoId = movJson[0].id
      }

      const payload = {
        empresa_id: empresaActivaId,
        trabajador_nombre: form.trabajador_nombre,
        cargo: form.cargo || null,
        periodo: form.periodo,
        sueldo_base: Number(form.sueldo_base || 0),
        gratificacion: Number(form.gratificacion || 0),
        bono_colacion: Number(form.bono_colacion || 0),
        bono_movilizacion: Number(form.bono_movilizacion || 0),
        horas_extra: Number(form.horas_extra || 0),
        otros_haberes_imponibles: Number(form.otros_haberes_imponibles || 0),
        otros_haberes_no_imponibles: Number(form.otros_haberes_no_imponibles || 0),
        afp: Number(form.afp || 0),
        salud: Number(form.salud || 0),
        afc: Number(form.afc || 0),
        anticipo: Number(form.anticipo || 0),
        otros_descuentos: Number(form.otros_descuentos || 0),
        total_imponible: Number(form.total_imponible || 0),
        total_no_imponible: Number(form.total_no_imponible || 0),
        total_descuentos: Number(form.total_descuentos || 0),
        liquido_pagar: Number(form.liquido_pagar || 0),
        fecha_pago: form.fecha_pago || null,
        estado: form.estado,
        cuenta_bancaria_id: form.cuenta_bancaria_id || null,
        observacion: form.observacion || null,
        movimiento_id: movimientoId,
      }

      const insertResp = await fetch(`${baseUrl}/rest/v1/remuneraciones`, {
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
        setError('No se pudo guardar la remuneración.')
        return
      }

      setSuccess(
        form.estado === 'pagado'
          ? 'Remuneración registrada y egreso generado correctamente.'
          : 'Remuneración registrada correctamente.'
      )
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

  const handleAnular = async (id: string) => {
    const confirmar = window.confirm(
      '¿Deseas anular esta remuneración? El registro seguirá existiendo, pero quedará marcado como anulado.'
    )

    if (!confirmar) return

    try {
      setError('')
      setSuccess('')
      setAnulandoId(id)

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const accessToken = sessionData.session.access_token
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

      const updateResp = await fetch(
        `${baseUrl}/rest/v1/remuneraciones?id=eq.${id}`,
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

      const updateJson = await updateResp.json().catch(() => null)

      if (!updateResp.ok) {
        console.error(updateJson)
        setError('No se pudo anular la remuneración.')
        return
      }

      setSuccess('Remuneración anulada correctamente.')
      await fetchData()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error desconocido al anular.')
      }
    } finally {
      setAnulandoId('')
    }
  }

 return (
  <ModuleAccessGuard moduleKey="remuneraciones">
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Remuneraciones</h1>
        <p className="text-slate-600 mt-2">
          Registro interno de sueldos por empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Listado de remuneraciones
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Sueldos registrados para la empresa activa.
          </p>

          {loading && <div className="text-slate-500">Cargando remuneraciones...</div>}

          {!loading && !error && remuneraciones.length === 0 && (
            <div className="text-slate-500 text-sm">
              No hay remuneraciones registradas para la empresa activa.
            </div>
          )}

          {!loading && !error && remuneraciones.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4">Trabajador</th>
                    <th className="py-3 pr-4">Período</th>
                    <th className="py-3 pr-4">Imponible</th>
                    <th className="py-3 pr-4">No imponible</th>
                    <th className="py-3 pr-4">Descuentos</th>
                    <th className="py-3 pr-4">Líquido</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {remuneraciones.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{item.trabajador_nombre}</td>
                      <td className="py-3 pr-4">{item.periodo}</td>
                      <td className="py-3 pr-4">{formatCLP(item.total_imponible)}</td>
                      <td className="py-3 pr-4">{formatCLP(item.total_no_imponible)}</td>
                      <td className="py-3 pr-4">{formatCLP(item.total_descuentos)}</td>
                      <td className="py-3 pr-4 font-medium">
                        {formatCLP(item.liquido_pagar)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={item.estado} />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <Link
                            href={`/remuneraciones/${item.id}`}
                            className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Ver liquidación
                          </Link>

                          {item.estado !== 'anulada' && (
                            <button
                              type="button"
                              onClick={() => handleAnular(item.id)}
                              disabled={anulandoId === item.id}
                              className="inline-flex rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              {anulandoId === item.id ? 'Anulando...' : 'Anular'}
                            </button>
                          )}
                        </div>
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
            Nueva remuneración
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Liquidación interna simple.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Trabajador</label>
              <input
                type="text"
                name="trabajador_nombre"
                value={form.trabajador_nombre}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Cargo</label>
              <input
                type="text"
                name="cargo"
                value={form.cargo}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Período</label>
              <input
                type="text"
                name="periodo"
                value={form.periodo}
                onChange={handleChange}
                placeholder="Ejemplo: 2026-04"
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Haberes imponibles</h3>
              <input type="number" name="sueldo_base" value={form.sueldo_base} onChange={handleChange} placeholder="Sueldo base" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="gratificacion" value={form.gratificacion} onChange={handleChange} placeholder="Gratificación" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="horas_extra" value={form.horas_extra} onChange={handleChange} placeholder="Horas extra" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="otros_haberes_imponibles" value={form.otros_haberes_imponibles} onChange={handleChange} placeholder="Otros haberes imponibles" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Haberes no imponibles</h3>
              <input type="number" name="bono_colacion" value={form.bono_colacion} onChange={handleChange} placeholder="Bono colación" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="bono_movilizacion" value={form.bono_movilizacion} onChange={handleChange} placeholder="Bono movilización" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="otros_haberes_no_imponibles" value={form.otros_haberes_no_imponibles} onChange={handleChange} placeholder="Otros haberes no imponibles" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Descuentos</h3>
              <input type="number" name="afp" value={form.afp} onChange={handleChange} placeholder="AFP" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="salud" value={form.salud} onChange={handleChange} placeholder="Salud" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="afc" value={form.afc} onChange={handleChange} placeholder="AFC" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="anticipo" value={form.anticipo} onChange={handleChange} placeholder="Anticipo" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" name="otros_descuentos" value={form.otros_descuentos} onChange={handleChange} placeholder="Otros descuentos" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input type="number" name="total_imponible" value={form.total_imponible} readOnly placeholder="Total imponible" className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50" />
              <input type="number" name="total_no_imponible" value={form.total_no_imponible} readOnly placeholder="Total no imponible" className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50" />
              <input type="number" name="total_descuentos" value={form.total_descuentos} readOnly placeholder="Total descuentos" className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50" />
              <input type="number" name="liquido_pagar" value={form.liquido_pagar} readOnly placeholder="Líquido a pagar" className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-slate-50 font-medium" />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Fecha de pago</label>
              <input
                type="date"
                name="fecha_pago"
                value={form.fecha_pago}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Estado</label>
              <select
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Cuenta bancaria</label>
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
              <label className="block text-sm text-slate-600 mb-2">Observación</label>
              <textarea
                name="observacion"
                value={form.observacion}
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
              {saving ? 'Guardando...' : 'Guardar remuneración'}
            </button>
          </form>
        </div>
      </div>
        </main>
  </ModuleAccessGuard>
  )
}