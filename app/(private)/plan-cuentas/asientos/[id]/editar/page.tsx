'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../../../lib/supabase/client'

type Cuenta = {
  id: string
  codigo: string
  nombre: string
  tipo: string
}

type Asiento = {
  id: string
  empresa_id: string
  fecha: string
  numero: string | null
  glosa: string
  origen_tipo: string | null
  estado: string
}

type Detalle = {
  id: string
  cuenta_contable_id: string
  descripcion: string | null
  debe: number
  haber: number
}

type Linea = {
  uid: string
  cuenta_contable_id: string
  descripcion: string
  debe: string
  haber: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function nuevaLinea(): Linea {
  return {
    uid: uid(),
    cuenta_contable_id: '',
    descripcion: '',
    debe: '',
    haber: '',
  }
}

function formatCLP(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function toAmount(value: string) {
  if (!value.trim()) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toDateInput(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

export default function EditarAsientoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const asientoId = params?.id || ''

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [asiento, setAsiento] = useState<Asiento | null>(null)
  const [cuentas, setCuentas] = useState<Cuenta[]>([])

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [numero, setNumero] = useState('')
  const [glosa, setGlosa] = useState('')
  const [origenTipo, setOrigenTipo] = useState('manual')
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea(), nuevaLinea()])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = usuarioRol === 'admin'
  const accesoPermitido = [
    'admin',
    'gerencia',
    'finanzas',
    'administracion_financiera',
  ].includes(usuarioRol)

  const resumen = useMemo(() => {
    const totalDebe = lineas.reduce((acc, item) => acc + toAmount(item.debe), 0)
    const totalHaber = lineas.reduce((acc, item) => acc + toAmount(item.haber), 0)
    const diferencia = totalDebe - totalHaber

    return {
      totalDebe,
      totalHaber,
      diferencia,
      cuadrado: Math.abs(diferencia) < 1,
    }
  }, [lineas])

  const cuentasPorTipo = useMemo(() => {
    return cuentas.reduce<Record<string, Cuenta[]>>((acc, cuenta) => {
      if (!acc[cuenta.tipo]) acc[cuenta.tipo] = []
      acc[cuenta.tipo].push(cuenta)
      return acc
    }, {})
  }, [cuentas])

  const cargarUsuario = async (empresaId: string) => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      setUsuarioRol('')
      return
    }

    const { data: rolData } = await supabase
      .from('usuario_empresas')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .maybeSingle()

    setUsuarioRol(rolData?.rol || '')
  }

  const cargarDatos = async (empresaId: string) => {
    if (!empresaId || !asientoId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const [asientoResp, detallesResp, cuentasResp] = await Promise.all([
        supabase
          .from('asientos_contables')
          .select('id, empresa_id, fecha, numero, glosa, origen_tipo, estado')
          .eq('id', asientoId)
          .eq('empresa_id', empresaId)
          .maybeSingle(),

        supabase
          .from('v_asiento_detalle_completo')
          .select('id, cuenta_contable_id, descripcion, debe, haber, created_at')
          .eq('asiento_id', asientoId)
          .order('created_at', { ascending: true }),

        supabase
          .from('cuentas_contables')
          .select('id, codigo, nombre, tipo')
          .eq('empresa_id', empresaId)
          .eq('activa', true)
          .is('deleted_at', null)
          .eq('acepta_movimientos', true)
          .order('codigo', { ascending: true }),
      ])

      if (asientoResp.error) throw new Error(asientoResp.error.message)
      if (detallesResp.error) throw new Error(detallesResp.error.message)
      if (cuentasResp.error) throw new Error(cuentasResp.error.message)

      if (!asientoResp.data) {
        throw new Error('No se encontró el asiento contable.')
      }

      const asientoData = asientoResp.data as Asiento
      const detallesData = (detallesResp.data ?? []) as Detalle[]

      setAsiento(asientoData)
      setFecha(toDateInput(asientoData.fecha))
      setNumero(asientoData.numero || '')
      setGlosa(asientoData.glosa || '')
      setOrigenTipo(asientoData.origen_tipo || 'manual')
      setCuentas((cuentasResp.data ?? []) as Cuenta[])

      if (detallesData.length >= 2) {
        setLineas(
          detallesData.map((detalle) => ({
            uid: uid(),
            cuenta_contable_id: detalle.cuenta_contable_id,
            descripcion: detalle.descripcion || '',
            debe: Number(detalle.debe || 0) > 0 ? String(Number(detalle.debe)) : '',
            haber: Number(detalle.haber || 0) > 0 ? String(Number(detalle.haber)) : '',
          }))
        )
      } else {
        setLineas([nuevaLinea(), nuevaLinea()])
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el asiento contable.'
      )
    } finally {
      setLoading(false)
    }
  }

  const sincronizarEmpresa = async () => {
    const id = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const nombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(id)
    setEmpresaActivaNombre(nombre)

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
  }, [asientoId])

  const actualizarLinea = (uidLinea: string, campo: keyof Omit<Linea, 'uid'>, valor: string) => {
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.uid !== uidLinea) return linea

        if (campo === 'debe' && valor.trim()) {
          return { ...linea, debe: valor, haber: '' }
        }

        if (campo === 'haber' && valor.trim()) {
          return { ...linea, haber: valor, debe: '' }
        }

        return { ...linea, [campo]: valor }
      })
    )
  }

  const agregarLinea = () => {
    setLineas((prev) => [...prev, nuevaLinea()])
  }

  const quitarLinea = (uidLinea: string) => {
    setLineas((prev) => {
      if (prev.length <= 2) return prev
      return prev.filter((linea) => linea.uid !== uidLinea)
    })
  }

  const validar = (contabilizar: boolean) => {
    if (!canManage) return 'Solo usuarios admin pueden editar asientos.'
    if (asiento?.estado !== 'borrador') return 'Solo se pueden editar asientos en borrador.'
    if (!fecha) return 'La fecha es obligatoria.'
    if (!glosa.trim()) return 'La glosa es obligatoria.'
    if (lineas.length < 2) return 'El asiento debe tener al menos 2 líneas.'

    for (let i = 0; i < lineas.length; i += 1) {
      const linea = lineas[i]
      const debe = toAmount(linea.debe)
      const haber = toAmount(linea.haber)

      if (!linea.cuenta_contable_id) return `La línea ${i + 1} no tiene cuenta contable.`
      if (debe <= 0 && haber <= 0) return `La línea ${i + 1} debe tener Debe o Haber.`
      if (debe > 0 && haber > 0) return `La línea ${i + 1} no puede tener Debe y Haber.`
    }

    if (contabilizar && !resumen.cuadrado) {
      return 'Para contabilizar, el asiento debe estar cuadrado.'
    }

    return ''
  }

  const guardar = async (contabilizar: boolean) => {
    const validationError = validar(contabilizar)

    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const detalles = lineas.map((linea) => ({
        cuenta_contable_id: linea.cuenta_contable_id,
        descripcion: linea.descripcion.trim() || glosa.trim(),
        debe: toAmount(linea.debe),
        haber: toAmount(linea.haber),
      }))

      const { error: saveError } = await supabase.rpc('guardar_asiento_borrador', {
        p_asiento_id: asientoId,
        p_fecha: fecha,
        p_numero: numero.trim() || null,
        p_glosa: glosa.trim(),
        p_origen_tipo: origenTipo.trim() || 'manual',
        p_detalles: detalles,
      })

      if (saveError) throw new Error(saveError.message)

      if (contabilizar) {
        const { error: contabilizarError } = await supabase.rpc('contabilizar_asiento', {
          p_asiento_id: asientoId,
        })

        if (contabilizarError) throw new Error(contabilizarError.message)
      }

      setSuccess(
        contabilizar
          ? 'Asiento guardado y contabilizado correctamente.'
          : 'Asiento borrador actualizado correctamente.'
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
          <p className="text-sm text-slate-500">Cargando asiento...</p>
        </section>
      </main>
    )
  }

  if (!accesoPermitido || !canManage) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            Solo usuarios admin pueden editar asientos contables.
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

  if (asiento?.estado !== 'borrador') {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Este asiento no puede editarse porque no está en estado borrador.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Estado actual: {asiento?.estado || '-'}
          </p>
          <Link
            href="/plan-cuentas/asientos"
            className="mt-4 inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
              Editar asiento borrador
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Modifica el encabezado y las líneas del asiento antes de contabilizarlo.
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
              placeholder="Ej: MOV-001"
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
            onClick={agregarLinea}
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
                  onClick={() => quitarLinea(linea.uid)}
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
                      actualizarLinea(linea.uid, 'cuenta_contable_id', event.target.value)
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
                      actualizarLinea(linea.uid, 'descripcion', event.target.value)
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
                    onChange={(event) => actualizarLinea(linea.uid, 'debe', event.target.value)}
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
                    onChange={(event) => actualizarLinea(linea.uid, 'haber', event.target.value)}
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
            onClick={() => void guardar(false)}
            disabled={saving}
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>

          <button
            type="button"
            onClick={() => void guardar(true)}
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
