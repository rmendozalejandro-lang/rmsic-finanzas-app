'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import { supabase } from '../../../../lib/supabase/client'

type PerfilMini = {
  id: string
  email: string | null
}

type OTTecnico = {
  user_id: string
  nombre_completo: string
  cargo: string
  activo: boolean
  puede_crear_ot: boolean
  puede_cerrar_ot: boolean
  created_at?: string
  updated_at?: string
}

type TecnicoForm = {
  user_id: string
  nombre_completo: string
  cargo: string
  activo: boolean
  puede_crear_ot: boolean
  puede_cerrar_ot: boolean
}

function toTitleCase(text: string) {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function humanizePerson(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'

  const raw = value.trim()
  const lower = raw.toLowerCase()

  const knownMap: Record<string, string> = {
    'rmendoza@rmsic.cl': 'Raúl Mendoza C.',
    'dallendes@rmsic.cl': 'David Allendes A.',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0]
    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function emptyForm(): TecnicoForm {
  return {
    user_id: '',
    nombre_completo: '',
    cargo: '',
    activo: true,
    puede_crear_ot: true,
    puede_cerrar_ot: true,
  }
}

function TecnicosOTPageContent() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorizing, setAuthorizing] = useState(true)
  const [canManage, setCanManage] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [perfiles, setPerfiles] = useState<PerfilMini[]>([])
  const [tecnicos, setTecnicos] = useState<OTTecnico[]>([])

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [form, setForm] = useState<TecnicoForm>(emptyForm())

  const perfilesDisponibles = useMemo(() => {
    const usados = new Set(tecnicos.map((item) => item.user_id))
    if (editingUserId) usados.delete(editingUserId)

    return perfiles.filter((item) => !usados.has(item.id))
  }, [perfiles, tecnicos, editingUserId])

  useEffect(() => {
    let active = true

    const validateManagementAccess = async () => {
      try {
        setAuthorizing(true)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.replace('/login')
          return
        }

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('empresa_activa_id') || ''
            : ''

        if (!empresaActivaId) {
          router.replace('/ot')
          return
        }

        const { data, error } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', session.user.id)
          .eq('empresa_id', empresaActivaId)
          .eq('activo', true)
          .maybeSingle()

        if (error) {
          router.replace('/ot')
          return
        }

        const rol = data?.rol || ''
        const allowed = rol !== 'tecnico_ot'

        if (!active) return

        if (!allowed) {
          router.replace('/ot')
          return
        }

        setCanManage(true)
      } finally {
        if (active) {
          setAuthorizing(false)
        }
      }
    }

    void validateManagementAccess()

    return () => {
      active = false
    }
  }, [router])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [perfilesResp, tecnicosResp] = await Promise.all([
        supabase.from('perfiles').select('id,email').order('email', { ascending: true }),
        supabase
          .from('ot_tecnicos')
          .select(
            `
              user_id,
              nombre_completo,
              cargo,
              activo,
              puede_crear_ot,
              puede_cerrar_ot,
              created_at,
              updated_at
            `
          )
          .order('nombre_completo', { ascending: true }),
      ])

      if (perfilesResp.error) {
        throw new Error(`No se pudieron cargar los perfiles: ${perfilesResp.error.message}`)
      }

      if (tecnicosResp.error) {
        throw new Error(`No se pudieron cargar los técnicos OT: ${tecnicosResp.error.message}`)
      }

      setPerfiles((perfilesResp.data ?? []) as PerfilMini[])
      setTecnicos((tecnicosResp.data ?? []) as OTTecnico[])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar la administración de técnicos.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canManage) return
    void loadData()
  }, [canManage])

  const handleChange = <K extends keyof TecnicoForm>(field: K, value: TecnicoForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const startCreate = () => {
    setEditingUserId(null)
    setForm(emptyForm())
    setError('')
    setSuccess('')
  }

  const startEdit = (tecnico: OTTecnico) => {
    setEditingUserId(tecnico.user_id)
    setForm({
      user_id: tecnico.user_id,
      nombre_completo: tecnico.nombre_completo,
      cargo: tecnico.cargo,
      activo: tecnico.activo,
      puede_crear_ot: tecnico.puede_crear_ot,
      puede_cerrar_ot: tecnico.puede_cerrar_ot,
    })
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setForm(emptyForm())
    setError('')
    setSuccess('')
  }

  const validateForm = () => {
    if (!form.user_id) return 'Debes seleccionar un usuario.'
    if (!form.nombre_completo.trim()) return 'Debes ingresar el nombre completo.'
    if (!form.cargo.trim()) return 'Debes ingresar el cargo.'
    return ''
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const payload = {
        user_id: form.user_id,
        nombre_completo: form.nombre_completo.trim(),
        cargo: form.cargo.trim(),
        activo: form.activo,
        puede_crear_ot: form.puede_crear_ot,
        puede_cerrar_ot: form.puede_cerrar_ot,
      }

      const { error: upsertError } = await supabase
        .from('ot_tecnicos')
        .upsert(payload, { onConflict: 'user_id' })

      if (upsertError) {
        throw new Error(`No se pudo guardar el técnico OT: ${upsertError.message}`)
      }

      await loadData()

      setSuccess(editingUserId ? 'Técnico actualizado correctamente.' : 'Técnico creado correctamente.')
      setEditingUserId(null)
      setForm(emptyForm())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el técnico OT.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (tecnico: OTTecnico) => {
    try {
      setError('')
      setSuccess('')

      const { error: updateError } = await supabase
        .from('ot_tecnicos')
        .update({ activo: !tecnico.activo })
        .eq('user_id', tecnico.user_id)

      if (updateError) {
        throw new Error(`No se pudo actualizar el estado: ${updateError.message}`)
      }

      await loadData()
      setSuccess(`Técnico ${!tecnico.activo ? 'activado' : 'desactivado'} correctamente.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el técnico.')
    }
  }

  if (authorizing || loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        Cargando técnicos OT...
      </div>
    )
  }

  if (!canManage) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Configuración OT</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Técnicos OT
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Administra los usuarios que el sistema reconocerá como técnicos para órdenes de trabajo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90]"
            >
              Nuevo técnico
            </button>

            <Link
              href="/ot"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Volver a OT
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingUserId ? 'Editar técnico OT' : 'Registrar técnico OT'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Asocia un usuario existente a un perfil técnico operativo de OT.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Usuario *
            </label>
            <select
              value={form.user_id}
              onChange={(e) => handleChange('user_id', e.target.value)}
              disabled={!!editingUserId}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
            >
              <option value="">Selecciona un usuario</option>
              {(editingUserId ? perfiles : perfilesDisponibles).map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.email || perfil.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nombre completo *
            </label>
            <input
              type="text"
              value={form.nombre_completo}
              onChange={(e) => handleChange('nombre_completo', e.target.value)}
              placeholder="Ejemplo: Raúl Mendoza C."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cargo *
            </label>
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => handleChange('cargo', e.target.value)}
              placeholder="Ejemplo: Ingeniero de Proyecto"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => handleChange('activo', e.target.checked)}
            />
            Técnico activo
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.puede_crear_ot}
              onChange={(e) => handleChange('puede_crear_ot', e.target.checked)}
            />
            Puede crear OT
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.puede_cerrar_ot}
              onChange={(e) => handleChange('puede_cerrar_ot', e.target.checked)}
            />
            Puede cerrar OT
          </label>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving
              ? 'Guardando...'
              : editingUserId
                ? 'Actualizar técnico'
                : 'Guardar técnico'}
          </button>

          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Limpiar formulario
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Técnicos registrados</h2>
          <p className="mt-1 text-sm text-slate-500">
            Usuarios que el sistema reconoce como ejecutantes OT.
          </p>
        </div>

        {tecnicos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Aún no hay técnicos OT registrados.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Cargo</th>
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Activo</th>
                    <th className="px-4 py-3 font-semibold">Crear OT</th>
                    <th className="px-4 py-3 font-semibold">Cerrar OT</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicos.map((item) => {
                    const perfil = perfiles.find((perfilItem) => perfilItem.id === item.user_id)
                    const email = perfil?.email || item.user_id

                    return (
                      <tr key={item.user_id} className="border-t border-slate-100 text-slate-700">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.nombre_completo || humanizePerson(email)}
                        </td>
                        <td className="px-4 py-3">{item.cargo}</td>
                        <td className="px-4 py-3">{email}</td>
                        <td className="px-4 py-3">{item.activo ? 'Sí' : 'No'}</td>
                        <td className="px-4 py-3">{item.puede_crear_ot ? 'Sí' : 'No'}</td>
                        <td className="px-4 py-3">{item.puede_cerrar_ot ? 'Sí' : 'No'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleActivo(item)}
                              className={`inline-flex rounded-lg border px-3 py-1.5 text-sm font-medium ${
                                item.activo
                                  ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                  : 'border-green-300 text-green-700 hover:bg-green-50'
                              }`}
                            >
                              {item.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
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

export default function TecnicosOTPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <TecnicosOTPageContent />
    </ProtectedModuleRoute>
  )
}