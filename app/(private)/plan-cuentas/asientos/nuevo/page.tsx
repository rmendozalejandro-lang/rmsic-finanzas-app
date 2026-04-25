'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase/client'

type CuentaContable = {
  id: string
  empresa_id: string
  codigo: string
  nombre: string
  tipo: string
  naturaleza: string | null
  acepta_movimientos: boolean
  activa: boolean
  deleted_at: string | null
}

type LineaForm = {
  uid: string
  cuenta_contable_id: string
  descripcion: string
  debe: string
  haber: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatCLP(value: number | null | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function makeLine(): LineaForm {
  return {
    uid:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    cuenta_contable_id: '',
    descripcion: '',
    debe: '',
    haber: '',
  }
}

function parseAmount(value: string) {
  if (!value.trim()) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function NuevoAsientoPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [userId, setUserId] = useState('')

  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [fecha, setFecha] = useState(todayISO())
  const [numero, setNumero] = useState('')
  const [glosa, setGlosa] = useState('')
  const [origenTipo, setOrigenTipo] = useState('manual')
  const [lineas, setLineas] = useState<LineaForm[]>([makeLine(), makeLine()])

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

  const loadCuentas = async (empresaId: string) => {
    if (!empresaId) {
      setCuentas([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data, error: cuentasError } = await supabase
        .from('cuentas_contables')
        .select(
          `
            id,
            empresa_id,
            codigo,
            nombre,
            tipo,
            naturaleza,
            acepta_movimientos,
            activa,
            deleted_at
          `
        )
        .eq('empresa_id', empresaId)
        .eq('activa', true)
        .is('deleted_at', null)
        .eq('acepta_movimientos', true)
        .order('codigo', { ascending: true })

      if (cuentasError) throw new Error(cuentasError.message)

      setCuentas((data ?? []) as CuentaContable[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las cuentas contables.'
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
      await loadCuentas(id)
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

  const resumen = useMemo(() => {
    const totalDebe = lineas.reduce((acc, linea) => acc + parseAmount(linea.debe), 0)
    const totalHaber = lineas.reduce((acc, linea) => acc + parseAmount(linea.haber), 0)
    const diferencia = totalDebe - totalHaber

    return {
      totalDebe,
      totalHaber,
      diferencia,
      cuadrado: Math.abs(diferencia) < 1,
    }
  }, [lineas])

  const cuentasPorTipo = useMemo(() => {
    return cuentas.reduce<Record<string, CuentaContable[]>>((acc, cuenta) => {
      if (!acc[cuenta.tipo]) acc[cuenta.tipo] = []
      acc[cuenta.tipo].push(cuenta)
      return acc
    }, {})
  }, [cuentas])

  const updateLinea = (
    uid: string,
    field: keyof Omit<LineaForm, 'uid'>,
    value: string
  ) => {
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.uid !== uid) return linea

        if (field === 'debe' && value.trim()) {
          return {
            ...linea,
            debe: value,
            haber: '',
          }
        }

        if (field === 'haber' && value.trim()) {
          return {
            ...linea,
            haber: value,
            debe: '',
          }
        }

        return {
          ...linea,
          [field]: value,
        }
      })
    )
  }

  const addLinea = () => {
    setLineas((prev) => [...prev, makeLine()])
  }

  const removeLinea = (uid: string) => {
    setLineas((prev) => {
      if (prev.length <= 2) return prev
      return prev.filter((linea) => linea.uid !== uid)
    })
  }

  const validateForm = (estadoDestino: 'borrador' | 'contabilizado') => {
    if (!empresaActivaId) return 'No hay empresa activa.'
    if (!canManage) return 'Solo usuarios admin pueden crear asientos contables.'
    if (!fecha) return 'La fecha es obligatoria.'
    if (!glosa.trim()) return 'La glosa es obligatoria.'
    if (lineas.length < 2) return 'El asiento debe tener al menos 2 líneas.'

    for (let index = 0; index < lineas.length; index += 1) {
      const linea = lineas[index]
      const debe = parseAmount(linea.debe)
      const haber = parseAmount(linea.haber)

      if (!linea.cuenta_contable_id) {
        return `La línea ${index + 1} no tiene cuenta contable.`
      }

      if (debe <= 0 && haber <= 0) {
        return `La línea ${index + 1} debe tener un valor en Debe o Haber.`
      }

      if (debe > 0 && haber > 0) {
        return `La línea ${index + 1} no puede tener Debe y Haber al mismo tiempo.`
      }
    }

    if (estadoDestino === 'contabilizado' && !resumen.cuadrado) {
      return 'Para contabilizar, el asiento debe estar cuadrado.'
    }

    return ''
  }

  const saveAsiento = async (estadoDestino: 'borrador' | 'contabilizado') => {
    const validationError = validateForm(estadoDestino)

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
      const cleanNumero = numero.trim() || null
      const cleanOrigenTipo = origenTipo.trim() || 'manual'

      const { data: asiento, error: asientoError } = await supabase
        .from('asientos_contables')
        .insert({
          empresa_id: empresaActivaId,
          fecha,
          numero: cleanNumero,
          glosa: glosa.trim(),
          origen_tipo: cleanOrigenTipo,
          origen_id: null,
          estado: estadoDestino,
          created_by: userId || null,
          updated_by: userId || null,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single()

      if (asientoError) throw new Error(asientoError.message)

      const detalles = lineas.map((linea) => ({
        asiento_id: asiento.id,
        empresa_id: empresaActivaId,
        cuenta_contable_id: linea.cuenta_contable_id,
        descripcion: linea.descripcion.trim() || glosa.trim(),
        debe: parseAmount(linea.debe),
        haber: parseAmount(linea.haber),
        created_by: userId || null,
        updated_by: userId || null,
        created_at: now,
        updated_at: now,
      }))

      const { error: detallesError } = await supabase
        .from('asiento_detalles')
        .insert(detalles)

      if (detallesError) {
        await supabase
          .from('asientos_contables')
          .update({
            activo: false,
            deleted_at: now,
            deleted_by: userId || null,
            updated_by: userId || null,
            updated_at: now,
          })
          .eq('id', asiento.id)
          .eq('empresa_id', empresaActivaId)

        throw new Error(detallesError.message)
      }

      setSuccess(
        estadoDestino === 'contabilizado'
          ? 'Asiento contabilizado correctamente.'
          : 'Asiento guardado como borrador.'
      )

      router.push('/plan-cuentas/asientos')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el asiento contable.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando nuevo asiento...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para acceder a Nuevo Asiento.
          </p>
        </section>
      </main>
    )
  }

  if (!canManage) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            Solo usuarios admin pueden crear asientos contables.
          </p>
          <Link
            href="/plan-cuentas/asientos"
            className="mt-4 inline-flex rounded-2xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            Volver a asientos
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Asientos Contables</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Nuevo asiento manual
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Registra un asiento de doble partida. Puedes guardarlo como borrador o
              contabilizarlo solo si el Debe y el Haber están cuadrados.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa activa:{' '}
              <span className="font-semibold text-slate-900">
                {empresaActivaNombre || 'Sin empresa activa'}
              </span>
            </p>
          </div>

          <Link
            href="/plan-cuentas/asientos"
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Volver a asientos
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total debe
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-700">
            {formatCLP(resumen.totalDebe)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total haber
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCLP(resumen.totalHaber)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            resumen.cuadrado
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              resumen.cuadrado ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            Diferencia
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              resumen.cuadrado ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCLP(resumen.diferencia)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            resumen.cuadrado
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              resumen.cuadrado ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            Estado
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              resumen.cuadrado ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {resumen.cuadrado ? 'Cuadrado' : 'Pendiente'}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Encabezado del asiento
          </h2>
          <p className="text-sm text-slate-500">
            Datos generales del asiento contable.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Número
            </label>
            <input
              value={numero}
              onChange={(event) => setNumero(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              placeholder="Ej: MAN-001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Origen
            </label>
            <input
              value={origenTipo}
              onChange={(event) => setOrigenTipo(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              placeholder="manual"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Glosa
            </label>
            <input
              value={glosa}
              onChange={(event) => setGlosa(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
              placeholder="Descripción general del asiento"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Líneas del asiento
            </h2>
            <p className="text-sm text-slate-500">
              Cada línea debe tener solo Debe o solo Haber.
            </p>
          </div>

          <button
            type="button"
            onClick={addLinea}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Agregar línea
          </button>
        </div>

        <div className="space-y-4">
          {lineas.map((linea, index) => (
            <div
              key={linea.uid}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Línea {index + 1}
                </p>

                <button
                  type="button"
                  onClick={() => removeLinea(linea.uid)}
                  disabled={lineas.length <= 2}
                  className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_160px_160px]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cuenta contable
                  </label>
                  <select
                    value={linea.cuenta_contable_id}
                    onChange={(event) =>
                      updateLinea(linea.uid, 'cuenta_contable_id', event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Descripción
                  </label>
                  <input
                    value={linea.descripcion}
                    onChange={(event) =>
                      updateLinea(linea.uid, 'descripcion', event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                    placeholder="Detalle de la línea"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Debe
                  </label>
                  <input
                    value={linea.debe}
                    onChange={(event) => updateLinea(linea.uid, 'debe', event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Haber
                  </label>
                  <input
                    value={linea.haber}
                    onChange={(event) => updateLinea(linea.uid, 'haber', event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            onClick={() => void saveAsiento('borrador')}
            disabled={saving}
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>

          <button
            type="button"
            onClick={() => void saveAsiento('contabilizado')}
            disabled={saving || !resumen.cuadrado}
            className="rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar y contabilizar'}
          </button>
        </div>
      </section>
    </main>
  )
}
