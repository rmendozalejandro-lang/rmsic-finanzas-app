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

type PerfilOption = {
  id: string
  label: string
}

type OTTecnico = {
  user_id: string
  nombre_completo: string
  cargo: string
  activo: boolean
  puede_crear_ot: boolean
  puede_cerrar_ot: boolean
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
  diagnostico: string
  causa_probable: string
  trabajo_realizado: string
  recomendaciones: string
  tecnico_responsable_id: string
  supervisor_id: string
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  requiere_checklist: boolean
  contacto_cliente_nombre: string
  contacto_cliente_cargo: string
  area_trabajo: string
  resultado_servicio: string
  hallazgos: string
  conclusiones_tecnicas: string
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: string
  observaciones_cierre: string
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

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  )
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
  const [perfiles, setPerfiles] = useState<PerfilOption[]>([])

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
    diagnostico: '',
    causa_probable: '',
    trabajo_realizado: '',
    recomendaciones: '',
    tecnico_responsable_id: '',
    supervisor_id: '',
    prioridad: 'media',
    requiere_checklist: false,
    contacto_cliente_nombre: '',
    contacto_cliente_cargo: '',
    area_trabajo: '',
    resultado_servicio: '',
    hallazgos: '',
    conclusiones_tecnicas: '',
    mostrar_nota_valor_hora: false,
    valor_hora_uf: '2.10',
    observaciones_cierre: '',
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

  const tipoCodigo = selectedTipo?.codigo ?? ''
  const isPreventiva = tipoCodigo === 'preventiva'
  const isUrgencia = tipoCodigo === 'urgencia'
  const isAsistencia = tipoCodigo === 'general'
  const isUrgenciaOAsistencia = isUrgencia || isAsistencia
  const isAsesoria = tipoCodigo === 'asesoria'

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

        const clientesResp = await supabase
          .from('clientes')
          .select('id, nombre')
          .eq('empresa_id', storedEmpresaId)
          .order('nombre', { ascending: true })

        if (clientesResp.error) {
          throw new Error(`No se pudieron cargar los clientes: ${clientesResp.error.message}`)
        }

        const tiposResp = await supabase
          .from('ot_tipos_servicio')
          .select('id, codigo, nombre')
          .eq('activo', true)
          .order('nombre', { ascending: true })

        if (tiposResp.error) {
          throw new Error(`No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`)
        }

        const estadosResp = await supabase
          .from('ot_estados')
          .select('id, codigo, nombre, orden')
          .eq('activo', true)
          .order('orden', { ascending: true })

        if (estadosResp.error) {
          throw new Error(`No se pudieron cargar los estados: ${estadosResp.error.message}`)
        }

        const [tecnicosResp, authResp] = await Promise.all([
          supabase
            .from('ot_tecnicos')
            .select(
              'user_id, nombre_completo, cargo, activo, puede_crear_ot, puede_cerrar_ot'
            )
            .eq('activo', true)
            .order('nombre_completo', { ascending: true }),
          supabase.auth.getUser(),
        ])

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

        let perfilesData: PerfilOption[] = []
        let nextWarning = ''

        if (tecnicosResp.error) {
          nextWarning =
            'No se pudieron cargar los técnicos OT. Puedes crear la OT igual, pero sin asignar técnico o supervisor por ahora.'
        } else {
          const tecnicosRaw = (tecnicosResp.data ?? []) as OTTecnico[]
          perfilesData = tecnicosRaw.map((item) => ({
            id: item.user_id,
            label: `${item.nombre_completo} - ${item.cargo}`,
          }))
        }

        const currentUserId = authResp.data.user?.id || ''

        if (!active) return

        setClientes(clientesData)
        setTiposServicio(tiposData)
        setEstados(estadosData)
        setPerfiles(perfilesData)
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
          tecnico_responsable_id: prev.tecnico_responsable_id || currentUserId,
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

    if (isUrgenciaOAsistencia && form.mostrar_nota_valor_hora) {
      const valor = Number(form.valor_hora_uf)
      if (Number.isNaN(valor) || valor <= 0) {
        return 'Debes ingresar un valor hora UF válido.'
      }
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
        problema_reportado:
          isUrgenciaOAsistencia || isAsesoria
            ? form.problema_reportado.trim() || null
            : null,
        diagnostico:
          isUrgenciaOAsistencia || isAsesoria
            ? form.diagnostico.trim() || null
            : null,
        causa_probable: isUrgenciaOAsistencia ? form.causa_probable.trim() || null : null,
        trabajo_realizado:
          isPreventiva || isUrgenciaOAsistencia
            ? form.trabajo_realizado.trim() || null
            : null,
        recomendaciones: form.recomendaciones.trim() || null,
        tecnico_responsable_id: form.tecnico_responsable_id || null,
        supervisor_id: form.supervisor_id || null,
        prioridad: form.prioridad,
        requiere_checklist: form.requiere_checklist,
        contacto_cliente_nombre: form.contacto_cliente_nombre.trim() || null,
        contacto_cliente_cargo: form.contacto_cliente_cargo.trim() || null,
        area_trabajo: form.area_trabajo.trim() || null,
        resultado_servicio:
          isPreventiva || isUrgenciaOAsistencia
            ? form.resultado_servicio.trim() || null
            : null,
        hallazgos: isPreventiva ? form.hallazgos.trim() || null : null,
        conclusiones_tecnicas: isAsesoria ? form.conclusiones_tecnicas.trim() || null : null,
        mostrar_nota_valor_hora: isUrgenciaOAsistencia
          ? form.mostrar_nota_valor_hora
          : false,
        valor_hora_uf:
          isUrgenciaOAsistencia && form.mostrar_nota_valor_hora
            ? Number(form.valor_hora_uf)
            : 2.1,
        observaciones_cierre: form.observaciones_cierre.trim() || null,
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
            <SectionTitle title="Datos generales" />

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

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Contacto cliente
                </label>
                <input
                  type="text"
                  value={form.contacto_cliente_nombre}
                  onChange={(e) =>
                    handleChange('contacto_cliente_nombre', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Cargo contacto
                </label>
                <input
                  type="text"
                  value={form.contacto_cliente_cargo}
                  onChange={(e) =>
                    handleChange('contacto_cliente_cargo', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Área / sector de trabajo
                </label>
                <input
                  type="text"
                  value={form.area_trabajo}
                  onChange={(e) => handleChange('area_trabajo', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
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

          {isPreventiva ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle
                title="Información técnica"
                subtitle="Estructura para mantenimiento preventivo."
              />

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={(e) => handleChange('titulo', e.target.value)}
                    placeholder="Ejemplo: Mantenimiento preventivo sistema de bombeo"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Objetivo del mantenimiento
                  </label>
                  <textarea
                    value={form.descripcion_solicitud}
                    onChange={(e) =>
                      handleChange('descripcion_solicitud', e.target.value)
                    }
                    rows={4}
                    placeholder="Describe el objetivo general del mantenimiento."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Actividades ejecutadas
                  </label>
                  <textarea
                    value={form.trabajo_realizado}
                    onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                    rows={4}
                    placeholder="Describe las actividades preventivas ejecutadas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Hallazgos detectados
                  </label>
                  <textarea
                    value={form.hallazgos}
                    onChange={(e) => handleChange('hallazgos', e.target.value)}
                    rows={4}
                    placeholder="Registra hallazgos observados durante la revisión."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Resultado del servicio
                  </label>
                  <textarea
                    value={form.resultado_servicio}
                    onChange={(e) =>
                      handleChange('resultado_servicio', e.target.value)
                    }
                    rows={4}
                    placeholder="Indica el resultado final del mantenimiento."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Recomendaciones
                  </label>
                  <textarea
                    value={form.recomendaciones}
                    onChange={(e) => handleChange('recomendaciones', e.target.value)}
                    rows={4}
                    placeholder="Indica recomendaciones preventivas o acciones sugeridas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {isUrgenciaOAsistencia ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle
                title="Información técnica"
                subtitle="Estructura para urgencia o asistencia técnica."
              />

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={(e) => handleChange('titulo', e.target.value)}
                    placeholder="Ejemplo: Falla de bomba de producto"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Solicitud del cliente
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

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Diagnóstico
                  </label>
                  <textarea
                    value={form.diagnostico}
                    onChange={(e) => handleChange('diagnostico', e.target.value)}
                    rows={4}
                    placeholder="Describe el diagnóstico preliminar."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Causa probable
                  </label>
                  <textarea
                    value={form.causa_probable}
                    onChange={(e) => handleChange('causa_probable', e.target.value)}
                    rows={4}
                    placeholder="Indica la causa probable del problema."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Solución implementada
                  </label>
                  <textarea
                    value={form.trabajo_realizado}
                    onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                    rows={4}
                    placeholder="Describe la solución o labores realizadas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Resultado del servicio
                  </label>
                  <textarea
                    value={form.resultado_servicio}
                    onChange={(e) =>
                      handleChange('resultado_servicio', e.target.value)
                    }
                    rows={4}
                    placeholder="Indica el estado final luego de la intervención."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Recomendaciones
                  </label>
                  <textarea
                    value={form.recomendaciones}
                    onChange={(e) => handleChange('recomendaciones', e.target.value)}
                    rows={4}
                    placeholder="Ingresa recomendaciones técnicas o comerciales."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.mostrar_nota_valor_hora}
                    onChange={(e) =>
                      handleChange('mostrar_nota_valor_hora', e.target.checked)
                    }
                  />
                  Mostrar nota informativa de valor por hora
                </label>

                {form.mostrar_nota_valor_hora ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Valor hora UF
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.valor_hora_uf}
                        onChange={(e) => handleChange('valor_hora_uf', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                      />
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Esta nota quedará disponible para el PDF cliente solo cuando la actives.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {isAsesoria ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle
                title="Información técnica"
                subtitle="Estructura para consultoría o asesoría técnica."
              />

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={(e) => handleChange('titulo', e.target.value)}
                    placeholder="Ejemplo: Evaluación técnica de sistema"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Objetivo de la asesoría
                  </label>
                  <textarea
                    value={form.descripcion_solicitud}
                    onChange={(e) =>
                      handleChange('descripcion_solicitud', e.target.value)
                    }
                    rows={4}
                    placeholder="Describe el objetivo de la visita o consultoría."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Antecedentes observados
                  </label>
                  <textarea
                    value={form.problema_reportado}
                    onChange={(e) =>
                      handleChange('problema_reportado', e.target.value)
                    }
                    rows={4}
                    placeholder="Describe antecedentes relevantes observados en terreno o entregados por el cliente."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Análisis técnico
                  </label>
                  <textarea
                    value={form.diagnostico}
                    onChange={(e) => handleChange('diagnostico', e.target.value)}
                    rows={5}
                    placeholder="Describe el análisis técnico realizado."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Conclusiones técnicas
                  </label>
                  <textarea
                    value={form.conclusiones_tecnicas}
                    onChange={(e) =>
                      handleChange('conclusiones_tecnicas', e.target.value)
                    }
                    rows={4}
                    placeholder="Resume conclusiones técnicas de la asesoría."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Recomendaciones
                  </label>
                  <textarea
                    value={form.recomendaciones}
                    onChange={(e) => handleChange('recomendaciones', e.target.value)}
                    rows={4}
                    placeholder="Indica recomendaciones técnicas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {!isPreventiva && !isUrgenciaOAsistencia && !isAsesoria ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle
                title="Información técnica"
                subtitle="Modo general de respaldo."
              />

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
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle title="Asignación" />

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
                  {perfiles.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {perfil.label}
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
                  {perfiles.map((perfil) => (
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