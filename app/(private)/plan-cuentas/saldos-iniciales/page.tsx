'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Cuenta = {
  id: string
  codigo: string
  nombre: string
  tipo: string
}

type Saldo = {
  id: string
  empresa_id: string
  empresa_nombre: string
  cuenta_contable_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  cuenta_tipo: string
  fecha_corte: string
  descripcion: string | null
  debe: number
  haber: number
  saldo_natural: number
  origen: string
  observacion: string | null
}

type Cuadratura = {
  empresa_id: string
  empresa_nombre: string
  fecha_corte: string
  lineas: number
  total_debe: number
  total_haber: number
  diferencia: number
  cuadrado: boolean
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function firstDayOfYearISO() {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function dateCL(value?: string | null) {
  if (!value) return '-'

  const [year, month, day] = value.slice(0, 10).split('-')

  if (!year || !month || !day) return value

  return `${day}-${month}-${year}`
}
function amount(value: string) {
  if (!value.trim()) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default function SaldosInicialesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')

  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [saldos, setSaldos] = useState<Saldo[]>([])
  const [cuadraturas, setCuadraturas] = useState<Cuadratura[]>([])

  const [fecha, setFecha] = useState(firstDayOfYearISO())
  const [cuentaId, setCuentaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [debe, setDebe] = useState('')
  const [haber, setHaber] = useState('')
  const [origen, setOrigen] = useState('manual')
  const [observacion, setObservacion] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = rol === 'admin'
  const accesoPermitido = ['admin', 'gerencia', 'finanzas', 'administracion_financiera'].includes(rol)

  const cargarUsuario = async (idEmpresa: string) => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      setRol('')
      setUserId('')
      return
    }

    setUserId(user.id)

    const { data: rolData } = await supabase
      .from('usuario_empresas')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', idEmpresa)
      .eq('activo', true)
      .maybeSingle()

    setRol(rolData?.rol || '')
  }

  const cargarDatos = async (idEmpresa: string) => {
    if (!idEmpresa) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const [cuentasResp, saldosResp, cuadraturaResp] = await Promise.all([
        supabase
          .from('cuentas_contables')
          .select('id, codigo, nombre, tipo')
          .eq('empresa_id', idEmpresa)
          .in('tipo', ['activo', 'pasivo', 'patrimonio'])
          .eq('activa', true)
          .is('deleted_at', null)
          .order('codigo', { ascending: true }),

        supabase
          .from('v_saldos_iniciales_contables')
          .select('*')
          .eq('empresa_id', idEmpresa)
          .order('fecha_corte', { ascending: false })
          .order('cuenta_codigo', { ascending: true }),

        supabase
          .from('v_saldos_iniciales_cuadratura')
          .select('*')
          .eq('empresa_id', idEmpresa)
          .order('fecha_corte', { ascending: false }),
      ])

      if (cuentasResp.error) throw new Error(cuentasResp.error.message)
      if (saldosResp.error) throw new Error(saldosResp.error.message)
      if (cuadraturaResp.error) throw new Error(cuadraturaResp.error.message)

      setCuentas((cuentasResp.data || []) as Cuenta[])
      setSaldos((saldosResp.data || []) as Saldo[])
      setCuadraturas((cuadraturaResp.data || []) as Cuadratura[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los saldos iniciales.')
    } finally {
      setLoading(false)
    }
  }

  const sincronizarEmpresa = async () => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaId(id)
    setEmpresaNombre(nombre)

    if (id) {
      await cargarUsuario(id)
      await cargarDatos(id)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    void sincronizarEmpresa()
    window.addEventListener('empresa-activa-cambiada', sincronizarEmpresa)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', sincronizarEmpresa)
    }
  }, [])

  const cuentasPorTipo = useMemo(() => {
    return cuentas.reduce<Record<string, Cuenta[]>>((acc, cuenta) => {
      if (!acc[cuenta.tipo]) acc[cuenta.tipo] = []
      acc[cuenta.tipo].push(cuenta)
      return acc
    }, {})
  }, [cuentas])

  const saldosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    if (!q) return saldos

    return saldos.filter((saldo) =>
      [
        saldo.cuenta_codigo,
        saldo.cuenta_nombre,
        saldo.cuenta_tipo,
        saldo.descripcion,
        saldo.origen,
        saldo.observacion,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [saldos, busqueda])

  const resumen = useMemo(() => {
    return saldos.reduce(
      (acc, saldo) => {
        acc.lineas += 1
        acc.debe += Number(saldo.debe || 0)
        acc.haber += Number(saldo.haber || 0)
        return acc
      },
      { lineas: 0, debe: 0, haber: 0 }
    )
  }, [saldos])

  const limpiarFormulario = () => {
    setFecha(firstDayOfYearISO())
    setCuentaId('')
    setDescripcion('')
    setDebe('')
    setHaber('')
    setOrigen('manual')
    setObservacion('')
  }

  const validar = () => {
    if (!empresaId) return 'No hay empresa activa.'
    if (!canManage) return 'Solo usuarios admin pueden crear saldos iniciales.'
    if (!fecha) return 'La fecha de corte es obligatoria.'
    if (!cuentaId) return 'Debes seleccionar una cuenta contable.'

    const debeNum = amount(debe)
    const haberNum = amount(haber)

    if (debeNum <= 0 && haberNum <= 0) return 'Debes ingresar Debe o Haber.'
    if (debeNum > 0 && haberNum > 0) return 'No puedes ingresar Debe y Haber al mismo tiempo.'

    return ''
  }

  const crearSaldo = async () => {
    const validationError = validar()

    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const now = new Date().toISOString()

      const { error: insertError } = await supabase.from('saldos_iniciales_contables').insert({
        empresa_id: empresaId,
        cuenta_contable_id: cuentaId,
        fecha_corte: fecha,
        descripcion: descripcion.trim() || null,
        debe: amount(debe),
        haber: amount(haber),
        origen: origen.trim() || 'manual',
        observacion: observacion.trim() || null,
        created_by: userId || null,
        updated_by: userId || null,
        created_at: now,
        updated_at: now,
      })

      if (insertError) throw new Error(insertError.message)

      setSuccess('Saldo inicial creado correctamente.')
      limpiarFormulario()
      await cargarDatos(empresaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el saldo inicial.')
    } finally {
      setSaving(false)
    }
  }

  const archivarSaldo = async (saldo: Saldo) => {
    if (!canManage) {
      setError('Solo usuarios admin pueden archivar saldos iniciales.')
      return
    }

    const ok = window.confirm(
      `¿Deseas archivar ${saldo.cuenta_codigo} - ${saldo.cuenta_nombre}? No se borrará físicamente.`
    )

    if (!ok) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const now = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('saldos_iniciales_contables')
        .update({
          activo: false,
          deleted_at: now,
          deleted_by: userId || null,
          updated_by: userId || null,
          updated_at: now,
        })
        .eq('id', saldo.id)
        .eq('empresa_id', empresaId)

      if (updateError) throw new Error(updateError.message)

      setSuccess('Saldo inicial archivado correctamente.')
      await cargarDatos(empresaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar el saldo inicial.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando saldos iniciales...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder a Saldos Iniciales.
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
            <p className="text-sm font-medium text-slate-500">Contabilidad</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Saldos iniciales contables
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Registra saldos de apertura por cuenta contable y valida su cuadratura antes
              de integrarlos al Balance General.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa: <span className="font-semibold text-slate-900">{empresaNombre || 'Sin empresa activa'}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/plan-cuentas"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Plan de cuentas
            </Link>

            <Link
              href="/plan-cuentas/balance-general"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Balance General
            </Link>
          </div>
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

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi title="Líneas" value={String(resumen.lineas)} />
        <Kpi title="Total Debe" value={money(resumen.debe)} tone="rose" />
        <Kpi title="Total Haber" value={money(resumen.haber)} tone="emerald" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Cuadratura por fecha</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cada fecha de corte debe tener total Debe igual a total Haber.
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha corte</th>
                  <th className="px-4 py-3">Líneas</th>
                  <th className="px-4 py-3">Debe</th>
                  <th className="px-4 py-3">Haber</th>
                  <th className="px-4 py-3">Diferencia</th>
                  <th className="px-4 py-3">Cuadrado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {cuadraturas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Aún no hay saldos iniciales registrados.
                    </td>
                  </tr>
                ) : (
                  cuadraturas.map((item) => (
                    <tr key={`${item.empresa_id}-${item.fecha_corte}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {dateCL(item.fecha_corte)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item.lineas}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">{money(item.total_debe)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">{money(item.total_haber)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{money(item.diferencia)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.cuadrado ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {item.cuadrado ? 'Sí' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {canManage && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Nuevo saldo inicial</h2>
          <p className="mt-1 text-sm text-slate-500">
            Activos normalmente van al Debe. Pasivos y patrimonio normalmente van al Haber.
          </p>

          <div className="mt-4 grid gap-4 xl:grid-cols-[160px_1fr_1fr_140px_140px]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Fecha corte</label>
              <input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cuenta</label>
              <select
                value={cuentaId}
                onChange={(event) => setCuentaId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              >
                <option value="">Seleccionar cuenta</option>
                {Object.entries(cuentasPorTipo).map(([tipo, items]) => (
                  <optgroup key={tipo} label={tipo}>
                    {items.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.codigo} - {cuenta.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
              <input
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                placeholder="Ej: Saldo inicial bancos"
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Debe</label>
              <input
                value={debe}
                onChange={(event) => {
                  setDebe(event.target.value)
                  if (event.target.value.trim()) setHaber('')
                }}
                type="number"
                min="0"
                step="1"
                placeholder="0"
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Haber</label>
              <input
                value={haber}
                onChange={(event) => {
                  setHaber(event.target.value)
                  if (event.target.value.trim()) setDebe('')
                }}
                type="number"
                min="0"
                step="1"
                placeholder="0"
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[220px_1fr_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Origen</label>
              <input
                value={origen}
                onChange={(event) => setOrigen(event.target.value)}
                placeholder="manual"
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Observación</label>
              <input
                value={observacion}
                onChange={(event) => setObservacion(event.target.value)}
                placeholder="Detalle o respaldo del saldo inicial"
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={crearSaldo}
                disabled={saving}
                className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Agregar saldo'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Detalle de saldos</h2>
            <p className="text-sm text-slate-500">Líneas activas de saldos iniciales.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar</label>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Cuenta, descripción u observación"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90] xl:w-[340px]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Debe</th>
                  <th className="px-4 py-3">Haber</th>
                  <th className="px-4 py-3">Saldo natural</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {saldosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No hay saldos iniciales para mostrar.
                    </td>
                  </tr>
                ) : (
                  saldosFiltrados.map((saldo) => (
                    <tr key={saldo.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {dateCL(saldo.fecha_corte)}
                      </td>
                      <td className="min-w-[220px] px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {saldo.cuenta_codigo} - {saldo.cuenta_nombre}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{saldo.cuenta_tipo}</div>
                      </td>
                      <td className="min-w-[260px] px-4 py-3 text-slate-700">
                        {saldo.descripcion || '-'}
                        {saldo.observacion && (
                          <div className="mt-1 text-xs text-slate-500">{saldo.observacion}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                        {money(saldo.debe)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                        {money(saldo.haber)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {money(saldo.saldo_natural)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{saldo.origen}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => void archivarSaldo(saldo)}
                            disabled={saving}
                            className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Archivar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}

function Kpi({
  title,
  value,
  tone = 'slate',
}: {
  title: string
  value: string
  tone?: 'emerald' | 'rose' | 'amber' | 'slate'
}) {
  const className = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    slate: 'text-slate-900',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-xl font-semibold ${className}`}>{value}</p>
    </div>
  )
}
