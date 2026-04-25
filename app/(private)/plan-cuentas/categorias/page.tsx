'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type TipoCategoria = 'ingreso' | 'egreso'

type CategoriaCuentaResumen = {
  id: string
  empresa_id: string
  nombre: string
  tipo: TipoCategoria | string
  descripcion: string | null
  activa: boolean
  clasificacion_financiera: string | null
  subclasificacion_financiera: string | null
  requiere_centro_costo: boolean
  orden: number
  cuenta_contable_id: string | null
  cuenta_codigo: string | null
  cuenta_nombre: string | null
  cuenta_tipo: string | null
  movimientos_count: number
  total_ingresos: number
  total_egresos: number
  ultima_fecha_movimiento: string | null
  created_at: string
  updated_at: string
}

type CuentaContable = {
  id: string
  empresa_id: string
  codigo: string
  nombre: string
  tipo: string
  acepta_movimientos: boolean
  activa: boolean
  deleted_at: string | null
}

type EditState = {
  categoriaId: string
  cuentaContableId: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function formatCLP(value: number | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value || '').toLowerCase().trim()
}

export default function CategoriasPlanCuentasPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [userId, setUserId] = useState('')

  const [categorias, setCategorias] = useState<CategoriaCuentaResumen[]>([])
  const [cuentas, setCuentas] = useState<CuentaContable[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoCategoria>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState<'todas' | 'mapeadas' | 'sin_mapeo'>(
    'todas'
  )
  const [busqueda, setBusqueda] = useState('')
  const [editing, setEditing] = useState<EditState | null>(null)

  const canManage = usuarioRol === 'admin'

  const accesoPermitido = [
    'admin',
    'gerencia',
    'finanzas',
    'administracion_financiera',
  ].includes(usuarioRol)

  const loadUserContext = async (empresaId: string) => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      setUsuarioRol('')
      setUserId('')
      return
    }

    setUserId(user.id)

    const { data: rolData } = await supabase
      .from('usuario_empresas')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .maybeSingle()

    setUsuarioRol(rolData?.rol || '')
  }

  const loadData = async (empresaId: string) => {
    if (!empresaId) {
      setCategorias([])
      setCuentas([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const [categoriasResp, cuentasResp] = await Promise.all([
        supabase
          .from('v_categorias_cuentas_resumen')
          .select(
            `
              id,
              empresa_id,
              nombre,
              tipo,
              descripcion,
              activa,
              clasificacion_financiera,
              subclasificacion_financiera,
              requiere_centro_costo,
              orden,
              cuenta_contable_id,
              cuenta_codigo,
              cuenta_nombre,
              cuenta_tipo,
              movimientos_count,
              total_ingresos,
              total_egresos,
              ultima_fecha_movimiento,
              created_at,
              updated_at
            `
          )
          .eq('empresa_id', empresaId)
          .order('tipo', { ascending: true })
          .order('nombre', { ascending: true }),

        supabase
          .from('cuentas_contables')
          .select(
            `
              id,
              empresa_id,
              codigo,
              nombre,
              tipo,
              acepta_movimientos,
              activa,
              deleted_at
            `
          )
          .eq('empresa_id', empresaId)
          .eq('activa', true)
          .is('deleted_at', null)
          .eq('acepta_movimientos', true)
          .order('codigo', { ascending: true }),
      ])

      if (categoriasResp.error) {
        throw new Error(categoriasResp.error.message)
      }

      if (cuentasResp.error) {
        throw new Error(cuentasResp.error.message)
      }

      setCategorias((categoriasResp.data ?? []) as CategoriaCuentaResumen[])
      setCuentas((cuentasResp.data ?? []) as CuentaContable[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el mapeo de categorías contables.'
      )
    } finally {
      setLoading(false)
    }
  }

  const syncEmpresaActiva = async () => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)

    if (id) {
      await loadUserContext(id)
      await loadData(id)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    void syncEmpresaActiva()

    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  const categoriasFiltradas = useMemo(() => {
    const texto = normalizeText(busqueda)

    return categorias.filter((categoria) => {
      if (tipoFiltro !== 'todos' && categoria.tipo !== tipoFiltro) return false

      if (estadoFiltro === 'mapeadas' && !categoria.cuenta_contable_id) return false
      if (estadoFiltro === 'sin_mapeo' && categoria.cuenta_contable_id) return false

      if (!texto) return true

      const searchable = [
        categoria.nombre,
        categoria.tipo,
        categoria.clasificacion_financiera,
        categoria.cuenta_codigo,
        categoria.cuenta_nombre,
      ]
        .map(normalizeText)
        .join(' ')

      return searchable.includes(texto)
    })
  }, [categorias, busqueda, tipoFiltro, estadoFiltro])

  const resumen = useMemo(() => {
    return categorias.reduce(
      (acc, categoria) => {
        acc.total += 1

        if (categoria.cuenta_contable_id) acc.mapeadas += 1
        else acc.sinMapeo += 1

        acc.movimientos += Number(categoria.movimientos_count || 0)
        acc.ingresos += Number(categoria.total_ingresos || 0)
        acc.egresos += Number(categoria.total_egresos || 0)

        return acc
      },
      {
        total: 0,
        mapeadas: 0,
        sinMapeo: 0,
        movimientos: 0,
        ingresos: 0,
        egresos: 0,
      }
    )
  }, [categorias])

  const cuentasPorTipo = useMemo(() => {
    return cuentas.reduce<Record<string, CuentaContable[]>>((acc, cuenta) => {
      if (!acc[cuenta.tipo]) acc[cuenta.tipo] = []
      acc[cuenta.tipo].push(cuenta)
      return acc
    }, {})
  }, [cuentas])

  const openEdit = (categoria: CategoriaCuentaResumen) => {
    if (!canManage) {
      setError('Solo usuarios admin pueden modificar el mapeo contable.')
      return
    }

    setEditing({
      categoriaId: categoria.id,
      cuentaContableId: categoria.cuenta_contable_id || '',
    })
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditing(null)
    setError('')
  }

  const saveMapping = async (categoria: CategoriaCuentaResumen) => {
    if (!editing || editing.categoriaId !== categoria.id) return

    if (!canManage) {
      setError('Solo usuarios admin pueden modificar el mapeo contable.')
      return
    }

    const selectedCuentaId = editing.cuentaContableId || null

    if (!selectedCuentaId) {
      const confirmed = window.confirm(
        `La categoría "${categoria.nombre}" quedará sin cuenta contable asociada. Esto afectará movimientos nuevos. ¿Deseas continuar?`
      )

      if (!confirmed) return
    }

    if (categoria.movimientos_count > 0) {
      const confirmed = window.confirm(
        `La categoría "${categoria.nombre}" ya tiene ${categoria.movimientos_count} movimiento(s) histórico(s). Este cambio afectará movimientos nuevos; los movimientos históricos no se actualizarán automáticamente. ¿Deseas continuar?`
      )

      if (!confirmed) return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const now = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('categorias')
        .update({
          cuenta_contable_id: selectedCuentaId,
          updated_by: userId || null,
          updated_at: now,
        })
        .eq('id', categoria.id)
        .eq('empresa_id', empresaActivaId)

      if (updateError) throw new Error(updateError.message)

      setSuccess('Mapeo contable actualizado correctamente.')
      setEditing(null)
      await loadData(empresaActivaId)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el mapeo contable.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando categorías contables...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al mapeo de categorías contables.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Plan de Cuentas</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Categorías y cuentas contables
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Administra la cuenta contable predeterminada de cada categoría. Los cambios
              afectan movimientos nuevos; los movimientos históricos se mantienen intactos.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || 'Sin empresa activa'}
              </span>
            </p>
          </div>

          <Link
            href="/plan-cuentas"
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Volver al plan
          </Link>
        </div>
      </section>

      {(error || success) && (
        <section
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || success}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Categorías
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{resumen.total}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Mapeadas
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {resumen.mapeadas}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sin mapeo
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {resumen.sinMapeo}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Movimientos
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumen.movimientos}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Neto movimiento
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCLP(resumen.ingresos - resumen.egresos)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_220px_220px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              placeholder="Buscar por categoría, clasificación o cuenta"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipo categoría
            </label>
            <select
              value={tipoFiltro}
              onChange={(event) =>
                setTipoFiltro(event.target.value as 'todos' | TipoCategoria)
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todas</option>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mapeo
            </label>
            <select
              value={estadoFiltro}
              onChange={(event) =>
                setEstadoFiltro(event.target.value as 'todas' | 'mapeadas' | 'sin_mapeo')
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todas">Todas</option>
              <option value="mapeadas">Mapeadas</option>
              <option value="sin_mapeo">Sin mapeo</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Clasificación</th>
                  <th className="px-4 py-3">Cuenta contable</th>
                  <th className="px-4 py-3">Mov.</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Egresos</th>
                  <th className="px-4 py-3">Último mov.</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {categoriasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No hay categorías para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  categoriasFiltradas.map((categoria) => {
                    const isEditing = editing?.categoriaId === categoria.id
                    const cuentasDisponibles = [
                      ...(cuentasPorTipo[categoria.tipo] || []),
                      ...cuentas.filter(
                        (cuenta) =>
                          cuenta.tipo !== categoria.tipo &&
                          !cuentasPorTipo[categoria.tipo]?.some((item) => item.id === cuenta.id)
                      ),
                    ]

                    return (
                      <tr key={categoria.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {categoria.nombre}
                          </div>
                          {categoria.descripcion && (
                            <div className="mt-1 max-w-md text-xs text-slate-500">
                              {categoria.descripcion}
                            </div>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {categoria.tipo}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {categoria.clasificacion_financiera || '-'}
                        </td>

                        <td className="min-w-[280px] px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editing.cuentaContableId}
                              onChange={(event) =>
                                setEditing((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        cuentaContableId: event.target.value,
                                      }
                                    : prev
                                )
                              }
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#245C90]"
                            >
                              <option value="">Sin cuenta contable</option>
                              {cuentasDisponibles.map((cuenta) => (
                                <option key={cuenta.id} value={cuenta.id}>
                                  {cuenta.codigo} - {cuenta.nombre}
                                </option>
                              ))}
                            </select>
                          ) : categoria.cuenta_codigo ? (
                            <div>
                              <div className="font-medium text-slate-900">
                                {categoria.cuenta_codigo} - {categoria.cuenta_nombre}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Tipo cuenta: {categoria.cuenta_tipo}
                              </div>
                            </div>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Sin mapeo
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {categoria.movimientos_count}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                          {formatCLP(categoria.total_ingresos)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                          {formatCLP(categoria.total_egresos)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(categoria.ultima_fecha_movimiento)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {canManage ? (
                            isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveMapping(categoria)}
                                  disabled={saving}
                                  className="rounded-xl bg-[#163A5F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245C90] disabled:opacity-60"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEdit(categoria)}
                                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Cambiar cuenta
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
