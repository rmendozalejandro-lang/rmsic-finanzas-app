'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

const STORAGE_ID_KEY = 'empresa_activa_id'

type CategoriaActivo = {
  id: string
  codigo: string
  nombre: string
  vida_util_meses_default: number
}

type ActivoResumen = {
  id: string
  empresa_id: string
  codigo: string | null
  nombre: string
  descripcion: string | null
  fecha_compra: string
  fecha_inicio_depreciacion: string
  valor_compra: number | string
  valor_residual: number | string
  vida_util_meses: number
  metodo: string
  estado: string
  tipo_documento: string | null
  numero_documento: string | null
  ubicacion: string | null
  categoria_nombre: string
  cuenta_activo_codigo: string
  cuenta_activo_nombre: string
  cuenta_depreciacion_codigo: string
  cuenta_depreciacion_nombre: string
  cuenta_gasto_codigo: string
  cuenta_gasto_nombre: string
  depreciacion_acumulada: number | string
  valor_libro: number | string
  ultimo_periodo_depreciado: string | null
}

type FormActivo = {
  categoria_id: string
  codigo: string
  nombre: string
  descripcion: string
  fecha_compra: string
  fecha_inicio_depreciacion: string
  valor_compra: string
  valor_residual: string
  vida_util_meses: string
  tipo_documento: string
  numero_documento: string
  ubicacion: string
  observaciones: string
}

function formatCLP(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numberValue) ? numberValue : 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL').format(date)
}

function getCurrentMonthDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function normalizeAmount(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0
}

export default function ActivosFijosPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [activos, setActivos] = useState<ActivoResumen[]>([])
  const [categorias, setCategorias] = useState<CategoriaActivo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [creatingAsientos, setCreatingAsientos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [periodoDepreciacion, setPeriodoDepreciacion] = useState(getCurrentMonthDate())

  const [form, setForm] = useState<FormActivo>({
    categoria_id: '',
    codigo: '',
    nombre: '',
    descripcion: '',
    fecha_compra: '',
    fecha_inicio_depreciacion: '',
    valor_compra: '',
    valor_residual: '0',
    vida_util_meses: '',
    tipo_documento: '',
    numero_documento: '',
    ubicacion: '',
    observaciones: '',
  })

  const totalCompra = useMemo(() => {
    return activos.reduce((sum, item) => sum + Number(item.valor_compra ?? 0), 0)
  }, [activos])

  const totalDepreciacion = useMemo(() => {
    return activos.reduce((sum, item) => sum + Number(item.depreciacion_acumulada ?? 0), 0)
  }, [activos])

  const totalLibro = useMemo(() => {
    return activos.reduce((sum, item) => sum + Number(item.valor_libro ?? 0), 0)
  }, [activos])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedEmpresaId = window.localStorage.getItem(STORAGE_ID_KEY)
    setEmpresaId(storedEmpresaId)
  }, [])

  const cargarDatos = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [categoriasResp, activosResp] = await Promise.all([
      supabase
        .from('activo_fijo_categorias')
        .select('id, codigo, nombre, vida_util_meses_default')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre', { ascending: true }),

      supabase
        .from('v_activos_fijos_resumen')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false }),
    ])

    if (categoriasResp.error) {
      setError(`No se pudieron cargar las categorías: ${categoriasResp.error.message}`)
      setLoading(false)
      return
    }

    if (activosResp.error) {
      setError(`No se pudieron cargar los activos fijos: ${activosResp.error.message}`)
      setLoading(false)
      return
    }

    setCategorias((categoriasResp.data ?? []) as CategoriaActivo[])
    setActivos((activosResp.data ?? []) as ActivoResumen[])

    setLoading(false)
  }, [empresaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  function handleCategoriaChange(categoriaId: string) {
    const categoria = categorias.find((item) => item.id === categoriaId)

    setForm((prev) => ({
      ...prev,
      categoria_id: categoriaId,
      vida_util_meses: categoria?.vida_util_meses_default
        ? String(categoria.vida_util_meses_default)
        : prev.vida_util_meses,
    }))
  }

  async function handleCrearActivo(event: FormEvent) {
    event.preventDefault()

    if (!empresaId) {
      setError('No hay empresa activa seleccionada.')
      return
    }

    if (!form.categoria_id) {
      setError('Debes seleccionar una categoría de activo fijo.')
      return
    }

    if (!form.nombre.trim()) {
      setError('Debes ingresar el nombre del activo fijo.')
      return
    }

    if (!form.fecha_compra || !form.fecha_inicio_depreciacion) {
      setError('Debes ingresar fecha de compra y fecha de inicio de depreciación.')
      return
    }

    const valorCompra = normalizeAmount(form.valor_compra)
    const valorResidual = normalizeAmount(form.valor_residual)
    const vidaUtilMeses = Number(form.vida_util_meses)

    if (valorCompra <= 0) {
      setError('El valor de compra debe ser mayor a cero.')
      return
    }

    if (!Number.isFinite(vidaUtilMeses) || vidaUtilMeses <= 0) {
      setError('La vida útil debe ser mayor a cero.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: insertError } = await supabase.from('activos_fijos').insert({
      empresa_id: empresaId,
      categoria_id: form.categoria_id,
      codigo: form.codigo.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha_compra: form.fecha_compra,
      fecha_inicio_depreciacion: form.fecha_inicio_depreciacion,
      valor_compra: valorCompra,
      valor_residual: valorResidual,
      vida_util_meses: vidaUtilMeses,
      metodo: 'lineal',
      estado: 'activo',
      tipo_documento: form.tipo_documento.trim() || null,
      numero_documento: form.numero_documento.trim() || null,
      ubicacion: form.ubicacion.trim() || null,
      observaciones: form.observaciones.trim() || null,
    })

    setSaving(false)

    if (insertError) {
      setError(`No se pudo crear el activo fijo: ${insertError.message}`)
      return
    }

    setSuccess('Activo fijo creado correctamente.')
    setShowForm(false)
    setForm({
      categoria_id: '',
      codigo: '',
      nombre: '',
      descripcion: '',
      fecha_compra: '',
      fecha_inicio_depreciacion: '',
      valor_compra: '',
      valor_residual: '0',
      vida_util_meses: '',
      tipo_documento: '',
      numero_documento: '',
      ubicacion: '',
      observaciones: '',
    })

    await cargarDatos()
  }

  async function handleGenerarDepreciaciones() {
    if (!empresaId) {
      setError('No hay empresa activa seleccionada.')
      return
    }

    if (!periodoDepreciacion) {
      setError('Debes seleccionar un período.')
      return
    }

    setGenerating(true)
    setError(null)
    setSuccess(null)

    const { data, error: rpcError } = await supabase.rpc('generar_depreciaciones_empresa', {
      p_empresa_id: empresaId,
      p_hasta_periodo: periodoDepreciacion,
    })

    setGenerating(false)

    if (rpcError) {
      setError(`No se pudieron generar depreciaciones: ${rpcError.message}`)
      return
    }

    const totalGeneradas = Array.isArray(data)
      ? data.reduce((sum, item) => sum + Number(item.depreciaciones_generadas ?? 0), 0)
      : 0

    setSuccess(`Depreciaciones generadas correctamente. Nuevos períodos generados: ${totalGeneradas}.`)
    await cargarDatos()
  }

  async function handleCrearAsientosPeriodo() {
    if (!empresaId) {
      setError('No hay empresa activa seleccionada.')
      return
    }

    if (!periodoDepreciacion) {
      setError('Debes seleccionar un período.')
      return
    }

    setCreatingAsientos(true)
    setError(null)
    setSuccess(null)

    const { data, error: rpcError } = await supabase.rpc('crear_asientos_depreciacion_periodo', {
      p_empresa_id: empresaId,
      p_periodo: periodoDepreciacion,
    })

    setCreatingAsientos(false)

    if (rpcError) {
      setError(`No se pudieron crear los asientos: ${rpcError.message}`)
      return
    }

    const cantidad = Array.isArray(data) ? data.length : 0

    setSuccess(`Asientos de depreciación creados correctamente: ${cantidad}. Revísalos en Asientos contables.`)
    await cargarDatos()
  }

  if (!empresaId) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No hay empresa activa seleccionada.
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Contabilidad</p>
          <h1 className="text-2xl font-semibold text-slate-950">Activos fijos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registro de activos, depreciación acumulada y valor libro.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          {showForm ? 'Ocultar formulario' : 'Nuevo activo fijo'}
        </button>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Valor compra</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatCLP(totalCompra)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Depreciación acumulada</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatCLP(totalDepreciacion)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Valor libro</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatCLP(totalLibro)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Depreciaciones</h2>
            <p className="text-sm text-slate-500">
              Genera depreciaciones y asientos contables borrador por período.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-sm text-slate-600">
              Período
              <input
                type="date"
                value={periodoDepreciacion}
                onChange={(event) => setPeriodoDepreciacion(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={handleGenerarDepreciaciones}
              disabled={generating}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {generating ? 'Generando...' : 'Generar depreciaciones'}
            </button>

            <button
              type="button"
              onClick={handleCrearAsientosPeriodo}
              disabled={creatingAsientos}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creatingAsientos ? 'Creando...' : 'Crear asientos'}
            </button>
          </div>
        </div>
      </section>

      {showForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Nuevo activo fijo</h2>

          <form onSubmit={handleCrearActivo} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Categoría
              <select
                value={form.categoria_id}
                onChange={(event) => handleCategoriaChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600">
              Código interno
              <input
                type="text"
                value={form.codigo}
                onChange={(event) => setForm((prev) => ({ ...prev, codigo: event.target.value }))}
                placeholder="AF-0001"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-600 md:col-span-2">
              Nombre del activo
              <input
                type="text"
                value={form.nombre}
                onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Notebook, vehículo, herramienta mayor..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-sm text-slate-600 md:col-span-2">
              Descripción
              <textarea
                value={form.descripcion}
                onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-600">
              Fecha compra
              <input
                type="date"
                value={form.fecha_compra}
                onChange={(event) => setForm((prev) => ({ ...prev, fecha_compra: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-sm text-slate-600">
              Inicio depreciación
              <input
                type="date"
                value={form.fecha_inicio_depreciacion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fecha_inicio_depreciacion: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-sm text-slate-600">
              Valor compra
              <input
                type="text"
                value={form.valor_compra}
                onChange={(event) => setForm((prev) => ({ ...prev, valor_compra: event.target.value }))}
                placeholder="1200000"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-sm text-slate-600">
              Valor residual
              <input
                type="text"
                value={form.valor_residual}
                onChange={(event) => setForm((prev) => ({ ...prev, valor_residual: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-600">
              Vida útil meses
              <input
                type="number"
                value={form.vida_util_meses}
                onChange={(event) => setForm((prev) => ({ ...prev, vida_util_meses: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-sm text-slate-600">
              Ubicación
              <input
                type="text"
                value={form.ubicacion}
                onChange={(event) => setForm((prev) => ({ ...prev, ubicacion: event.target.value }))}
                placeholder="Administración, taller, vehículo..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-600">
              Tipo documento
              <input
                type="text"
                value={form.tipo_documento}
                onChange={(event) => setForm((prev) => ({ ...prev, tipo_documento: event.target.value }))}
                placeholder="factura, comprobante..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-600">
              Número documento
              <input
                type="text"
                value={form.numero_documento}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, numero_documento: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-600 md:col-span-2">
              Observaciones
              <textarea
                value={form.observaciones}
                onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar activo'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Listado de activos</h2>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-500">Cargando activos fijos...</div>
        ) : activos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Todavía no hay activos fijos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Activo</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Compra</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Valor compra</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Deprec. acum.</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Valor libro</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {activos.map((activo) => (
                  <tr key={activo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{activo.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {activo.codigo || 'Sin código'} · {activo.numero_documento || 'Sin documento'}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{activo.categoria_nombre}</td>

                    <td className="px-4 py-3 text-slate-700">
                      <div>{formatDate(activo.fecha_compra)}</div>
                      <div className="text-xs text-slate-500">
                        Dep. desde {formatDate(activo.fecha_inicio_depreciacion)}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCLP(activo.valor_compra)}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCLP(activo.depreciacion_acumulada)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-slate-950">
                      {formatCLP(activo.valor_libro)}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {activo.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}