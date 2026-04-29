'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import EmpresaActivaBanner from '../../../../components/EmpresaActivaBanner'
import { supabase } from '../../../../lib/supabase/client'

type Categoria = {
  id: string
  nombre: string
  tipo: string
  requiere_centro_costo: boolean
}

type CentroCosto = {
  id: string
  nombre: string
  codigo: string | null
}

type FilaImportada = {
  id: string
  fecha: string | null
  descripcion_original: string
  descripcion_editada: string | null
  categoria_id: string | null
  centro_costo_id: string | null
  rut_detectado: string | null
  cargo: number
  abono: number
  saldo: number | null
  tipo_sugerido: string | null
  estado: string
  movimiento_id: string | null
  banco_importaciones: {
    banco: string
    nombre_archivo: string
    created_at: string
    cuentas_bancarias: {
      banco: string
      nombre_cuenta: string
      numero_cuenta: string | null
    } | null
  } | null
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
  }).format(date)
}

function BancosImportacionesContent() {
  const [empresaId, setEmpresaId] = useState('')
  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [loading, setLoading] = useState(true)
  const [procesandoId, setProcesandoId] = useState('')
  const [descripcionesEditadas, setDescripcionesEditadas] = useState<Record<string, string>>({})
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
  const [categoriasPorFila, setCategoriasPorFila] = useState<Record<string, string>>({})
  const [centrosPorFila, setCentrosPorFila] = useState<Record<string, string>>({})
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const activeEmpresa =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('empresa_activa_id') || ''
        : ''

    setEmpresaId(activeEmpresa)
  }, [])

  const loadFilas = async () => {
    try {
      setLoading(true)
      setError('')

      if (!empresaId) return

      let query = supabase
        .from('banco_importacion_filas')
        .select(
          `
            id,
            fecha,
            descripcion_original,
            descripcion_editada,
            categoria_id,
            centro_costo_id,
            rut_detectado,
            cargo,
            abono,
            saldo,
            tipo_sugerido,
            estado,
            movimiento_id,
            banco_importaciones (
              banco,
              nombre_archivo,
              created_at,
              cuentas_bancarias (
                banco,
                nombre_cuenta,
                numero_cuenta
              )
            )
          `
        )
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const [filasResp, categoriasResp, centrosResp] = await Promise.all([
        query,
        supabase
          .from('categorias')
          .select('id, nombre, tipo, requiere_centro_costo')
          .eq('empresa_id', empresaId)
          .eq('activa', true)
          .is('deleted_at', null)
          .order('tipo', { ascending: true })
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true }),
        supabase
          .from('centros_costo')
          .select('id, nombre, codigo')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .is('deleted_at', null)
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true }),
      ])

      if (filasResp.error) {
        throw new Error(filasResp.error.message)
      }

      if (categoriasResp.error) {
        throw new Error(categoriasResp.error.message)
      }

      if (centrosResp.error) {
        throw new Error(centrosResp.error.message)
      }

      const rows = (filasResp.data ?? []) as unknown as FilaImportada[]
      setFilas(rows)
      setCategorias((categoriasResp.data ?? []) as Categoria[])
      setCentrosCosto((centrosResp.data ?? []) as CentroCosto[])

      setDescripcionesEditadas((prev) => {
        const next = { ...prev }

        rows.forEach((fila) => {
          if (!(fila.id in next)) {
            next[fila.id] = fila.descripcion_editada || fila.descripcion_original
          }
        })

        return next
      })

      setCategoriasPorFila((prev) => {
        const next = { ...prev }

        rows.forEach((fila) => {
          if (!(fila.id in next)) {
            next[fila.id] = fila.categoria_id || ''
          }
        })

        return next
      })

      setCentrosPorFila((prev) => {
        const next = { ...prev }

        rows.forEach((fila) => {
          if (!(fila.id in next)) {
            next[fila.id] = fila.centro_costo_id || ''
          }
        })

        return next
      })

      setCategoriasPorFila((prev) => {
        const next = { ...prev }

        rows.forEach((fila) => {
          if (!(fila.id in next)) {
            next[fila.id] = fila.categoria_id || ''
          }
        })

        return next
      })

      setCentrosPorFila((prev) => {
        const next = { ...prev }

        rows.forEach((fila) => {
          if (!(fila.id in next)) {
            next[fila.id] = fila.centro_costo_id || ''
          }
        })

        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las filas importadas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFilas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, filtroEstado])

  const resumen = useMemo(() => {
    return filas.reduce(
      (acc, fila) => {
        acc.total += 1
        acc.cargos += Number(fila.cargo || 0)
        acc.abonos += Number(fila.abono || 0)
        return acc
      },
      { total: 0, cargos: 0, abonos: 0 }
    )
  }, [filas])

  const crearMovimiento = async (filaId: string) => {
    try {
      setProcesandoId(filaId)
      setError('')
      setSuccess('')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('No hay sesión activa.')
      }

      const response = await fetch('/api/bancos/crear-movimiento-desde-fila', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filaId,
          descripcionEditada: descripcionesEditadas[filaId] || '',
          categoriaId: categoriasPorFila[filaId] || '',
          centroCostoId: centrosPorFila[filaId] || '',
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'No se pudo crear el movimiento.')
      }

      setSuccess('Movimiento creado correctamente desde la cartola.')
      await loadFilas()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el movimiento.')
    } finally {
      setProcesandoId('')
    }
  }

  return (
    <div className="space-y-6">
      <EmpresaActivaBanner modulo="Bancos" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Bancos</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Bandeja de importaciones bancarias
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Revisa las filas importadas desde cartolas y crea movimientos
              bancarios pendientes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/bancos/importar"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Importar nueva cartola
            </Link>

            <Link
              href="/bancos"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Volver a bancos
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Filas</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{resumen.total}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Abonos</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(resumen.abonos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cargos</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(resumen.cargos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Estado
          </label>
          <select
            value={filtroEstado}
            onChange={(event) => setFiltroEstado(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="pendiente">Pendientes</option>
            <option value="importada">Importadas</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Filas importadas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Crea movimientos uno a uno desde cada fila revisada.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">
            Cargando filas importadas...
          </div>
        ) : filas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">
            No hay filas para el filtro seleccionado.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Cuenta</th>
                    <th className="px-4 py-3 font-semibold">Descripción</th>
                    <th className="px-4 py-3 font-semibold">RUT</th>
                    <th className="px-4 py-3 font-semibold text-right">Cargo</th>
                    <th className="px-4 py-3 font-semibold text-right">Abono</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filas.map((fila) => {
                    const cuenta = fila.banco_importaciones?.cuentas_bancarias

                    return (
                      <tr key={fila.id} className="border-t border-slate-100 text-slate-700">
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDate(fila.fecha)}
                        </td>

                        <td className="min-w-[220px] px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {cuenta?.banco || fila.banco_importaciones?.banco || '-'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {cuenta?.nombre_cuenta || '-'}
                            {cuenta?.numero_cuenta ? ` (${cuenta.numero_cuenta})` : ''}
                          </div>
                        </td>

                        <td className="min-w-[360px] px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Glosa banco
                          </div>

                          <div className="mt-1 text-xs text-slate-600">
                            {fila.descripcion_original}
                          </div>

                          <textarea
                            value={descripcionesEditadas[fila.id] || ""}
                            onChange={(event) =>
                              setDescripcionesEditadas((prev) => ({
                                ...prev,
                                [fila.id]: event.target.value,
                              }))
                            }
                            rows={2}
                            disabled={Boolean(fila.movimiento_id)}
                            placeholder="Descripción clara para el movimiento"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-50 disabled:text-slate-500"
                          />

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500">
                                Categoría
                              </label>
                              <select
                                value={categoriasPorFila[fila.id] || ""}
                                onChange={(event) =>
                                  setCategoriasPorFila((prev) => ({
                                    ...prev,
                                    [fila.id]: event.target.value,
                                  }))
                                }
                                disabled={Boolean(fila.movimiento_id)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-50 disabled:text-slate-500"
                              >
                                <option value="">Sin categoría</option>
                                {categorias
                                  .filter((categoria) => {
                                    if (!fila.tipo_sugerido) return true
                                    return categoria.tipo === fila.tipo_sugerido
                                  })
                                  .map((categoria) => (
                                    <option key={categoria.id} value={categoria.id}>
                                      {categoria.nombre}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500">
                                Centro de costo
                              </label>
                              <select
                                value={centrosPorFila[fila.id] || ""}
                                onChange={(event) =>
                                  setCentrosPorFila((prev) => ({
                                    ...prev,
                                    [fila.id]: event.target.value,
                                  }))
                                }
                                disabled={Boolean(fila.movimiento_id)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-50 disabled:text-slate-500"
                              >
                                <option value="">Sin centro</option>
                                {centrosCosto.map((centro) => (
                                  <option key={centro.id} value={centro.id}>
                                    {centro.codigo ? `${centro.codigo} - ` : ""}
                                    {centro.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500">
                                Categoría
                              </label>
                              <select
                                value={categoriasPorFila[fila.id] || ""}
                                onChange={(event) =>
                                  setCategoriasPorFila((prev) => ({
                                    ...prev,
                                    [fila.id]: event.target.value,
                                  }))
                                }
                                disabled={Boolean(fila.movimiento_id)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-50 disabled:text-slate-500"
                              >
                                <option value="">Sin categoría</option>
                                {categorias
                                  .filter((categoria) => {
                                    if (!fila.tipo_sugerido) return true
                                    return categoria.tipo === fila.tipo_sugerido
                                  })
                                  .map((categoria) => (
                                    <option key={categoria.id} value={categoria.id}>
                                      {categoria.nombre}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500">
                                Centro de costo
                              </label>
                              <select
                                value={centrosPorFila[fila.id] || ""}
                                onChange={(event) =>
                                  setCentrosPorFila((prev) => ({
                                    ...prev,
                                    [fila.id]: event.target.value,
                                  }))
                                }
                                disabled={Boolean(fila.movimiento_id)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#163A5F] disabled:bg-slate-50 disabled:text-slate-500"
                              >
                                <option value="">Sin centro</option>
                                {centrosCosto.map((centro) => (
                                  <option key={centro.id} value={centro.id}>
                                    {centro.codigo ? `${centro.codigo} - ` : ""}
                                    {centro.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Archivo: {fila.banco_importaciones?.nombre_archivo || "-"}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {fila.rut_detectado || '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {fila.cargo > 0 ? formatCurrency(fila.cargo) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {fila.abono > 0 ? formatCurrency(fila.abono) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              fila.estado === 'importada'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {fila.estado}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {fila.movimiento_id ? (
                            <span className="text-xs text-slate-500">
                              Movimiento creado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => crearMovimiento(fila.id)}
                              disabled={procesandoId === fila.id}
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {procesandoId === fila.id
                                ? 'Creando...'
                                : 'Crear movimiento'}
                            </button>
                          )}
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
    </div>
  )
}

export default function BancosImportacionesPage() {
  return (
    <ProtectedModuleRoute moduleKey="bancos">
      <BancosImportacionesContent />
    </ProtectedModuleRoute>
  )
}
