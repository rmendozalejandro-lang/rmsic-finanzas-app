'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Empresa = {
  id: string
  nombre: string
  razon_social: string | null
  rut: string | null
}

type UsuarioEmpresaRow = {
  tipo: 'usuario' | 'invitacion'
  usuario_empresa_id: string | null
  invitacion_id: string | null
  usuario_id: string | null
  nombre_completo: string | null
  email: string
  rol: string
  activo: boolean
  estado: string
  created_at: string
}

const roles = [
  { value: 'admin', label: 'Admin empresa' },
  { value: 'administracion_financiera', label: 'Administración financiera' },
  { value: 'cobranzas', label: 'Cobranzas' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'tecnico_ot', label: 'Técnico OT / Solo OT' },
]

const STORAGE_ID_KEY = 'empresa_activa_id'

function formatDate(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export default function ConfiguracionUsuariosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [items, setItems] = useState<UsuarioEmpresaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [puedeAdministrar, setPuedeAdministrar] = useState(false)

  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('administracion_financiera')
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'usuarios' | 'invitaciones'>('todos')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const getEmpresaActivaId = () => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_ID_KEY) || ''
  }

  const loadData = async (empresaActivaId?: string) => {
    const empresaActualId = empresaActivaId || getEmpresaActivaId()

    setEmpresaId(empresaActualId)

    if (!empresaActualId) {
      setEmpresa(null)
      setItems([])
      setPuedeAdministrar(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session?.user) {
        setPuedeAdministrar(false)
        setEmpresa(null)
        setItems([])
        return
      }

      const { data: allowedData, error: allowedError } = await supabase.rpc(
        'puede_administrar_empresa',
        { p_empresa_id: empresaActualId }
      )

      if (allowedError) throw new Error(allowedError.message)

      const allowed = Boolean(allowedData)

      setPuedeAdministrar(allowed)

      if (!allowed) {
        setEmpresa(null)
        setItems([])
        return
      }

      const [empresaResp, usuariosResp] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre, razon_social, rut')
          .eq('id', empresaActualId)
          .maybeSingle(),

        supabase.rpc('admin_listar_usuarios_empresa', {
          p_empresa_id: empresaActualId,
        }),
      ])

      if (empresaResp.error) throw new Error(empresaResp.error.message)
      if (usuariosResp.error) throw new Error(usuariosResp.error.message)

      setEmpresa((empresaResp.data || null) as Empresa | null)
      setItems((usuariosResp.data || []) as UsuarioEmpresaRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()

    const handleEmpresaActivaCambiada = () => {
      void loadData()
    }

    window.addEventListener('empresa-activa-cambiada', handleEmpresaActivaCambiada)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', handleEmpresaActivaCambiada)
    }
  }, [])

  const itemsFiltrados = useMemo(() => {
    const q = normalize(busqueda)

    return items.filter((item) => {
      if (tipoFiltro === 'usuarios' && item.tipo !== 'usuario') return false
      if (tipoFiltro === 'invitaciones' && item.tipo !== 'invitacion') return false

      if (!q) return true

      return [item.nombre_completo, item.email, item.rol, item.estado, item.tipo]
        .map(normalize)
        .join(' ')
        .includes(q)
    })
  }, [items, busqueda, tipoFiltro])

  const usuariosActivos = items.filter((item) => item.tipo === 'usuario' && item.activo).length

  const invitacionesPendientes = items.filter(
    (item) => item.tipo === 'invitacion' && item.estado === 'pendiente'
  ).length

  const validateInvite = () => {
    if (!empresaId) return 'No hay empresa activa seleccionada.'
    if (!email.trim()) return 'El email es obligatorio.'
    if (!email.includes('@')) return 'Debes ingresar un email válido.'
    if (!rol) return 'Debes seleccionar un rol.'
    return ''
  }

  const handleAgregarOInvitar = async () => {
    const validationError = validateInvite()

    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { data, error: rpcError } = await supabase.rpc(
        'agregar_o_invitar_usuario_empresa',
        {
          p_empresa_id: empresaId,
          p_email: email.trim().toLowerCase(),
          p_rol: rol,
        }
      )

      if (rpcError) throw new Error(rpcError.message)

      const result = Array.isArray(data) ? data[0] : data

      setSuccess(result?.mensaje || 'Usuario o invitación procesada correctamente.')
      setEmail('')
      setRol('administracion_financiera')
      await loadData(empresaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar o invitar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  const handleCambiarRol = async (item: UsuarioEmpresaRow, nuevoRol: string) => {
    if (!item.usuario_empresa_id) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: rpcError } = await supabase.rpc('actualizar_rol_usuario_empresa', {
        p_usuario_empresa_id: item.usuario_empresa_id,
        p_rol: nuevoRol,
      })

      if (rpcError) throw new Error(rpcError.message)

      setSuccess('Rol actualizado correctamente.')
      await loadData(empresaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el rol.')
    } finally {
      setSaving(false)
    }
  }

  const handleCambiarEstadoUsuario = async (item: UsuarioEmpresaRow) => {
    if (!item.usuario_empresa_id) return

    const accion = item.activo ? 'desactivar' : 'activar'
    const confirmed = window.confirm(`¿Deseas ${accion} este usuario en la empresa?`)

    if (!confirmed) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: rpcError } = await supabase.rpc('cambiar_estado_usuario_empresa', {
        p_usuario_empresa_id: item.usuario_empresa_id,
        p_activo: !item.activo,
      })

      if (rpcError) throw new Error(rpcError.message)

      setSuccess(`Usuario ${item.activo ? 'desactivado' : 'activado'} correctamente.`)
      await loadData(empresaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelarInvitacion = async (item: UsuarioEmpresaRow) => {
    if (!item.invitacion_id) return

    const confirmed = window.confirm(`¿Deseas cancelar la invitación a ${item.email}?`)

    if (!confirmed) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: rpcError } = await supabase.rpc('cancelar_invitacion_empresa', {
        p_invitacion_id: item.invitacion_id,
      })

      if (rpcError) throw new Error(rpcError.message)

      setSuccess('Invitación cancelada correctamente.')
      await loadData(empresaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la invitación.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando usuarios de la empresa activa...</p>
        </section>
      </main>
    )
  }

  if (!empresaId) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No hay empresa activa seleccionada.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Selecciona una empresa en el selector superior para administrar sus usuarios.
          </p>
        </section>
      </main>
    )
  }

  if (!puedeAdministrar) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos para administrar usuarios de esta empresa.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Solo un usuario con rol admin de la empresa activa puede administrar usuarios.
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
            <p className="text-sm font-medium text-slate-500">
              Configuración de empresa
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Usuarios de mi empresa
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Administra usuarios e invitaciones de la empresa activa. Los cambios solo
              afectan a esta empresa.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Empresa:{' '}
              <span className="font-semibold text-slate-900">
                {empresa?.nombre || empresaId}
              </span>
              {empresa?.rut && <span> · RUT: {empresa.rut}</span>}
            </p>
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
        <Kpi title="Usuarios activos" value={String(usuariosActivos)} tone="emerald" />
        <Kpi title="Invitaciones pendientes" value={String(invitacionesPendientes)} tone="amber" />
        <Kpi title="Registros totales" value={String(items.length)} />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Agregar usuario o crear invitación
          </h2>
          <p className="text-sm text-slate-500">
            Si el usuario ya existe, se asociará a esta empresa. Si no existe,
            quedará como invitación pendiente y deberá registrarse usando el mismo email.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_260px_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email usuario
            </label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.cl"
              type="email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Rol
            </label>
            <select
              value={rol}
              onChange={(event) => setRol(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAgregarOInvitar}
              disabled={saving}
              className="w-full rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Procesando...' : 'Agregar / invitar'}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          El usuario invitado debe registrarse usando exactamente el mismo email.
          Al iniciar sesión, la invitación se aceptará automáticamente y quedará
          asociado a esta empresa.
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 grid gap-4 xl:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipo
            </label>
            <select
              value={tipoFiltro}
              onChange={(event) =>
                setTipoFiltro(event.target.value as 'todos' | 'usuarios' | 'invitaciones')
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="todos">Todos</option>
              <option value="usuarios">Usuarios</option>
              <option value="invitaciones">Invitaciones</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre, email, rol o estado"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Usuario / Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay usuarios ni invitaciones para mostrar.
                    </td>
                  </tr>
                ) : (
                  itemsFiltrados.map((item) => (
                    <tr
                      key={`${item.tipo}-${item.usuario_empresa_id || item.invitacion_id}`}
                      className="align-top"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.tipo === 'usuario'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.tipo === 'usuario' ? 'Usuario' : 'Invitación'}
                        </span>
                      </td>

                      <td className="min-w-[280px] px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {item.nombre_completo || item.email}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{item.email}</div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {item.tipo === 'usuario' ? (
                          <select
                            value={item.rol}
                            disabled={saving}
                            onChange={(event) => void handleCambiarRol(item, event.target.value)}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-[#245C90] disabled:opacity-60"
                          >
                            {roles.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-700">{item.rol}</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.estado === 'activo' || item.estado === 'pendiente'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.estado}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDate(item.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {item.tipo === 'usuario' && item.usuario_empresa_id ? (
                          <button
                            type="button"
                            onClick={() => void handleCambiarEstadoUsuario(item)}
                            disabled={saving}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                              item.activo
                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {item.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleCancelarInvitacion(item)}
                            disabled={saving}
                            className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancelar
                          </button>
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