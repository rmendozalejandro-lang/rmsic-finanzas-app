'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedModuleRoute from '../../../../components/ProtectedModuleRoute'
import ClienteQuickCreateModal, {
  type ClienteQuickCreated,
} from '../../../../components/maestros/ClienteQuickCreateModal'
import { supabase } from '../../../../lib/supabase/client'

type ClienteOption = {
  id: string
  nombre: string
}

type ClienteContactoOption = {
  id: string
  cliente_id: string
  nombre: string
  cargo: string | null
  area: string | null
  linea: string | null
  email: string | null
  telefono: string | null
  tipo_contacto: string | null
  recibe_informes_ot: boolean | null
}

type EquipoOption = {
  id: string
  cliente_id: string | null
  tag: string
  nombre: string | null
  descripcion: string | null
  tipo_equipo: string | null
  planta: string | null
  area: string | null
  linea: string | null
  ubicacion: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  potencia: string | null
  estado: string | null
  activo: boolean | null
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

type PlantillaOption = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  vista_principal: string
  ruta_principal: string
  ruta_base: string
  ruta_pdf: string | null
  requiere_equipo: boolean
  usa_checklist: boolean
  checklist_plantilla_codigo: string | null
  informe_codigo: string | null
  es_predeterminada: boolean
}

type SelectOption = {
  id: string
  label: string
}

type PerfilRow = {
  id: string
  nombre_completo: string | null
  email: string | null
}

type UsuarioEmpresaRow = {
  usuario_id: string
  rol: string | null
  activo: boolean | null
}


type OtTecnicoRow = {
  id: string
  usuario_id: string | null
  nombre_completo: string | null
  cargo: string | null
  activo: boolean | null
  puede_crear_ot: boolean | null
  puede_cerrar_ot: boolean | null
}

type FormDataState = {
  empresa_id: string
  cliente_id: string
  equipo_id: string
  plantilla_id: string
  tipo_servicio_id: string
  estado_id: string
  fecha_ot: string
  fecha_programada: string
  titulo: string
  descripcion_solicitud: string
  problema_reportado: string
  numero_om_cliente: string
  hora_inicio: string
  hora_termino: string
  cantidad_tecnicos: string
  horas_hombre_utilizadas: string
  contacto_cliente_id: string
  contacto_cliente_email: string
  contacto_cliente_nombre: string
  contacto_cliente_cargo: string
  responsable_cliente_rut: string
  area_trabajo: string
  supervisor_contratista_nombre: string
  supervisor_contratista_rut: string
  supervisor_contratista_cargo: string
  herramientas_materiales_utilizados: string
  recomendaciones_seguridad: string
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

function dateAndTimeToISOString(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null

  const date = new Date(`${dateValue}T${timeValue}`)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function parsePositiveNumber(value: string) {
  if (!value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
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
  const [contactosCliente, setContactosCliente] = useState<ClienteContactoOption[]>([])
  const [showClienteModal, setShowClienteModal] = useState(false)
  const [equipos, setEquipos] = useState<EquipoOption[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicioOption[]>([])
  const [estados, setEstados] = useState<EstadoOption[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([])
  const [tecnicos, setTecnicos] = useState<SelectOption[]>([])
  const [supervisores, setSupervisores] = useState<SelectOption[]>([])

  const [form, setForm] = useState<FormDataState>({
    empresa_id: '',
    cliente_id: '',
    equipo_id: '',
    plantilla_id: '',
    tipo_servicio_id: '',
    estado_id: '',
    fecha_ot: todayLocalDate(),
    fecha_programada: '',
    titulo: '',
    descripcion_solicitud: '',
    problema_reportado: '',
    numero_om_cliente: '',
    hora_inicio: '',
    hora_termino: '',
    cantidad_tecnicos: '',
    horas_hombre_utilizadas: '',
    contacto_cliente_id: '',
    contacto_cliente_email: '',
    contacto_cliente_nombre: '',
    contacto_cliente_cargo: '',
    responsable_cliente_rut: '',
    area_trabajo: '',
    supervisor_contratista_nombre: '',
    supervisor_contratista_rut: '',
    supervisor_contratista_cargo: '',
    herramientas_materiales_utilizados: '',
    recomendaciones_seguridad: '',
    tecnico_responsable_id: '',
    supervisor_id: '',
    prioridad: 'media',
    requiere_checklist: false,
  })

  const estadoAsignadaId = useMemo(() => {
    return estados.find((item) => item.codigo === 'asignada')?.id ?? ''
  }, [estados])

  const selectedPlantilla = useMemo(() => {
    return plantillas.find((item) => item.id === form.plantilla_id) ?? null
  }, [plantillas, form.plantilla_id])

  const selectedTipo = useMemo(() => {
    return tiposServicio.find((item) => item.id === form.tipo_servicio_id) ?? null
  }, [tiposServicio, form.tipo_servicio_id])

  const equiposCliente = useMemo(() => {
    if (!form.cliente_id) return equipos

    return equipos.filter((item) => !item.cliente_id || item.cliente_id === form.cliente_id)
  }, [equipos, form.cliente_id])

  const selectedEquipo = useMemo(() => {
    return equipos.find((item) => item.id === form.equipo_id) ?? null
  }, [equipos, form.equipo_id])

  const contactosDelCliente = useMemo(() => {
    if (!form.cliente_id) return []

    return contactosCliente.filter((item) => item.cliente_id === form.cliente_id)
  }, [contactosCliente, form.cliente_id])

  const selectedContactoCliente = useMemo(() => {
    return contactosCliente.find((item) => item.id === form.contacto_cliente_id) ?? null
  }, [contactosCliente, form.contacto_cliente_id])

  const isPreventivaMespack = selectedTipo?.codigo === 'preventiva'

  const duracionOmMinutos = null
  const horasHombreSugeridas = null

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

        const [clientesResp, contactosResp, equiposResp, tiposResp, estadosResp, plantillasResp] = await Promise.all([
          supabase
            .from('clientes')
            .select('id, nombre')
            .eq('empresa_id', storedEmpresaId)
            .order('nombre', { ascending: true }),

          supabase
            .from('cliente_contactos')
            .select('id, cliente_id, nombre, cargo, area, linea, email, telefono, tipo_contacto, recibe_informes_ot')
            .eq('empresa_id', storedEmpresaId)
            .eq('activo', true)
            .order('nombre', { ascending: true }),

          supabase
            .from('ot_vw_equipos')
            .select(
              'id, cliente_id, tag, nombre, descripcion, tipo_equipo, planta, area, linea, ubicacion, marca, modelo, serie, potencia, estado, activo'
            )
            .eq('empresa_id', storedEmpresaId)
            .is('deleted_at', null)
            .order('tag', { ascending: true }),

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
            .from('ot_plantillas')
            .select(
              'id, codigo, nombre, descripcion, vista_principal, ruta_principal, ruta_base, ruta_pdf, requiere_equipo, usa_checklist, checklist_plantilla_codigo, informe_codigo, es_predeterminada'
            )
            .eq('empresa_id', storedEmpresaId)
            .eq('activo', true)
            .order('es_predeterminada', { ascending: false })
            .order('nombre', { ascending: true }),
        ])

        const { data: usuariosEmpresaRaw, error: usuariosEmpresaError } = await supabase
          .from('usuario_empresas')
          .select('usuario_id, rol, activo')
          .eq('empresa_id', storedEmpresaId)
          .eq('activo', true)

        const { data: tecnicosRaw, error: tecnicosError } = await supabase
          .from('ot_tecnicos')
          .select('id, usuario_id, nombre_completo, cargo, activo, puede_crear_ot, puede_cerrar_ot')
          .eq('empresa_id', storedEmpresaId)
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (clientesResp.error) {
          throw new Error(`No se pudieron cargar los clientes: ${clientesResp.error.message}`)
        }

        if (contactosResp.error) {
          throw new Error(`No se pudieron cargar los contactos de clientes: ${contactosResp.error.message}`)
        }

        if (equiposResp.error) {
          throw new Error(`No se pudieron cargar los equipos: ${equiposResp.error.message}`)
        }

        if (tiposResp.error) {
          throw new Error(
            `No se pudieron cargar los tipos de servicio: ${tiposResp.error.message}`
          )
        }

        if (estadosResp.error) {
          throw new Error(`No se pudieron cargar los estados: ${estadosResp.error.message}`)
        }

        if (plantillasResp.error) {
          throw new Error(`No se pudieron cargar las plantillas OT: ${plantillasResp.error.message}`)
        }

        if (usuariosEmpresaError) {
          throw new Error(
            `No se pudieron cargar los usuarios de la empresa activa: ${usuariosEmpresaError.message}`
          )
        }

        if (tecnicosError) {
          throw new Error(`No se pudieron cargar los técnicos OT: ${tecnicosError.message}`)
        }

        const usuariosEmpresa = (usuariosEmpresaRaw ?? []) as UsuarioEmpresaRow[]
        const usuarioIds = Array.from(
          new Set(
            usuariosEmpresa
              .map((item) => item.usuario_id)
              .filter((id): id is string => Boolean(id))
          )
        )

        const perfilesResp =
          usuarioIds.length > 0
            ? await supabase
                .from('perfiles')
                .select('id, nombre_completo, email')
                .in('id', usuarioIds)
            : { data: [], error: null }

        if (perfilesResp.error) {
          throw new Error(
            `No se pudieron cargar los perfiles de la empresa activa: ${perfilesResp.error.message}`
          )
        }

        const perfilesEmpresa = ((perfilesResp.data ?? []) as PerfilRow[]).sort((a, b) =>
          buildSupervisorLabel(a).localeCompare(buildSupervisorLabel(b), 'es')
        )

        const perfilesById = perfilesEmpresa.reduce<Record<string, PerfilRow>>((acc, item) => {
          acc[item.id] = item
          return acc
        }, {})

        const tecnicosOt = ((tecnicosRaw ?? []) as OtTecnicoRow[]).filter((item) =>
          Boolean(item.usuario_id)
        )

        const buildTecnicoLabel = (tecnico: OtTecnicoRow) => {
          const perfil = tecnico.usuario_id ? perfilesById[tecnico.usuario_id] : null
          const nombre = tecnico.nombre_completo?.trim() || perfil?.nombre_completo?.trim()
          const email = perfil?.email?.trim()
          const cargo = tecnico.cargo?.trim()
          const parts = [nombre || email || 'Técnico OT']

          if (cargo) parts.push(cargo)
          if (email) parts.push(email)

          return parts.join(' - ')
        }

        const clientesData: ClienteOption[] = (clientesResp.data ?? []).map((item) => ({
          id: item.id,
          nombre: item.nombre,
        }))

        const contactosData: ClienteContactoOption[] = (contactosResp.data ?? []).map((item) => ({
          id: item.id,
          cliente_id: item.cliente_id,
          nombre: item.nombre,
          cargo: item.cargo,
          area: item.area,
          linea: item.linea,
          email: item.email,
          telefono: item.telefono,
          tipo_contacto: item.tipo_contacto,
          recibe_informes_ot: item.recibe_informes_ot,
        }))

        const equiposData: EquipoOption[] = (equiposResp.data ?? []).map((item) => ({
          id: item.id,
          cliente_id: item.cliente_id,
          tag: item.tag,
          nombre: item.nombre,
          descripcion: item.descripcion,
          tipo_equipo: item.tipo_equipo,
          planta: item.planta,
          area: item.area,
          linea: item.linea,
          ubicacion: item.ubicacion,
          marca: item.marca,
          modelo: item.modelo,
          serie: item.serie,
          potencia: item.potencia,
          estado: item.estado,
          activo: item.activo,
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

        const plantillasData: PlantillaOption[] = (plantillasResp.data ?? []).map((item) => ({
          id: item.id,
          codigo: item.codigo,
          nombre: item.nombre,
          descripcion: item.descripcion,
          vista_principal: item.vista_principal,
          ruta_principal: item.ruta_principal,
          ruta_base: item.ruta_base,
          ruta_pdf: item.ruta_pdf,
          requiere_equipo: Boolean(item.requiere_equipo),
          usa_checklist: Boolean(item.usa_checklist),
          checklist_plantilla_codigo: item.checklist_plantilla_codigo,
          informe_codigo: item.informe_codigo,
          es_predeterminada: Boolean(item.es_predeterminada),
        }))

        const tecnicosData: SelectOption[] = tecnicosOt
          .map((item) => ({
            id: item.usuario_id || '',
            label: buildTecnicoLabel(item),
          }))
          .filter((item) => Boolean(item.id))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'))

        const supervisoresData: SelectOption[] = tecnicosOt
          .filter((item) => Boolean(item.puede_cerrar_ot))
          .map((item) => ({
            id: item.usuario_id || '',
            label: buildTecnicoLabel(item),
          }))
          .filter((item) => Boolean(item.id))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'))

        const nextWarning =
          tecnicosData.length === 0
            ? 'La empresa activa no tiene técnicos OT activos. Registra técnicos antes de asignar una OT.'
            : ''

        const tecnicoActual = tecnicosData.find((item) => item.id === user.id)

        if (!active) return

        setClientes(clientesData)
        setContactosCliente(contactosData)
        setEquipos(equiposData)
        setTiposServicio(tiposData)
        setEstados(estadosData)
        setPlantillas(plantillasData)
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

        const plantillaPredeterminada =
          plantillasData.find((item) => item.es_predeterminada)?.id ??
          plantillasData[0]?.id ??
          ''

        const plantillaPredeterminadaData =
          plantillasData.find((item) => item.id === plantillaPredeterminada) ?? null

        setForm((prev) => ({
          ...prev,
          empresa_id: storedEmpresaId,
          plantilla_id: prev.plantilla_id || plantillaPredeterminada,
          tipo_servicio_id: prev.tipo_servicio_id || tipoGeneral,
          estado_id: prev.estado_id || estadoAsignada,
          tecnico_responsable_id:
            prev.tecnico_responsable_id || tecnicoActual?.id || '',
          requiere_checklist:
            prev.requiere_checklist || Boolean(plantillaPredeterminadaData?.usa_checklist),
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
    if (selectedPlantilla?.usa_checklist) {
      setForm((prev) => ({
        ...prev,
        requiere_checklist: true,
      }))
    }
  }, [selectedPlantilla?.usa_checklist])

  useEffect(() => {
    const tipoSeleccionado = tiposServicio.find(
      (item) => item.id === form.tipo_servicio_id
    )

    if (tipoSeleccionado?.codigo === 'preventiva') {
      setForm((prev) => ({
        ...prev,
        requiere_checklist: true,
      }))
      return
    }

    if (tipoSeleccionado?.codigo === 'preventiva_general') {
      setForm((prev) => ({
        ...prev,
        requiere_checklist: false,
      }))
    }
  }, [form.tipo_servicio_id, tiposServicio])

  const handleChange = <K extends keyof FormDataState>(
    field: K,
    value: FormDataState[K]
  ) => {
    if (field === 'plantilla_id') {
      const plantillaId = String(value || '')
      const plantillaSeleccionada = plantillas.find((item) => item.id === plantillaId)

      setForm((prev) => ({
        ...prev,
        plantilla_id: plantillaId,
        requiere_checklist: plantillaSeleccionada?.usa_checklist ? true : prev.requiere_checklist,
      }))

      return
    }

    if (field === 'cliente_id') {
      const clienteId = String(value || '')

      setForm((prev) => {
        const equipoSeleccionado = equipos.find((item) => item.id === prev.equipo_id)

        const equipoPerteneceCliente = Boolean(
          equipoSeleccionado &&
            (
              !clienteId ||
              !equipoSeleccionado.cliente_id ||
              equipoSeleccionado.cliente_id === clienteId
            )
        )

        return {
          ...prev,
          cliente_id: clienteId,
          equipo_id: equipoPerteneceCliente ? prev.equipo_id : '',
          contacto_cliente_id: '',
          contacto_cliente_email: '',
          contacto_cliente_nombre: '',
          contacto_cliente_cargo: '',
        }
      })

      return
    }

    if (field === 'contacto_cliente_id') {
      const contactoId = String(value || '')
      const contacto = contactosCliente.find((item) => item.id === contactoId)

      setForm((prev) => ({
        ...prev,
        contacto_cliente_id: contactoId,
        contacto_cliente_email: contacto?.email || '',
        contacto_cliente_nombre: contacto?.nombre || '',
        contacto_cliente_cargo: contacto?.cargo || '',
        area_trabajo: contacto?.area || prev.area_trabajo,
      }))

      return
    }

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const openClienteModal = () => {
    setShowClienteModal(true)
  }

  const closeClienteModal = () => {
    setShowClienteModal(false)
  }

  const handleClienteCreado = (nuevoCliente: ClienteQuickCreated) => {
    setClientes((prev) =>
      [...prev.filter((cliente) => cliente.id !== nuevoCliente.id), nuevoCliente].sort(
        (a, b) => a.nombre.localeCompare(b.nombre, 'es')
      )
    )

    setForm((prev) => ({
      ...prev,
      cliente_id: nuevoCliente.id,
      equipo_id: '',
      contacto_cliente_id: '',
      contacto_cliente_email: '',
      contacto_cliente_nombre: '',
      contacto_cliente_cargo: '',
    }))

    setSuccess(`Cliente ${nuevoCliente.nombre} creado y seleccionado para la OT.`)
    setError('')
  }

  const validateForm = () => {
    if (!form.empresa_id) {
      return 'No se detectó empresa activa.'
    }

    if (!form.cliente_id) {
      return 'Debes seleccionar un cliente.'
    }

    if (!form.plantilla_id) {
      return 'No se detectó una plantilla OT para la empresa activa.'
    }

    if (selectedPlantilla?.requiere_equipo && !form.equipo_id) {
      return `La plantilla ${selectedPlantilla.nombre} requiere seleccionar un equipo/TAG.`
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

      const requiereChecklist =
        selectedPlantilla?.usa_checklist || selectedTipo?.codigo === 'preventiva'
          ? true
          : selectedTipo?.codigo === 'preventiva_general'
            ? false
            : form.requiere_checklist

      const payload = {
        empresa_id: form.empresa_id,
        cliente_id: form.cliente_id,
        equipo_id: form.equipo_id || null,
        plantilla_id: form.plantilla_id || null,
        tipo_servicio_id: form.tipo_servicio_id,
        estado_id: form.estado_id || estadoAsignadaId,
        fecha_ot: form.fecha_ot || todayLocalDate(),
        fecha_programada: form.fecha_programada || null,
        titulo: form.titulo.trim(),
        descripcion_solicitud: form.descripcion_solicitud.trim() || null,
        problema_reportado: form.problema_reportado.trim() || null,
        numero_om_cliente: form.numero_om_cliente.trim() || null,
        hora_inicio: dateAndTimeToISOString(form.fecha_ot || todayLocalDate(), form.hora_inicio),
        hora_termino: null,
        duracion_minutos: null,
        cantidad_tecnicos: parsePositiveNumber(form.cantidad_tecnicos),
        horas_hombre_utilizadas: null,
        contacto_cliente_id: form.contacto_cliente_id || null,
        contacto_cliente_email: form.contacto_cliente_email.trim() || null,
        contacto_cliente_nombre: form.contacto_cliente_nombre.trim() || null,
        contacto_cliente_cargo: form.contacto_cliente_cargo.trim() || null,
        responsable_cliente_rut: form.responsable_cliente_rut.trim() || null,
        area_trabajo: form.area_trabajo.trim() || null,
        supervisor_contratista_nombre: form.supervisor_contratista_nombre.trim() || null,
        supervisor_contratista_rut: form.supervisor_contratista_rut.trim() || null,
        supervisor_contratista_cargo: form.supervisor_contratista_cargo.trim() || null,
        herramientas_materiales_utilizados:
          form.herramientas_materiales_utilizados.trim() || null,
        recomendaciones_seguridad: form.recomendaciones_seguridad.trim() || null,
        tecnico_responsable_id: form.tecnico_responsable_id || null,
        supervisor_id: form.supervisor_id || null,
        prioridad: form.prioridad,
        requiere_checklist: requiereChecklist,
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

      if (data?.id && selectedPlantilla?.usa_checklist) {
        if (selectedPlantilla.checklist_plantilla_codigo === 'motor_mt_post_mantencion') {
          const { error: checklistError } = await supabase.rpc(
            'ot_generar_checklist_motor_mt_ot',
            { p_ot_id: data.id }
          )

          if (checklistError) {
            console.warn('OT creada, pero no se pudo generar el checklist técnico:', checklistError.message)
          }
        }
      }

      setSuccess(`OT creada correctamente${data?.folio ? ` (${data.folio})` : ''}.`)

      if (data?.id) {
        // Después de crear la OM, volver siempre al detalle normal de la OT.
        // La vista Informe DyF / Softys queda disponible como acción desde el detalle,
        // pero no debe reemplazar el flujo de cierre, contacto, envío e historial.
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
                  Plantilla OT *
                </label>
                <select
                  value={form.plantilla_id}
                  onChange={(e) => handleChange('plantilla_id', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">
                    {plantillas.length === 0
                      ? 'Sin plantillas configuradas'
                      : 'Selecciona una plantilla'}
                  </option>
                  {plantillas.map((plantilla) => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre}
                      {plantilla.es_predeterminada ? ' - predeterminada' : ''}
                    </option>
                  ))}
                </select>
                {selectedPlantilla ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Vista principal: {selectedPlantilla.vista_principal === 'informe_softys'
                      ? 'Informe OM Softys'
                      : 'Detalle estándar'}
                    {selectedPlantilla.requiere_equipo ? ' · requiere equipo/TAG' : ''}
                    {selectedPlantilla.usa_checklist ? ' · usa checklist técnico' : ''}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Cliente / Mandante *
                  </label>
                  <button
                    type="button"
                    onClick={openClienteModal}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    + Nuevo cliente
                  </button>
                </div>
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
                <p className="mt-1 text-xs text-slate-500">
                  Puedes crear un cliente o mandante sin salir del flujo de la OT.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Equipo / TAG{selectedPlantilla?.requiere_equipo ? ' *' : ''}
                </label>
                <select
                  value={form.equipo_id}
                  onChange={(e) => handleChange('equipo_id', e.target.value)}
                  disabled={!form.cliente_id && equiposCliente.length === 0}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">
                    {equiposCliente.length === 0
                      ? 'Sin equipos registrados'
                      : 'Sin equipo asociado'}
                  </option>
                  {equiposCliente.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.tag}
                      {equipo.nombre ? ` - ${equipo.nombre}` : ''}
                      {equipo.descripcion && !equipo.nombre ? ` - ${equipo.descripcion}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedPlantilla?.requiere_equipo
                    ? 'Obligatorio para esta plantilla. Selecciona el motor, equipo o activo por TAG.'
                    : 'Opcional para plantillas estándar. Permite asociar la OT a un motor o activo por TAG.'}
                </p>
              </div>

              {selectedEquipo ? (
                <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <div className="font-semibold">
                    Equipo seleccionado: {selectedEquipo.tag}
                    {selectedEquipo.nombre ? ` - ${selectedEquipo.nombre}` : ''}
                  </div>
                  <div className="mt-1 grid gap-1 md:grid-cols-2">
                    <div>
                      <span className="font-medium">Descripción:</span>{' '}
                      {selectedEquipo.descripcion || 'Sin descripción'}
                    </div>
                    <div>
                      <span className="font-medium">Tipo:</span>{' '}
                      {selectedEquipo.tipo_equipo || 'Sin tipo'}
                    </div>
                    <div>
                      <span className="font-medium">Ubicación:</span>{' '}
                      {[selectedEquipo.planta, selectedEquipo.area, selectedEquipo.linea, selectedEquipo.ubicacion]
                        .filter(Boolean)
                        .join(' / ') || 'Sin ubicación'}
                    </div>
                    <div>
                      <span className="font-medium">Datos técnicos:</span>{' '}
                      {[selectedEquipo.marca, selectedEquipo.modelo, selectedEquipo.potencia]
                        .filter(Boolean)
                        .join(' · ') || 'Sin datos técnicos'}
                    </div>
                  </div>
                </div>
              ) : null}

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
                    disabled={isPreventivaMespack || Boolean(selectedPlantilla?.usa_checklist)}
                  />
                  Requiere checklist
                </label>
              </div>
            </div>

            {selectedPlantilla?.requiere_equipo && !form.equipo_id ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Esta plantilla requiere equipo/TAG. No podrás crear la OT hasta seleccionar uno.
              </div>
            ) : null}

            {selectedPlantilla?.usa_checklist ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Esta plantilla generará checklist técnico automáticamente al crear la OT.
              </div>
            ) : null}

            {isPreventivaMespack ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Para OT de mantención preventiva Mespack, el checklist queda marcado automáticamente.
              </div>
            ) : null}

            {tiposServicio.length === 0 || estados.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No se cargaron correctamente los catálogos de tipo de servicio o estado.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Formato OM Softys
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Datos generales del informe de OM. Esta información se registra una sola vez por orden principal.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  N° OM / N° Orden cliente
                </label>
                <input
                  type="text"
                  value={form.numero_om_cliente}
                  onChange={(e) => handleChange('numero_om_cliente', e.target.value)}
                  placeholder="Ejemplo: OM Softys 123456"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Hora inicio OM
                </label>
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => handleChange('hora_inicio', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  La fecha se toma desde la fecha OT. El término se registra al cerrar o entregar el trabajo.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Cantidad de técnicos
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.cantidad_tecnicos}
                  onChange={(e) => handleChange('cantidad_tecnicos', e.target.value)}
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
                  placeholder="Ejemplo: Línea MP1 / Conversión / Servicios industriales"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Responsable cliente / Softys
                </label>
                <select
                  value={form.contacto_cliente_id}
                  onChange={(e) => handleChange('contacto_cliente_id', e.target.value)}
                  disabled={!form.cliente_id}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
                >
                  <option value="">
                    {!form.cliente_id
                      ? 'Selecciona primero un cliente'
                      : contactosDelCliente.length === 0
                        ? 'Cliente sin contactos registrados'
                        : 'Selecciona contacto'}
                  </option>
                  {contactosDelCliente.map((contacto) => (
                    <option key={contacto.id} value={contacto.id}>
                      {contacto.nombre}{contacto.cargo ? ` - ${contacto.cargo}` : ''}{contacto.email ? ` - ${contacto.email}` : ''}
                    </option>
                  ))}
                </select>
                {selectedContactoCliente ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Se enviará el informe a: {selectedContactoCliente.email || 'sin email registrado'}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Los contactos se administran desde Clientes.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Cargo responsable cliente
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
                  RUT responsable cliente
                </label>
                <input
                  type="text"
                  value={form.responsable_cliente_rut}
                  onChange={(e) => handleChange('responsable_cliente_rut', e.target.value)}
                  placeholder="Ejemplo: 12.345.678-9"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Supervisor contratista
                </label>
                <input
                  type="text"
                  value={form.supervisor_contratista_nombre}
                  onChange={(e) => handleChange('supervisor_contratista_nombre', e.target.value)}
                  placeholder="Nombre supervisor DyF / contratista"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  RUT supervisor contratista
                </label>
                <input
                  type="text"
                  value={form.supervisor_contratista_rut}
                  onChange={(e) => handleChange('supervisor_contratista_rut', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Cargo supervisor contratista
                </label>
                <input
                  type="text"
                  value={form.supervisor_contratista_cargo}
                  onChange={(e) => handleChange('supervisor_contratista_cargo', e.target.value)}
                  placeholder="Ejemplo: Supervisor"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Herramientas y materiales utilizados
                </label>
                <textarea
                  value={form.herramientas_materiales_utilizados}
                  onChange={(e) => handleChange('herramientas_materiales_utilizados', e.target.value)}
                  rows={3}
                  placeholder="Registra herramientas, instrumentos e insumos utilizados en la OM."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recomendaciones de seguridad para la ejecución del trabajo
                </label>
                <textarea
                  value={form.recomendaciones_seguridad}
                  onChange={(e) => handleChange('recomendaciones_seguridad', e.target.value)}
                  rows={3}
                  placeholder="Indica recomendaciones o condiciones de seguridad generales de la OM."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>
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

      <ClienteQuickCreateModal
        open={showClienteModal}
        empresaId={form.empresa_id || empresaActivaId}
        title="Nuevo cliente / mandante"
        description="Crea el cliente para la empresa activa y selecciónalo automáticamente en esta OT."
        defaultEstadoComercial="cliente_activo"
        onClose={closeClienteModal}
        onCreated={handleClienteCreado}
      />
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