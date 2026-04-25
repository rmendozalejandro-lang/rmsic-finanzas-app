'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type TipoCuenta = 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto'

type CuentaContable = {
  id: string
  empresa_id: string
  codigo: string
  nombre: string
  tipo: TipoCuenta | string
  acepta_movimientos: boolean
  activa: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
  descripcion?: string | null
  naturaleza?: string | null
  nivel?: number | null
  parent_id?: string | null
}

type MovimientoCuenta = {
  id: string
  cuenta_contable_id: string | null
  tipo_movimiento: string
  monto_total: number
  fecha: string | null
}

type CuentaContableConResumen = CuentaContable & {
  movimientos_count: number
  total_ingresos: number
  total_egresos: number
  ultima_fecha_movimiento: string | null
}

type FormState = {
  id: string
  codigo: string
  nombre: string
  tipo: TipoCuenta
  naturaleza: string
  nivel: string
  parent_id: string
  descripcion: string
  acepta_movimientos: boolean
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const emptyForm = (): FormState => ({
  id: '',
  codigo: '',
  nombre: '',
  tipo: 'activo',
  naturaleza: 'deudora',
  nivel: '',
  parent_id: '',
  descripcion: '',
  acepta_movimientos: true,
})

const tipoLabels: Record<TipoCuenta, string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  patrimonio: 'Patrimonio',
  ingreso: 'Ingreso',
  gasto: 'Gasto',
}

const tiposCuenta: TipoCuenta[] = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto']

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

function formatCLP(value: number | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function inferNivel(codigo: string) {
  const clean = codigo.trim()
  if (!clean) return null
  return clean.split('.').filter(Boolean).length
}

function getNaturalezaByTipo(tipo: TipoCuenta) {
  if (tipo === 'activo' || tipo === 'gasto') return 'deudora'
  return 'acreedora'
}

function buildResumen(
  cuentas: CuentaContable[],
  movimientos: MovimientoCuenta[]
): CuentaContableConResumen[] {
  const resumenPorCuenta = new Map<
    string,
    {
      movimientos_count: number
      total_ingresos: number
      total_egresos: number
      ultima_fecha_movimiento: string | null
    }
  >()

  movimientos.forEach((movimiento) => {
    if (!movimiento.cuenta_contable_id) return

    const current = resumenPorCuenta.get(movimiento.cuenta_contable_id) ?? {
      movimientos_count: 0,
      total_ingresos: 0,
      total_egresos: 0,
      ultima_fecha_movimiento: null,
    }

    current.movimientos_count += 1

    if (movimiento.tipo_movimiento === 'ingreso') {
      current.total_ingresos += Number(movimiento.monto_total || 0)
    }

    if (movimiento.tipo_movimiento === 'egreso') {
      current.total_egresos += Number(movimiento.monto_total || 0)
    }

    if (
      movimiento.fecha &&
      (!current.ultima_fecha_movimiento ||
        movimiento.fecha > current.ultima_fecha_movimiento)
    ) {
      current.ultima_fecha_movimiento = movimiento.fecha
    }

    resumenPorCuenta.set(movimiento.cuenta_contable_id, current)
  })

  return cuentas.map((cuenta) => {
    const resumen = resumenPorCuenta.get(cuenta.id) ?? {
      movimientos_count: 0,
      total_ingresos: 0,
      total_egresos: 0,
      ultima_fecha_movimiento: null,
    }

    return {
      ...cuenta,
      ...resumen,
    }
  })
}

export default function PlanCuentasPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [userId, setUserId] = useState('')

  const [cuentas, setCuentas] = useState<CuentaContableConResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoCuenta>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState<'activas' | 'archivadas' | 'todas'>(
    'activas'
  )
  const [busqueda, setBusqueda] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())

  const canManage = usuarioRol === 'admin'

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
      setCuentas([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const [cuentasResp, movimientosResp] = await Promise.all([
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
              created_at,
              updated_at,
              created_by,
              updated_by,
              deleted_at,
              deleted_by,
              descripcion,
              naturaleza,
              nivel,
              parent_id
            `
          )
          .eq('empresa_id', empresaId)
          .order('codigo', { ascending: true }),

        supabase
          .from('movimientos')
          .select('id, cuenta_contable_id, tipo_movimiento, monto_total, fecha')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .is('deleted_at', null)
          .not('cuenta_contable_id', 'is', null),
      ])

      if (cuentasResp.error) {
        throw new Error(cuentasResp.error.message)
      }

      if (movimientosResp.error) {
        throw new Error(movimientosResp.error.message)
      }

      setCuentas(
        buildResumen(
          (cuentasResp.data ?? []) as CuentaContable[],
          (movimientosResp.data ?? []) as MovimientoCuenta[]
        )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el plan de cuentas.'
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

  const cuentasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return cuentas.filter((cuenta) => {
      const archivada = !cuenta.activa || Boolean(cuenta.deleted_at)

      if (estadoFiltro === 'activas' && archivada) return false
      if (estadoFiltro === 'archivadas' && !archivada) return false
      if (tipoFiltro !== 'todos' && cuenta.tipo !== tipoFiltro) return false

      if (!texto) return true

      return (
        cuenta.codigo.toLowerCase().includes(texto) ||
        cuenta.nombre.toLowerCase().includes(texto) ||
        String(cuenta.tipo).toLowerCase().includes(texto) ||
        String(cuenta.naturaleza || '').toLowerCase().includes(texto)
      )
    })
  }, [cuentas, busqueda, tipoFiltro, estadoFiltro])

  const resumenGeneral = useMemo(() => {
    return cuentas.reduce(
      (acc, cuenta) => {
        const archivada = !cuenta.activa || Boolean(cuenta.deleted_at)

        if (!archivada) acc.cuentasActivas += 1
        else acc.cuentasArchivadas += 1

        acc.movimientos += Number(cuenta.movimientos_count || 0)
        acc.ingresos += Number(cuenta.total_ingresos || 0)
        acc.egresos += Number(cuenta.total_egresos || 0)

        return acc
      },
      {
        cuentasActivas: 0,
        cuentasArchivadas: 0,
        movimientos: 0,
        ingresos: 0,
        egresos: 0,
      }
    )
  }, [cuentas])

  const cuentasPadre = useMemo(() => {
    return cuentas
      .filter((cuenta) => cuenta.activa && !cuenta.deleted_at)
      .filter((cuenta) => cuenta.id !== form.id)
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [cuentas, form.id])

  const resetForm = () => {
    setForm(emptyForm())
    setShowForm(false)
    setError('')
    setSuccess('')
  }

  const openCreate = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  const openEdit = (cuenta: CuentaContableConResumen) => {
    setForm({
      id: cuenta.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo as TipoCuenta,
      naturaleza: cuenta.naturaleza || getNaturalezaByTipo(cuenta.tipo as TipoCuenta),
      nivel: cuenta.nivel ? String(cuenta.nivel) : '',
      parent_id: cuenta.parent_id || '',
      descripcion: cuenta.descripcion || '',
      acepta_movimientos: cuenta.acepta_movimientos,
    })
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  const handleTipoChange = (tipo: TipoCuenta) => {
    setForm((prev) => ({
      ...prev,
      tipo,
      naturaleza: getNaturalezaByTipo(tipo),
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!empresaActivaId) {
      setError('No hay empresa activa.')
      return
    }

    if (!canManage) {
      setError('Solo usuarios admin pueden crear o editar cuentas contables.')
      return
    }

    const codigo = form.codigo.trim()
    const nombre = form.nombre.trim()

    if (!codigo || !nombre) {
      setError('Código y nombre son obligatorios.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const now = new Date().toISOString()
      const nivelValue = form.nivel.trim()
        ? Number(form.nivel)
        : inferNivel(codigo)

      const payload = {
        empresa_id: empresaActivaId,
        codigo,
        nombre,
        tipo: form.tipo,
        naturaleza: form.naturaleza || getNaturalezaByTipo(form.tipo),
        nivel: nivelValue,
        parent_id: form.parent_id || null,
        descripcion: form.descripcion.trim() || null,
        acepta_movimientos: form.acepta_movimientos,
        activa: true,
        updated_by: userId || null,
        updated_at: now,
      }

      if (form.id) {
        const { error: updateError } = await supabase
          .from('cuentas_contables')
          .update(payload)
          .eq('id', form.id)
          .eq('empresa_id', empresaActivaId)

        if (updateError) throw new Error(updateError.message)

        setSuccess('Cuenta contable actualizada correctamente.')
      } else {
        const { error: insertError } = await supabase
          .from('cuentas_contables')
          .insert({
            ...payload,
            created_by: userId || null,
            created_at: now,
          })

        if (insertError) throw new Error(insertError.message)

        setSuccess('Cuenta contable creada correctamente.')
      }

      await loadData(empresaActivaId)
      setForm(emptyForm())
      setShowForm(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la cuenta contable.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (cuenta: CuentaContableConResumen) => {
    if (!canManage) {
      setError('Solo usuarios admin pueden archivar cuentas contables.')
      return
    }

    const message =
      cuenta.movimientos_count > 0
        ? `La cuenta ${cuenta.codigo} - ${cuenta.nombre} tiene ${cuenta.movimientos_count} movimiento(s) asociado(s). Se archivará para movimientos nuevos, pero el historial se conservará. ¿Deseas continuar?`
        : `¿Deseas archivar la cuenta ${cuenta.codigo} - ${cuenta.nombre}? No se borrará de la base de datos.`

    const confirmed = window.confirm(message)

    if (!confirmed) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const now = new Date().toISOString()

      const { error: archiveError } = await supabase
        .from('cuentas_contables')
        .update({
          activa: false,
          deleted_at: now,
          deleted_by: userId || null,
          updated_by: userId || null,
          updated_at: now,
        })
        .eq('id', cuenta.id)
        .eq('empresa_id', empresaActivaId)

      if (archiveError) throw new Error(archiveError.message)

      setSuccess('Cuenta contable archivada correctamente.')
      await loadData(empresaActivaId)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo archivar la cuenta contable.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (cuenta: CuentaContableConResumen) => {
    if (!canManage) {
      setError('Solo usuarios admin pueden reactivar cuentas contables.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const now = new Date().toISOString()

      const { error: restoreError } = await supabase
        .from('cuentas_contables')
        .update({
          activa: true,
          deleted_at: null,
          deleted_by: null,
          updated_by: userId || null,
          updated_at: now,
        })
        .eq('id', cuenta.id)
        .eq('empresa_id', empresaActivaId)

      if (restoreError) throw new Error(restoreError.message)

      setSuccess('Cuenta contable reactivada correctamente.')
      await loadData(empresaActivaId)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo reactivar la cuenta contable.'
      )
    } finally {
      setSaving(false)
    }
  }

  const accesoPermitido = [
    'admin',
    'gerencia',
    'finanzas',
    'administracion_financiera',
  ].includes(usuarioRol)

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando plan de cuentas...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder al Plan de Cuentas.
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
              Plan de Cuentas
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Administra las cuentas contables de la empresa activa. Esta pantalla conserva el
              historial y no elimina registros físicamente.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || 'Sin empresa activa'}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/plan-cuentas/categorias"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Categorías contables
            </Link>

            <Link
              href="/plan-cuentas/movimientos"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Movimientos contables
            </Link>

            <Link
              href="/plan-cuentas/libro-mayor"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Libro Mayor
            </Link>

            <Link
              href="/plan-cuentas/estado-resultados"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Estado de Resultados
            </Link>

            <Link
              href="/plan-cuentas/balance-general"
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Balance General
            </Link>

            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90]"
              >
                Nueva cuenta
              </button>
            )}
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Cuentas activas
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumenGeneral.cuentasActivas}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Archivadas
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumenGeneral.cuentasArchivadas}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Movimientos
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {resumenGeneral.movimientos}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Ingresos vinculados
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumenGeneral.ingresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Egresos vinculados
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumenGeneral.egresos)}
          </p>
        </div>
      </section>

      {showForm && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {form.id ? 'Editar cuenta contable' : 'Nueva cuenta contable'}
              </h2>
              <p className="text-sm text-slate-500">
                Usa códigos como 1.1.01, 4.1.01 o 5.1.03.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Código
              </label>
              <input
                value={form.codigo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, codigo: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                placeholder="5.1.03"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                value={form.nombre}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nombre: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                placeholder="Combustible y transporte"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tipo
              </label>
              <select
                value={form.tipo}
                onChange={(event) => handleTipoChange(event.target.value as TipoCuenta)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              >
                {tiposCuenta.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipoLabels[tipo]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Naturaleza
              </label>
              <select
                value={form.naturaleza}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, naturaleza: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              >
                <option value="deudora">Deudora</option>
                <option value="acreedora">Acreedora</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nivel
              </label>
              <input
                value={form.nivel}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nivel: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                placeholder="Se calcula si queda vacío"
                type="number"
                min="1"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cuenta padre
              </label>
              <select
                value={form.parent_id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, parent_id: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              >
                <option value="">Sin cuenta padre</option>
                {cuentasPadre.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.codigo} - {cuenta.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                id="acepta_movimientos"
                type="checkbox"
                checked={form.acepta_movimientos}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    acepta_movimientos: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              <label htmlFor="acepta_movimientos" className="text-sm text-slate-700">
                Acepta movimientos
              </label>
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Descripción
              </label>
              <textarea
                value={form.descripcion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, descripcion: event.target.value }))
                }
                className="min-h-[90px] w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                placeholder="Uso recomendado de esta cuenta contable"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar cuenta'}
              </button>
            </div>
          </form>
        </section>
      )}

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
              placeholder="Buscar por código, nombre, tipo o naturaleza"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipo
            </label>
            <select
              value={tipoFiltro}
              onChange={(event) =>
                setTipoFiltro(event.target.value as 'todos' | TipoCuenta)
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              {tiposCuenta.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipoLabels[tipo]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              value={estadoFiltro}
              onChange={(event) =>
                setEstadoFiltro(event.target.value as 'activas' | 'archivadas' | 'todas')
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="activas">Activas</option>
              <option value="archivadas">Archivadas</option>
              <option value="todas">Todas</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Naturaleza</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Mov.</th>
                  <th className="px-4 py-3">Ingresos</th>
                  <th className="px-4 py-3">Egresos</th>
                  <th className="px-4 py-3">Último mov.</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {cuentasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                      No hay cuentas contables para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  cuentasFiltradas.map((cuenta) => {
                    const archivada = !cuenta.activa || Boolean(cuenta.deleted_at)

                    return (
                      <tr key={cuenta.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {cuenta.codigo}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{cuenta.nombre}</div>
                          {cuenta.descripcion && (
                            <div className="mt-1 max-w-lg text-xs text-slate-500">
                              {cuenta.descripcion}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {tipoLabels[cuenta.tipo as TipoCuenta] || cuenta.tipo}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {cuenta.naturaleza || '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {cuenta.nivel ?? '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {cuenta.movimientos_count}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">
                          {formatCLP(cuenta.total_ingresos)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-rose-700">
                          {formatCLP(cuenta.total_egresos)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(cuenta.ultima_fecha_movimiento)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              archivada
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {archivada ? 'Archivada' : 'Activa'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {canManage ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(cuenta)}
                                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Editar
                              </button>

                              {archivada ? (
                                <button
                                  type="button"
                                  onClick={() => void handleRestore(cuenta)}
                                  className="rounded-xl border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                >
                                  Reactivar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleArchive(cuenta)}
                                  className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                >
                                  Archivar
                                </button>
                              )}
                            </div>
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
