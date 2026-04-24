'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import { OTEvidenciasPanel } from '../../../../components/ot/ot-evidencias-panel'
import { OTFirmasPanel } from '../../../../components/ot/ot-firmas-panel'
import { supabase } from '../../../../lib/supabase/client'
import type { OTResumen } from '../../../../lib/ot/types'

type OTDetalle = {
  id: string
  folio: string | null
  empresa_id: string
  cliente_id: string
  ubicacion_id: string | null
  activo_id: string | null
  cotizacion_id: string | null
  tipo_servicio_id: string
  estado_id: string
  fecha_ot: string
  fecha_programada: string | null
  fecha_cierre: string | null
  titulo: string
  descripcion_solicitud: string | null
  problema_reportado: string | null
  diagnostico: string | null
  causa_probable: string | null
  trabajo_realizado: string | null
  recomendaciones: string | null
  tecnico_responsable_id: string | null
  supervisor_id: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  requiere_checklist: boolean
  plantilla_checklist_id: string | null
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  cliente_nombre_firma: string | null
  cliente_cargo_firma: string | null
  observaciones_cierre: string | null
  mostrar_firma_cliente: boolean
  mostrar_firma_tecnico: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  contacto_cliente_nombre: string | null
  contacto_cliente_cargo: string | null
  area_trabajo: string | null
  resultado_servicio: string | null
  hallazgos: string | null
  conclusiones_tecnicas: string | null
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: number | null
}

type EstadoOption = {
  id: string
  codigo: string
  nombre: string
  orden: number
}

type TipoServicioOption = {
  id: string
  codigo: string
  nombre: string
}

type PerfilMini = {
  id: string
  email: string | null
}

type PerfilOption = {
  id: string
  label: string
}

type TiempoTrabajo = {
  id: string
  ot_id: string
  usuario_id: string
  fecha: string
  hora_inicio: string | null
  hora_termino: string | null
  duracion_minutos: number | null
  tipo_tiempo: 'trabajo' | 'traslado' | 'espera' | 'supervision'
  observacion: string | null
  created_at: string
  updated_at: string
}

type FirmaMini = {
  id: string
  tipo_firma: 'tecnico' | 'cliente' | 'supervisor'
  fecha_firma: string
}

type FormState = {
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
  observaciones_cierre: string
  contacto_cliente_nombre: string
  contacto_cliente_cargo: string
  area_trabajo: string
  resultado_servicio: string
  hallazgos: string
  conclusiones_tecnicas: string
  mostrar_nota_valor_hora: boolean
  valor_hora_uf: string
}

type TiempoFormState = {
  usuario_id: string
  fecha: string
  hora_inicio: string
  hora_termino: string
  tipo_tiempo: 'trabajo' | 'traslado' | 'espera' | 'supervision'
  observacion: string
}

function todayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
  }).format(date)
}

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '-'

  const horas = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (horas === 0) return `${mins} min`
  if (mins === 0) return `${horas} h`

  return `${horas} h ${mins} min`
}

function labelOrDash(value: string | null | undefined) {
  if (!value || !value.trim()) return '-'
  return value
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
    'rmendozaalejandro@gmail.com': 'Raúl Mendoza',
    'raul mendoza': 'Raúl Mendoza',
    'raúl mendoza': 'Raúl Mendoza',
    'david allendes': 'David Allendes',
  }

  if (knownMap[lower]) return knownMap[lower]

  if (
    lower.includes('rmendoza') ||
    (lower.includes('raul') && lower.includes('mendoza')) ||
    (lower.includes('raúl') && lower.includes('mendoza'))
  ) {
    return 'Raúl Mendoza'
  }

  if (lower.includes('david') && lower.includes('allendes')) {
    return 'David Allendes'
  }

  if (raw.includes('@')) {
    const localPart = raw.split('@')[0]
    const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return toTitleCase(cleaned)
  }

  return raw
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

function combineDateAndTimeToISOString(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null

  const composed = new Date(`${dateValue}T${timeValue}`)
  if (Number.isNaN(composed.getTime())) return null

  return composed.toISOString()
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value ?? '-'}</p>
    </div>
  )
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

function CierreStatusItem({
  label,
  ok,
  detail,
}: {
  label: string
  ok: boolean
  detail: string
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        ok ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {ok ? 'OK' : 'Pendiente'}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{detail}</p>
    </div>
  )
}

function OTDetalleContent() {
  const params = useParams()
  const router = useRouter()

  const otId = useMemo(() => {
    const raw = params?.id
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return raw[0] ?? ''
    return ''
  }, [params])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTiempo, setSavingTiempo] = useState(false)
  const [closingOt, setClosingOt] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [warning, setWarning] = useState('')
  const [tiempoError, setTiempoError] = useState('')
  const [tiempoSuccess, setTiempoSuccess] = useState('')
  const [cierreError, setCierreError] = useState('')
  const [cierreSuccess, setCierreSuccess] = useState('')

  const [resumen, setResumen] = useState<OTResumen | null>(null)
  const [detalle, setDetalle] = useState<OTDetalle | null>(null)
  const [tiempos, setTiempos] = useState<TiempoTrabajo[]>([])
  const [firmas, setFirmas] = useState<FirmaMini[]>([])
  const [checklistResponsesCount, setChecklistResponsesCount] = useState(0)
  const [perfilesMap, setPerfilesMap] = useState<Record<string, string>>({})

  const [estados, setEstados] = useState<EstadoOption[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicioOption[]>([])
  const [perfiles, setPerfiles] = useState<PerfilOption[]>([])
  const [currentUserId, setCurrentUserId] = useState('')

  const [form, setForm] = useState<FormState>({
    tipo_servicio_id: '',
    estado_id: '',
    fecha_ot: '',
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
    observaciones_cierre: '',
    contacto_cliente_nombre: '',
    contacto_cliente_cargo: '',
    area_trabajo: '',
    resultado_servicio: '',
    hallazgos: '',
    conclusiones_tecnicas: '',
    mostrar_nota_valor_hora: false,
    valor_hora_uf: '2.10',
  })

  const [tiempoForm, setTiempoForm] = useState<TiempoFormState>({
    usuario_id: '',
    fecha: todayLocalDate(),
    hora_inicio: '',
    hora_termino: '',
    tipo_tiempo: 'trabajo',
    observacion: '',
  })

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

  const estadoCerrada = useMemo(() => {
    return estados.find((item) => item.codigo === 'cerrada') ?? null
  }, [estados])

  const isClosed = useMemo(() => {
    return resumen?.estado_nombre?.toLowerCase() === 'cerrada'
  }, [resumen])

  const totalTiempoRegistrado = useMemo(() => {
    return tiempos.reduce((acc, item) => acc + (item.duracion_minutos ?? 0), 0)
  }, [tiempos])

  const requiresChecklistForClose = useMemo(() => {
    return form.requiere_checklist || form.tipo_servicio_id === tipoPreventivaId
  }, [form.requiere_checklist, form.tipo_servicio_id, tipoPreventivaId])

  const hasTrabajoRealizado = useMemo(() => {
    if (isAsesoria) {
      return !!form.diagnostico.trim() || !!form.conclusiones_tecnicas.trim()
    }
    return !!form.trabajo_realizado.trim()
  }, [form.trabajo_realizado, form.diagnostico, form.conclusiones_tecnicas, isAsesoria])

  const hasTiempos = useMemo(() => tiempos.length > 0, [tiempos])
  const hasAnyFirma = useMemo(() => firmas.length > 0, [firmas])

  const hasFirmaTecnico = useMemo(
    () => firmas.some((item) => item.tipo_firma === 'tecnico'),
    [firmas]
  )

  const hasFirmaCliente = useMemo(
    () => firmas.some((item) => item.tipo_firma === 'cliente'),
    [firmas]
  )

  const hasChecklistResponses = useMemo(() => {
    if (!requiresChecklistForClose) return true
    return checklistResponsesCount > 0
  }, [requiresChecklistForClose, checklistResponsesCount])

  const getUserLabel = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return '-'
      return perfilesMap[userId] || userId
    },
    [perfilesMap]
  )

  const loadData = useCallback(
    async (withLoader = true) => {
      try {
        if (withLoader) {
          setLoading(true)
        }

        setError('')
        setWarning('')

        if (!otId) {
          throw new Error('No se recibió el identificador de la OT.')
        }

        const [
          resumenResp,
          detalleResp,
          estadosResp,
          tiposResp,
          tiemposResp,
          firmasResp,
          checklistResp,
          authResp,
        ] = await Promise.all([
          supabase.from('ot_vw_resumen').select('*').eq('id', otId).single(),
          supabase
            .from('ot_ordenes_trabajo')
            .select(
              `
                id,
                folio,
                empresa_id,
                cliente_id,
                ubicacion_id,
                activo_id,
                cotizacion_id,
                tipo_servicio_id,
                estado_id,
                fecha_ot,
                fecha_programada,
                fecha_cierre,
                titulo,
                descripcion_solicitud,
                problema_reportado,
                diagnostico,
                causa_probable,
                trabajo_realizado,
                recomendaciones,
                tecnico_responsable_id,
                supervisor_id,
                prioridad,
                requiere_checklist,
                plantilla_checklist_id,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                cliente_nombre_firma,
                cliente_cargo_firma,
                observaciones_cierre,
                mostrar_firma_cliente,
                mostrar_firma_tecnico,
                created_by,
                created_at,
                updated_at,
                contacto_cliente_nombre,
                contacto_cliente_cargo,
                area_trabajo,
                resultado_servicio,
                hallazgos,
                conclusiones_tecnicas,
                mostrar_nota_valor_hora,
                valor_hora_uf
              `
            )
            .eq('id', otId)
            .single(),
          supabase
            .from('ot_estados')
            .select('id, codigo, nombre, orden')
            .eq('activo', true)
            .order('orden', { ascending: true }),
          supabase
            .from('ot_tipos_servicio')
            .select('id, codigo, nombre')
            .eq('activo', true)
            .order('nombre', { ascending: true }),
          supabase
            .from('ot_tiempos_trabajo')
            .select(
              `
                id,
                ot_id,
                usuario_id,
                fecha,
                hora_inicio,
                hora_termino,
                duracion_minutos,
                tipo_tiempo,
                observacion,
                created_at,
                updated_at
              `
            )
            .eq('ot_id', otId)
            .order('created_at', { ascending: false }),
          supabase
            .from('ot_firmas')
            .select('id, tipo_firma, fecha_firma')
            .eq('ot_id', otId)
            .order('fecha_firma', { ascending: false }),
          supabase
            .from('ot_respuestas_checklist')
            .select('id')
            .eq('ot_id', otId),
          supabase.auth.getUser(),
        ])

        if (resumenResp.error) {
          throw new Error(`No se pudo cargar el resumen OT: ${resumenResp.error.message}`)
        }
        if (detalleResp.error) {
          throw new Error(`No se pudo cargar el detalle OT: ${detalleResp.error.message}`)
        }
        if (estadosResp.error) {
          throw new Error(`No se pudieron cargar los estados: ${estadosResp.error.message}`)
        }
        if (tiposResp.error) {
          throw new Error(`No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`)
        }
        if (tiemposResp.error) {
          throw new Error(`No se pudieron cargar los tiempos: ${tiemposResp.error.message}`)
        }
        if (firmasResp.error) {
          throw new Error(`No se pudieron cargar las firmas: ${firmasResp.error.message}`)
        }
        if (checklistResp.error) {
          throw new Error(`No se pudo validar checklist: ${checklistResp.error.message}`)
        }

        const resumenData = resumenResp.data as OTResumen
        const detalleData = detalleResp.data as OTDetalle
        const estadosData = (estadosResp.data ?? []) as EstadoOption[]
        const tiposData = (tiposResp.data ?? []) as TipoServicioOption[]
        const tiemposData = (tiemposResp.data ?? []) as TiempoTrabajo[]
        const firmasData = (firmasResp.data ?? []) as FirmaMini[]
        const checklistData = checklistResp.data ?? []
        const userId = authResp.data.user?.id || ''

        setCurrentUserId(userId)

        const perfilesResp = await supabase
          .from('perfiles')
          .select('id, email')
          .order('email', { ascending: true })

        let perfilesSelectData: PerfilOption[] = []
        let perfilesWarning = ''
        let nextMap: Record<string, string> = {}

        if (perfilesResp.error) {
          perfilesWarning = 'No se pudo cargar la lista de perfiles para asignación.'
        } else {
          const perfilesRaw = (perfilesResp.data ?? []) as PerfilMini[]

          perfilesSelectData = perfilesRaw.map((item) => ({
            id: item.id,
            label: humanizePerson(item.email || item.id),
          }))

          nextMap = perfilesRaw.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = humanizePerson(item.email || item.id)
            return acc
          }, {})
        }

        setResumen(resumenData)
        setDetalle(detalleData)
        setEstados(estadosData)
        setTiposServicio(tiposData)
        setTiempos(tiemposData)
        setFirmas(firmasData)
        setChecklistResponsesCount(checklistData.length)
        setPerfiles(perfilesSelectData)
        setPerfilesMap(nextMap)
        setWarning(perfilesWarning)

        setForm({
          tipo_servicio_id: detalleData.tipo_servicio_id,
          estado_id: detalleData.estado_id,
          fecha_ot: toDateInputValue(detalleData.fecha_ot),
          fecha_programada: toDateInputValue(detalleData.fecha_programada),
          titulo: detalleData.titulo || '',
          descripcion_solicitud: detalleData.descripcion_solicitud || '',
          problema_reportado: detalleData.problema_reportado || '',
          diagnostico: detalleData.diagnostico || '',
          causa_probable: detalleData.causa_probable || '',
          trabajo_realizado: detalleData.trabajo_realizado || '',
          recomendaciones: detalleData.recomendaciones || '',
          tecnico_responsable_id: detalleData.tecnico_responsable_id || '',
          supervisor_id: detalleData.supervisor_id || '',
          prioridad: detalleData.prioridad,
          requiere_checklist: detalleData.requiere_checklist,
          observaciones_cierre: detalleData.observaciones_cierre || '',
          contacto_cliente_nombre: detalleData.contacto_cliente_nombre || '',
          contacto_cliente_cargo: detalleData.contacto_cliente_cargo || '',
          area_trabajo: detalleData.area_trabajo || '',
          resultado_servicio: detalleData.resultado_servicio || '',
          hallazgos: detalleData.hallazgos || '',
          conclusiones_tecnicas: detalleData.conclusiones_tecnicas || '',
          mostrar_nota_valor_hora: detalleData.mostrar_nota_valor_hora,
          valor_hora_uf:
            detalleData.valor_hora_uf != null
              ? String(detalleData.valor_hora_uf)
              : '2.10',
        })

        setTiempoForm((prev) => ({
          usuario_id:
            prev.usuario_id ||
            detalleData.tecnico_responsable_id ||
            userId ||
            '',
          fecha: prev.fecha || toDateInputValue(detalleData.fecha_ot) || todayLocalDate(),
          hora_inicio: prev.hora_inicio,
          hora_termino: prev.hora_termino,
          tipo_tiempo: prev.tipo_tiempo || 'trabajo',
          observacion: prev.observacion || '',
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la OT.')
      } finally {
        if (withLoader) {
          setLoading(false)
        }
      }
    },
    [otId]
  )

  useEffect(() => {
    void loadData(true)
  }, [loadData])

  useEffect(() => {
    if (form.tipo_servicio_id === tipoPreventivaId) {
      setForm((prev) => ({
        ...prev,
        requiere_checklist: true,
      }))
    }
  }, [form.tipo_servicio_id, tipoPreventivaId])

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleTiempoChange = <K extends keyof TiempoFormState>(
    field: K,
    value: TiempoFormState[K]
  ) => {
    setTiempoForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = () => {
    if (!form.tipo_servicio_id) return 'Debes seleccionar un tipo de servicio.'
    if (!form.estado_id) return 'Debes seleccionar un estado.'
    if (!form.titulo.trim()) return 'Debes ingresar un título.'
    if (!form.fecha_ot) return 'Debes indicar la fecha OT.'

    if (isUrgenciaOAsistencia && form.mostrar_nota_valor_hora) {
      const valor = Number(form.valor_hora_uf)
      if (Number.isNaN(valor) || valor <= 0) {
        return 'Debes ingresar un valor hora UF válido.'
      }
    }

    return ''
  }

  const validateTiempoForm = () => {
    if (!tiempoForm.usuario_id) {
      return 'Debes seleccionar un usuario para el tiempo.'
    }

    if (!tiempoForm.fecha) {
      return 'Debes indicar la fecha del registro.'
    }

    if (!tiempoForm.hora_inicio) {
      return 'Debes indicar la hora de inicio.'
    }

    if (!tiempoForm.hora_termino) {
      return 'Debes indicar la hora de término.'
    }

    const inicio = new Date(`${tiempoForm.fecha}T${tiempoForm.hora_inicio}`)
    const termino = new Date(`${tiempoForm.fecha}T${tiempoForm.hora_termino}`)

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(termino.getTime())) {
      return 'Las horas ingresadas no son válidas.'
    }

    if (termino <= inicio) {
      return 'La hora de término debe ser mayor que la hora de inicio.'
    }

    return ''
  }

  const handleSave = async (e: React.FormEvent) => {
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
        tipo_servicio_id: form.tipo_servicio_id,
        estado_id: form.estado_id,
        fecha_ot: form.fecha_ot,
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
        causa_probable: isUrgenciaOAsistencia
          ? form.causa_probable.trim() || null
          : null,
        trabajo_realizado:
          isPreventiva || isUrgenciaOAsistencia
            ? form.trabajo_realizado.trim() || null
            : null,
        recomendaciones: form.recomendaciones.trim() || null,
        tecnico_responsable_id: form.tecnico_responsable_id || null,
        supervisor_id: form.supervisor_id || null,
        prioridad: form.prioridad,
        requiere_checklist: form.requiere_checklist,
        observaciones_cierre: form.observaciones_cierre.trim() || null,
        contacto_cliente_nombre: form.contacto_cliente_nombre.trim() || null,
        contacto_cliente_cargo: form.contacto_cliente_cargo.trim() || null,
        area_trabajo: form.area_trabajo.trim() || null,
        resultado_servicio:
          isPreventiva || isUrgenciaOAsistencia
            ? form.resultado_servicio.trim() || null
            : null,
        hallazgos: isPreventiva ? form.hallazgos.trim() || null : null,
        conclusiones_tecnicas: isAsesoria
          ? form.conclusiones_tecnicas.trim() || null
          : null,
        mostrar_nota_valor_hora: isUrgenciaOAsistencia
          ? form.mostrar_nota_valor_hora
          : false,
        valor_hora_uf:
          isUrgenciaOAsistencia && form.mostrar_nota_valor_hora
            ? Number(form.valor_hora_uf)
            : Number(form.valor_hora_uf || '2.10'),
      }

      const { error: updateError } = await supabase
        .from('ot_ordenes_trabajo')
        .update(payload)
        .eq('id', otId)

      if (updateError) {
        throw new Error(`No se pudo guardar la OT: ${updateError.message}`)
      }

      await loadData(false)
      setSuccess('OT actualizada correctamente.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la OT.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTiempo = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateTiempoForm()
    if (validationError) {
      setTiempoError(validationError)
      return
    }

    try {
      setSavingTiempo(true)
      setTiempoError('')
      setTiempoSuccess('')

      const payload = {
        ot_id: otId,
        usuario_id: tiempoForm.usuario_id,
        fecha: tiempoForm.fecha,
        hora_inicio: combineDateAndTimeToISOString(tiempoForm.fecha, tiempoForm.hora_inicio),
        hora_termino: combineDateAndTimeToISOString(tiempoForm.fecha, tiempoForm.hora_termino),
        tipo_tiempo: tiempoForm.tipo_tiempo,
        observacion: tiempoForm.observacion.trim() || null,
      }

      const { error: insertError } = await supabase
        .from('ot_tiempos_trabajo')
        .insert(payload)

      if (insertError) {
        throw new Error(`No se pudo registrar el tiempo: ${insertError.message}`)
      }

      await loadData(false)

      setTiempoForm((prev) => ({
        usuario_id:
          prev.usuario_id ||
          form.tecnico_responsable_id ||
          currentUserId ||
          '',
        fecha: prev.fecha || todayLocalDate(),
        hora_inicio: '',
        hora_termino: '',
        tipo_tiempo: prev.tipo_tiempo,
        observacion: '',
      }))

      setTiempoSuccess('Tiempo registrado correctamente.')
      router.refresh()
    } catch (err) {
      setTiempoError(
        err instanceof Error ? err.message : 'No se pudo registrar el tiempo.'
      )
    } finally {
      setSavingTiempo(false)
    }
  }

  const handleDeleteTiempo = async (tiempoId: string) => {
    try {
      setTiempoError('')
      setTiempoSuccess('')

      const confirmar = window.confirm('¿Deseas eliminar este registro de tiempo?')
      if (!confirmar) return

      const { error } = await supabase
        .from('ot_tiempos_trabajo')
        .delete()
        .eq('id', tiempoId)

      if (error) {
        throw new Error(`No se pudo eliminar el tiempo: ${error.message}`)
      }

      await loadData(false)
      setTiempoSuccess('Tiempo eliminado correctamente.')
      router.refresh()
    } catch (err) {
      setTiempoError(
        err instanceof Error ? err.message : 'No se pudo eliminar el tiempo.'
      )
    }
  }

  const handleCerrarOT = async () => {
    try {
      setClosingOt(true)
      setCierreError('')
      setCierreSuccess('')
      setError('')
      setSuccess('')

      if (!estadoCerrada) {
        throw new Error('No se encontró el estado "cerrada" en la base.')
      }

      if (isAsesoria) {
        if (!form.diagnostico.trim() && !form.conclusiones_tecnicas.trim()) {
          throw new Error(
            'Debes completar al menos el análisis técnico o las conclusiones técnicas antes de cerrar la OT.'
          )
        }
      } else if (!form.trabajo_realizado.trim()) {
        throw new Error('Debes completar "Trabajo realizado" antes de cerrar la OT.')
      }

      const [tiemposResp, firmasResp, checklistResp] = await Promise.all([
        supabase
          .from('ot_tiempos_trabajo')
          .select('id, hora_inicio, hora_termino')
          .eq('ot_id', otId),
        supabase
          .from('ot_firmas')
          .select('id, tipo_firma')
          .eq('ot_id', otId),
        supabase
          .from('ot_respuestas_checklist')
          .select('id')
          .eq('ot_id', otId),
      ])

      if (tiemposResp.error) {
        throw new Error(`No se pudieron validar los tiempos: ${tiemposResp.error.message}`)
      }

      if (firmasResp.error) {
        throw new Error(`No se pudieron validar las firmas: ${firmasResp.error.message}`)
      }

      if (checklistResp.error) {
        throw new Error(`No se pudo validar el checklist: ${checklistResp.error.message}`)
      }

      const tiemposActuales = tiemposResp.data ?? []
      const firmasActuales = firmasResp.data ?? []
      const checklistActual = checklistResp.data ?? []

      if (tiemposActuales.length === 0) {
        throw new Error('Debes registrar al menos un bloque de tiempo antes de cerrar la OT.')
      }

      const tiemposValidos = tiemposActuales.filter(
        (item) => item.hora_inicio && item.hora_termino
      )

      if (tiemposValidos.length === 0) {
        throw new Error('Los tiempos registrados no tienen hora de inicio y término válidas.')
      }

      if (firmasActuales.length === 0) {
        throw new Error('Debes guardar al menos una firma antes de cerrar la OT.')
      }

      if (requiresChecklistForClose && checklistActual.length === 0) {
        throw new Error('Esta OT requiere checklist y aún no tiene respuestas registradas.')
      }

      const orderedStarts = tiemposValidos
        .map((item) => item.hora_inicio as string)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

      const orderedEnds = tiemposValidos
        .map((item) => item.hora_termino as string)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

      const horaInicio = orderedStarts[0]
      const horaTermino = orderedEnds[orderedEnds.length - 1]

      const payload = {
        estado_id: estadoCerrada.id,
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
        observaciones_cierre: form.observaciones_cierre.trim() || null,
        resultado_servicio:
          isPreventiva || isUrgenciaOAsistencia
            ? form.resultado_servicio.trim() || null
            : null,
        hallazgos: isPreventiva ? form.hallazgos.trim() || null : null,
        conclusiones_tecnicas: isAsesoria ? form.conclusiones_tecnicas.trim() || null : null,
        hora_inicio: horaInicio,
        hora_termino: horaTermino,
      }

      const { error: updateError } = await supabase
        .from('ot_ordenes_trabajo')
        .update(payload)
        .eq('id', otId)

      if (updateError) {
        throw new Error(`No se pudo cerrar la OT: ${updateError.message}`)
      }

      await loadData(false)
      setCierreSuccess('OT cerrada correctamente.')
      router.refresh()
    } catch (err) {
      setCierreError(err instanceof Error ? err.message : 'No se pudo cerrar la OT.')
    } finally {
      setClosingOt(false)
    }
  }

  const supervisorLabel = detalle?.supervisor_id
    ? getUserLabel(detalle.supervisor_id)
    : '-'

  const createdByLabel = detalle?.created_by
    ? getUserLabel(detalle.created_by)
    : '-'

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        Cargando detalle de la OT...
      </div>
    )
  }

  if (error && !detalle && !resumen) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>

        <Link
          href="/ot"
          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a OT
        </Link>
      </div>
    )
  }

  if (!detalle || !resumen) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          No se encontró la orden de trabajo.
        </div>

        <Link
          href="/ot"
          className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver a OT
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {resumen.folio || 'Sin folio'}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {detalle.titulo}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Cliente:{' '}
              <span className="font-medium text-slate-700">
                {labelOrDash(resumen.cliente_nombre)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/ot/${otId}/firma`}
              className="inline-flex rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Abrir vista cliente / firma
            </Link>

            <Link
              href={`/ot/${otId}/pdf`}
              style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
              className="inline-flex rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90]"
            >
              PDF real
            </Link>

            <Link
              href="/ot"
              className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Estado actual</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(resumen.estado_nombre)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Tipo de servicio</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(resumen.tipo_servicio_nombre)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Prioridad</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {labelOrDash(form.prioridad)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Duración OT (cierre)</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatDuration(detalle.duracion_minutos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Tiempo registrado</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatDuration(totalTiempoRegistrado)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Resumen general"
          subtitle="Información principal de la orden de trabajo."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Empresa" value={resumen.empresa_nombre} />
          <DetailField label="Cliente" value={resumen.cliente_nombre} />
          <DetailField label="Folio" value={detalle.folio} />
          <DetailField label="Contacto cliente" value={form.contacto_cliente_nombre} />
          <DetailField label="Cargo contacto" value={form.contacto_cliente_cargo} />
          <DetailField label="Área / sector trabajo" value={form.area_trabajo} />
          <DetailField label="Ubicación base" value={resumen.ubicacion_nombre} />
          <DetailField label="Activo base" value={resumen.activo_nombre} />
          <DetailField label="Técnico actual" value={resumen.tecnico_nombre} />
          <DetailField label="Supervisor actual" value={supervisorLabel} />
          <DetailField label="Fecha cierre" value={formatDateTime(detalle.fecha_cierre)} />
          <DetailField label="Creado por" value={createdByLabel} />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Datos base"
            subtitle="Campos comunes a cualquier tipo de servicio."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tipo de servicio *
              </label>
              <select
                value={form.tipo_servicio_id}
                onChange={(e) => handleChange('tipo_servicio_id', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">Selecciona un tipo</option>
                {tiposServicio.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Estado *
              </label>
              <select
                value={form.estado_id}
                onChange={(e) => handleChange('estado_id', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">Selecciona un estado</option>
                {estados.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha OT *
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
                Título *
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
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
                  handleChange('prioridad', e.target.value as FormState['prioridad'])
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Contacto cliente
              </label>
              <input
                type="text"
                value={form.contacto_cliente_nombre}
                onChange={(e) => handleChange('contacto_cliente_nombre', e.target.value)}
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
                onChange={(e) => handleChange('contacto_cliente_cargo', e.target.value)}
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

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-semibold text-slate-900">Asignación</h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Técnico responsable
                </label>
                <select
                  value={form.tecnico_responsable_id}
                  onChange={(e) => handleChange('tecnico_responsable_id', e.target.value)}
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

          <div className="mt-5">
            <label className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.requiere_checklist}
                onChange={(e) => handleChange('requiere_checklist', e.target.checked)}
                disabled={form.tipo_servicio_id === tipoPreventivaId}
              />
              Requiere checklist
            </label>
          </div>

          {isPreventiva ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              En mantenimiento preventivo el checklist queda marcado automáticamente.
            </div>
          ) : null}
        </div>

        {isPreventiva ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido OT: mantenimiento preventivo"
              subtitle="Estructura enfocada en control, ejecución, hallazgos y recomendaciones."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Objetivo del mantenimiento
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
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
                  rows={5}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Resultado del servicio
                </label>
                <textarea
                  value={form.resultado_servicio}
                  onChange={(e) => handleChange('resultado_servicio', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones preventivas
                </label>
                <textarea
                  value={form.recomendaciones}
                  onChange={(e) => handleChange('recomendaciones', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>
        ) : null}

        {isUrgenciaOAsistencia ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido OT: urgencia / asistencia técnica"
              subtitle="Estructura correctiva y operativa para atención inmediata o soporte técnico."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Solicitud del cliente
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Problema reportado
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={4}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Labores realizadas
                </label>
                <textarea
                  value={form.trabajo_realizado}
                  onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Resultado del servicio
                </label>
                <textarea
                  value={form.resultado_servicio}
                  onChange={(e) => handleChange('resultado_servicio', e.target.value)}
                  rows={4}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.mostrar_nota_valor_hora}
                  onChange={(e) => handleChange('mostrar_nota_valor_hora', e.target.checked)}
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
              title="Contenido OT: consultoría / asesoría técnica"
              subtitle="Estructura enfocada en análisis, conclusiones y recomendaciones."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Objetivo de la asesoría
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Antecedentes observados
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={4}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Conclusiones técnicas
                </label>
                <textarea
                  value={form.conclusiones_tecnicas}
                  onChange={(e) => handleChange('conclusiones_tecnicas', e.target.value)}
                  rows={4}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>
        ) : null}

        {!isPreventiva && !isUrgenciaOAsistencia && !isAsesoria ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Contenido general"
              subtitle="Modo de respaldo para tipos no clasificados todavía."
            />

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Descripción de la solicitud
                </label>
                <textarea
                  value={form.descripcion_solicitud}
                  onChange={(e) => handleChange('descripcion_solicitud', e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Problema reportado
                </label>
                <textarea
                  value={form.problema_reportado}
                  onChange={(e) => handleChange('problema_reportado', e.target.value)}
                  rows={4}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Trabajo realizado
                </label>
                <textarea
                  value={form.trabajo_realizado}
                  onChange={(e) => handleChange('trabajo_realizado', e.target.value)}
                  rows={5}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Observaciones de cierre"
            subtitle="Campo complementario para dejar observaciones finales."
          />

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observaciones de cierre
            </label>
            <textarea
              value={form.observaciones_cierre}
              onChange={(e) => handleChange('observaciones_cierre', e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
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
            {saving ? 'Guardando cambios...' : 'Guardar cambios'}
          </button>

          <Link
            href="/ot"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver a OT
          </Link>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Registrar tiempo de trabajo"
          subtitle="Agrega bloques de tiempo para trabajo, traslado, espera o supervisión."
        />

        <form onSubmit={handleAddTiempo} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Usuario *
              </label>
              <select
                value={tiempoForm.usuario_id}
                onChange={(e) => handleTiempoChange('usuario_id', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">Selecciona un usuario</option>
                {perfiles.map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha *
              </label>
              <input
                type="date"
                value={tiempoForm.fecha}
                onChange={(e) => handleTiempoChange('fecha', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tipo de tiempo
              </label>
              <select
                value={tiempoForm.tipo_tiempo}
                onChange={(e) =>
                  handleTiempoChange(
                    'tipo_tiempo',
                    e.target.value as TiempoFormState['tipo_tiempo']
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="trabajo">Trabajo</option>
                <option value="traslado">Traslado</option>
                <option value="espera">Espera</option>
                <option value="supervision">Supervisión</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Hora inicio *
              </label>
              <input
                type="time"
                value={tiempoForm.hora_inicio}
                onChange={(e) => handleTiempoChange('hora_inicio', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Hora término *
              </label>
              <input
                type="time"
                value={tiempoForm.hora_termino}
                onChange={(e) => handleTiempoChange('hora_termino', e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observación
            </label>
            <textarea
              value={tiempoForm.observacion}
              onChange={(e) => handleTiempoChange('observacion', e.target.value)}
              rows={3}
              placeholder="Ejemplo: intervención en tablero principal, visita en terreno, traslado a planta, etc."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>

          {tiempoError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {tiempoError}
            </div>
          ) : null}

          {tiempoSuccess ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {tiempoSuccess}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={savingTiempo}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingTiempo ? 'Registrando tiempo...' : 'Agregar tiempo'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Tiempos registrados"
          subtitle="Historial de bloques de tiempo asociados a esta OT."
        />

        {tiempos.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Aún no hay tiempos registrados para esta OT.
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Inicio</th>
                    <th className="px-4 py-3 font-semibold">Término</th>
                    <th className="px-4 py-3 font-semibold">Duración</th>
                    <th className="px-4 py-3 font-semibold">Observación</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiempos.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 text-slate-700"
                    >
                      <td className="px-4 py-3">{formatDate(item.fecha)}</td>
                      <td className="px-4 py-3">{getUserLabel(item.usuario_id)}</td>
                      <td className="px-4 py-3">
                        {item.tipo_tiempo.charAt(0).toUpperCase() + item.tipo_tiempo.slice(1)}
                      </td>
                      <td className="px-4 py-3">{formatDateTime(item.hora_inicio)}</td>
                      <td className="px-4 py-3">{formatDateTime(item.hora_termino)}</td>
                      <td className="px-4 py-3">{formatDuration(item.duracion_minutos)}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-[360px] whitespace-pre-wrap">
                          {labelOrDash(item.observacion)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDeleteTiempo(item.id)}
                          className="inline-flex rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <OTEvidenciasPanel
        otId={otId}
        empresaId={detalle.empresa_id}
        currentUserId={currentUserId}
      />

      <OTFirmasPanel
        otId={otId}
        empresaId={detalle.empresa_id}
        currentUserId={currentUserId}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle
          title="Cierre OT guiado"
          subtitle="Valida lo mínimo necesario antes de cerrar la orden."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CierreStatusItem
            label="Contenido principal"
            ok={hasTrabajoRealizado}
            detail={
              isAsesoria
                ? hasTrabajoRealizado
                  ? 'El análisis técnico o las conclusiones ya están completas.'
                  : 'Debes completar el análisis técnico o las conclusiones antes de cerrar.'
                : hasTrabajoRealizado
                  ? 'El campo principal de ejecución ya está completo.'
                  : 'Debes completar el campo principal de ejecución antes de cerrar.'
            }
          />

          <CierreStatusItem
            label="Tiempos registrados"
            ok={hasTiempos}
            detail={
              hasTiempos
                ? `Hay ${tiempos.length} registro(s) de tiempo en la OT.`
                : 'Debes registrar al menos un bloque de tiempo.'
            }
          />

          <CierreStatusItem
            label="Firmas"
            ok={hasAnyFirma}
            detail={
              hasAnyFirma
                ? `Firmas guardadas: ${firmas.length}. Técnico: ${hasFirmaTecnico ? 'sí' : 'no'}. Cliente: ${hasFirmaCliente ? 'sí' : 'no'}.`
                : 'Debes guardar al menos una firma antes de cerrar.'
            }
          />

          <CierreStatusItem
            label="Checklist"
            ok={hasChecklistResponses}
            detail={
              requiresChecklistForClose
                ? hasChecklistResponses
                  ? `Checklist respondido: ${checklistResponsesCount} registro(s).`
                  : 'Esta OT requiere checklist y aún no tiene respuestas.'
                : 'Esta OT no exige checklist para cierre.'
            }
          />

          <CierreStatusItem
            label="Estado actual"
            ok={isClosed}
            detail={
              isClosed
                ? 'La OT ya se encuentra cerrada.'
                : 'La OT aún no está cerrada.'
            }
          />
        </div>

        {cierreError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cierreError}
          </div>
        ) : null}

        {cierreSuccess ? (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {cierreSuccess}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadData(false)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Actualizar validación
          </button>

          <button
            type="button"
            onClick={handleCerrarOT}
            disabled={closingOt || isClosed}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isClosed
              ? 'OT ya cerrada'
              : closingOt
                ? 'Cerrando OT...'
                : 'Cerrar OT'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OTDetallePage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <OTDetalleContent />
    </ProtectedModuleRoute>
  )
}