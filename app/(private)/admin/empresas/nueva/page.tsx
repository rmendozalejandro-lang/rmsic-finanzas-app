'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../../../lib/supabase/client'

type Empresa = {
  id: string
  nombre: string
  activa: boolean
}

export default function NuevaEmpresaPage() {
  const router = useRouter()

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [plantillas, setPlantillas] = useState<Empresa[]>([])
  const [empresaPlantillaId, setEmpresaPlantillaId] = useState(
    '557a054c-71ef-4c5f-8637-594755ad669b'
  )

  const [nombre, setNombre] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [rut, setRut] = useState('')
  const [giro, setGiro] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [adminEmail, setAdminEmail] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: superData, error: superError } = await supabase.rpc('es_super_admin')
      if (superError) throw new Error(superError.message)

      const allowed = Boolean(superData)
      setIsSuperAdmin(allowed)

      if (!allowed) return

      const { data, error: empresasError } = await supabase
        .from('empresas')
        .select('id, nombre, activa')
        .eq('activa', true)
        .order('nombre', { ascending: true })

      if (empresasError) throw new Error(empresasError.message)

      const rows = (data || []) as Empresa[]
      setPlantillas(rows)

      const rmsic = rows.find((empresa) => empresa.id === '557a054c-71ef-4c5f-8637-594755ad669b')
      if (rmsic) {
        setEmpresaPlantillaId(rmsic.id)
      } else if (rows.length > 0) {
        setEmpresaPlantillaId(rows[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el formulario.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const validate = () => {
    if (!nombre.trim()) return 'El nombre de la empresa es obligatorio.'
    if (!empresaPlantillaId) return 'Debes seleccionar una empresa plantilla.'
    return ''
  }

  const handleCreate = async () => {
    const validationError = validate()

    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    const confirmed = window.confirm(
      'Se creará una empresa nueva con plan de cuentas y categorías propias copiadas desde la plantilla. No se copiarán movimientos, bancos, clientes, proveedores, asientos ni saldos iniciales. ¿Deseas continuar?'
    )

    if (!confirmed) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { data, error: rpcError } = await supabase.rpc(
        'crear_empresa_con_estructura_base',
        {
          p_nombre: nombre.trim(),
          p_razon_social: razonSocial.trim() || null,
          p_rut: rut.trim() || null,
          p_giro: giro.trim() || null,
          p_direccion: direccion.trim() || null,
          p_telefono: telefono.trim() || null,
          p_email: email.trim() || null,
          p_admin_email: adminEmail.trim() || null,
          p_empresa_plantilla_id: empresaPlantillaId,
        }
      )

      if (rpcError) throw new Error(rpcError.message)

      const result = Array.isArray(data) ? data[0] : data

      setSuccess(
        `Empresa creada correctamente. Cuentas copiadas: ${result?.cuentas_copiadas ?? 0}. Categorías copiadas: ${result?.categorias_copiadas ?? 0}.`
      )

      setTimeout(() => {
        router.push('/admin/empresas')
      }, 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la empresa.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando formulario...</p>
        </section>
      </main>
    )
  }

  if (!isSuperAdmin) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos de super administrador para crear empresas.
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
            <p className="text-sm font-medium text-slate-500">Administración del sistema</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Nueva empresa
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Crea una empresa aislada con su propio empresa_id, plan de cuentas y categorías.
              No se copiarán datos operativos desde la plantilla.
            </p>
          </div>

          <Link
            href="/admin/empresas"
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Volver
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Datos de la empresa
          </h2>
          <p className="text-sm text-slate-500">
            Estos datos identifican al nuevo cliente/empresa dentro de la plataforma.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre visible" required>
            <input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej: Cliente Demo Contador"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="Razón social">
            <input
              value={razonSocial}
              onChange={(event) => setRazonSocial(event.target.value)}
              placeholder="Razón social legal"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="RUT">
            <input
              value={rut}
              onChange={(event) => setRut(event.target.value)}
              placeholder="Ej: 76.000.000-0"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="Giro">
            <input
              value={giro}
              onChange={(event) => setGiro(event.target.value)}
              placeholder="Actividad económica"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="Dirección">
            <input
              value={direccion}
              onChange={(event) => setDireccion(event.target.value)}
              placeholder="Dirección comercial"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="Teléfono">
            <input
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              placeholder="+56 9 ..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="Email empresa">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="contacto@empresa.cl"
              type="email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>

          <Field label="Email admin empresa">
            <input
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="Vacío = tu usuario actual"
              type="email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Estructura inicial
          </h2>
          <p className="text-sm text-slate-500">
            Se copiarán plan de cuentas y categorías desde la empresa plantilla. Los datos
            operativos no se copian.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
          <Field label="Empresa plantilla" required>
            <select
              value={empresaPlantillaId}
              onChange={(event) => setEmpresaPlantillaId(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              {plantillas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="w-full rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Creando...' : 'Crear empresa'}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          La nueva empresa tendrá datos totalmente separados. No se copiarán bancos,
          movimientos, clientes, proveedores, cuentas por cobrar, cuentas por pagar,
          asientos, saldos iniciales, cotizaciones ni OT.
        </div>
      </section>
    </main>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      {children}
    </div>
  )
}
