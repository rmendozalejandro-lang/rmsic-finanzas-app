'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import { supabase } from '../../../../lib/supabase/client'

type ClienteOption = {
  id: string
  nombre: string
}

type TipoServicioOption = {
  id: string
  codigo: string
  nombre: string
}

type EstadoOption = {
  id: string
  codigo: string
  nombre: string
  orden: number
}

type SelectOption = {
  id: string
  label: string
}

type OTTecnicoRow = {
  user_id: string
  nombre_completo: string
  cargo: string
  activo: boolean
  puede_crear_ot: boolean
  puede_cerrar_ot: boolean
}

type PerfilRow = {
  id: string
  nombre_completo: string | null
  email: string | null
}

type FormDataState = {
  empresa_id: string
  cliente_id: string
  tipo_servicio_id: string
  estado_id: string
  fecha_ot: string
  fecha_programada: string
  titulo: string
  descripcion_solicitud: string
  problema_reportado: string
  tecnico_responsable_id: string
  supervisor_id: string
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  requiere_checklist: boolean
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

function todayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildSupervisorLabel(item: PerfilRow) {
  if (item.nombre_completo?.trim() && item.email?.trim()) {
    return `${item.nombre_completo} - ${item.email}`
  }

  if (item.nombre_completo?.trim()) {
    return item.nombre_completo
  }

  if (item.email?.trim()) {
    return item.email
  }

  return item.id
}

function NuevaOTContent() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [warning, setWarning] = useState('')

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicioOption[]>([])
  const [estados, setEstados] = useState<EstadoOption[]>([])
  const [tecnicos, setTecnicos] = useState<SelectOption[]>([])
  const [supervisores, setSupervisores] = useState<SelectOption[]>([])

  const [form, setForm] = useState<FormDataState>({
    empresa_id: '',
    cliente_id: '',
    tipo_servicio_id: '',
    estado_id: '',
    fecha_ot: todayLocalDate(),
    fecha_programada: '',
    titulo: '',
    descripcion_solicitud: '',
    problema_reportado: '',
    tecnico_responsable_id: '',
    supervisor_id: '',
    prioridad: 'media',
    requiere_checklist: false,
  })

  const estadoAsignadaId = useMemo(() => {
    return estados.find((item) => item.codigo === 'asignada')?.id ?? ''
  }, [estados])

  const tipoPreventivaId = useMemo(() => {
    return tiposServicio.find((item) => item.codigo === 'preventiva')?.id ?? ''
  }, [tiposServicio])

  const selectedTipo = useMemo(() => {
    return tiposServicio.find((item) => item.id === form.tipo_servicio_id) ?? null
  }, [tiposServicio, form.tipo_servicio_id])

  useEffect(() => {
    const storedEmpresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
    const storedEmpresaNombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

    setEmpresaActivaId(storedEmpresaId)
    setEmpresaActivaNombre(storedEmpresaNombre)

    setForm((prev) => ({
      ...prev,
      empresa_id: storedEmpresaId,
      fecha_ot: prev.fecha_ot || todayLocalDate(),
    }))
  }, [])

  useEffect(() => {
    let active = true

    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError('')
        setWarning('')

        const storedEmpresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''

        if (!storedEmpresaId) {
          throw new Error('No hay empresa activa seleccionada.')
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(`No se pudo validar el usuario actual: ${userError.message}`)
        }

        if (!user) {
          throw new Error('No hay usuario autenticado.')
        }

        const [clientesResp, tiposResp, estadosResp, tecnicosResp, supervisoresResp] =
          await Promise.all([
            supabase
              .from('clientes')
              .select('id, nombre')
              .eq('empresa_id', storedEmpresaId)
              .order('nombre', { ascending: true }),

            supabase
              .from('ot_tipos_servicio')
              .select('id, codigo, nombre')
              .eq('activo', true)
              .order('nombre', { ascending: true }),

            supabase
              .from('ot_estados')
              .select('id, codigo, nombre, orden')
              .eq('activo', true)
              .order('orden', { ascending: true }),

            supabase
              .from('ot_tecnicos')
              .select(
                'user_id, nombre_completo, cargo, activo, puede_crear_ot, puede_cerrar_ot'
              )
              .eq('activo', true)
              .order('nombre_completo', { ascending: true }),

            supabase
              .from('perfiles')
              .select('id, nombre_completo, email')
              .order('nombre_completo', { ascending: true }),
          ])

        if (clientesResp.error) {
          throw new Error(`No se pudieron cargar los clientes: ${clientesResp.error.message}`)
        }

        if (tiposResp.error) {
          throw new Error(
            `No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`
          )
        }

        if (estadosResp.error) {
          throw new Error(`No se pudieron cargar los estados: ${estadosResp.error.message}`)
        }

        if (tecnicosResp.error) {
          throw new Error(`No se pudieron cargar los técnicos OT: ${tecnicosResp.error.message}`)
        }

        const clientesData: ClienteOption[] = (clientesResp.data ?? []).map((item) => ({
          id: item.id,
          nombre: item.nombre,
        }))

        const tiposData: TipoServicioOption[] = (tiposResp.data ?? []).map((item) => ({
          id: item.id,
          codigo: item.codigo,
          nombre: item.nombre,
        }))

        const estadosData: EstadoOption[] = (estadosResp.data ?? []).map((item) => ({
          id: item.id,
          codigo: item.codigo,
          nombre: item.nombre,
          orden: item.orden,
        }))

        const tecnicosRaw = (tecnicosResp.data ?? []) as OTTecnicoRow[]
        const tecnicosData: SelectOption[] = tecnicosRaw.map((item) => ({
          id: item.user_id,
          label: item.cargo?.trim()
            ? `${item.nombre_completo} - ${item.cargo}`
            : item.nombre_completo,
        }))

        let supervisoresData: SelectOption[] = []
        let nextWarning = ''

        if (supervisoresResp.error) {
          nextWarning =
            'No se pudieron cargar los supervisores. Puedes crear la OT igual, pero sin asignar supervisor por ahora.'
        } else {
          supervisoresData = ((supervisoresResp.data ?? []) as PerfilRow[]).map((item) => ({
            id: item.id,
            label: buildSupervisorLabel(item),
          }))
        }

        const tecnicoActual = tecnicosRaw.find((item) => item.user_id === user.id)

        if (!active) return

        setClientes(clientesData)
        setTiposServicio(tiposData)
        setEstados(estadosData)
        setTecnicos(tecnicosData)
        setSupervisores(supervisoresData)
        setWarning(nextWarning)

        const tipoGeneral =
          tiposData.find((item) => item.codigo === 'general')?.id ??
          tiposData[0]?.id ??
          ''

        const estadoAsignada =
          estadosData.find((item) => item.codigo === 'asignada')?.id ??
          estadosData[0]?.id ??
          ''

        setForm((prev) => ({
          ...prev,
          empresa_id: storedEmpresaId,
          tipo_servicio_id: prev.tipo_servicio_id || tipoGeneral,
          estado_id: prev.estado_id || estadoAsignada,
          tecnico_responsable_id:
            prev.tecnico_responsable_id || tecnicoActual?.user_id || '',
        }))
      } catch (err) {
        if (!active) return
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar la información inicial.'
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (form.tipo_servicio_id === tipoPreventivaId) {
      setForm((prev) => ({
        ...prev,
        requiere_checklist: true,
      }))
    }
  }, [form.tipo_servicio_id, tipoPreventivaId])

  const handleChange = <K extends keyof FormDataState>(
    field: K,
    value: FormDataState[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = () => {
    if (!form.empresa_id) {
      return 'No se detectó empresa activa.'
    }

    if (!form.cliente_id) {
      return 'Debes seleccionar un cliente.'
    }

    if (!form.tipo_servicio_id) {
      return 'Debes seleccionar un tipo de servicio.'
    }

    if (!form.estado_id) {
      return 'Debes seleccionar un estado.'
    }

    if (!form.titulo.trim()) {
      return 'Debes ingresar un título para la OT.'
    }

    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw new Error(`No se pudo validar el usuario actual: ${userError.message}`)
      }

      if (!user) {
        throw new Error('No hay usuario autenticado.')
      }

      const payload = {
        empresa_id: form.empresa_id,
        cliente_id: form.cliente_id,
        tipo_servicio_id: form.tipo_servicio_id,
        estado_id: form.estado_id || estadoAsignadaId,
        fecha_ot: form.fecha_ot || todayLocalDate(),
        fecha_programada: form.fecha_programada || null,
        titulo: form.titulo.trim(),
        descripcion_solicitud: form.descripcion_solicitud.trim() || null,
        problema_reportado: form.problema_reportado.trim() || null,
        tecnico_responsable_id: form.tecnico_responsable_id || null,
        supervisor_id: form.supervisor_id || null,
        prioridad: form.prioridad,
        requiere_checklist: form.requiere_checklist,
        created_by: user.id,
      }

      const { data, error: insertError } = await supabase
        .from('ot_ordenes_trabajo')
        .insert(payload)
        .select('id, folio')
        .single()

      if (insertError) {
        throw new Error(`No se pudo crear la OT: ${insertError.message}`)
      }

      setSuccess(`OT creada correctamente${data?.folio ? ` (${data.folio})` : ''}.`)

      if (data?.id) {
        router.push(`/ot/${data.id}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la OT.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Nueva OT
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Crea una nueva orden de trabajo asociada a la empresa activa.
            </p>
          </div>

          <Link
            href="/ot"
            className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver a OT
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando formulario...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Datos generales
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Empresa activa
                </label>
                <input
                  value={empresaActivaNombre || ''}
                  disabled
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Cliente *
                </label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => handleChange('cliente_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tipo de servicio *
                </label>
                <select
                  value={form.tipo_servicio_id}
                  onChange={(e) => handleChange('tipo_servicio_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">
                    {tiposServicio.length === 0
                      ? 'No hay tipos disponibles'
                      : 'Selecciona un tipo'}
                  </option>
                  {tiposServicio.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Estado inicial *
                </label>
                <select
                  value={form.estado_id}
                  onChange={(e) => handleChange('estado_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">
                    {estados.length === 0
                      ? 'No hay estados disponibles'
                      : 'Selecciona un estado'}
                  </option>
                  {estados.map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha OT
                </label>
                <input
                  type="date"
                  value={form.fecha_ot}
                  onChange={(e) => handleChange('fecha_ot', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha programada
                </label>
                <input
                  type="date"
                  value={form.fecha_programada}
                  onChange={(e) => handleChange('fecha_programada', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Prioridad
                </label>
                <select
                  value={form.prioridad}
                  onChange={(e) =>
                    handleChange(
                      'prioridad',
                      e.target.value as FormDataState['prioridad']
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.requiere_checklist}
                    onChange={(e) =>
                      handleChange('requiere_checklist', e.target.checked)
                    }
                    disabled={form.tipo_servicio_id === tipoPreventivaId}
                  />
                  Requiere checklist
                </label>
              </div>
            </div>

            {selectedTipo?.codigo === 'preventiva' ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Para OT de mantención preventiva, el checklist queda marcado automáticamente.
              </div>
            ) : null}

            {tiposServicio.length === 0 || estados.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No se cargaron correctamente los catálogos de tipo de servicio o estado.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Información técnica
            </h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Título *
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => handleChange('titulo', e.target.value)}
                  placeholder="Ejemplo: Revisión sistema de bombeo"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Descripción de la solicitud
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) =>
                    handleChange('descripcion_solicitud', e.target.value)
                  }
                  rows={4}
                  placeholder="Describe el requerimiento general del trabajo."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Problema reportado
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) =>
                    handleChange('problema_reportado', e.target.value)
                  }
                  rows={4}
                  placeholder="Describe el problema informado por el cliente o supervisor."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Asignación
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Técnico responsable
                </label>
                <select
                  value={form.tecnico_responsable_id}
                  onChange={(e) =>
                    handleChange('tecnico_responsable_id', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">Sin asignar</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Supervisor
                </label>
                <select
                  value={form.supervisor_id}
                  onChange={(e) => handleChange('supervisor_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">Sin asignar</option>
                  {supervisores.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {perfil.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {warning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {warning}
            </div>
          ) : null}

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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Creando OT...' : 'Crear OT'}
            </button>

            <Link
              href="/ot"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

export default function NuevaOTPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <NuevaOTContent />
    </ProtectedModuleRoute>
  )
}