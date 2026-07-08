'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase/client'
import { buttonPrimary, buttonSmall } from '../../../../../lib/styles/buttons'

const RMSIC_EMPRESA_ID = '557a054c-71ef-4c5f-8637-594755ad669b'
const STORAGE_ID_KEY = 'empresa_activa_id'

const RESPONSABLE_DEFAULT = {
  nombre: 'Raúl Mendoza Céledon',
  cargo: 'Ingeniero de Proyecto / Magíster en Ingeniería Industrial',
  email: '',
  telefono: '',
}

type Cliente = {
  id: string
  nombre: string | null
  rut: string | null
  activo: boolean | null
}

type Informe = {
  id: string
  empresa_id: string
  cliente_id: string
  codigo: string
  titulo: string
  tipo_informe: string
  subtipo_informe: string | null
  estado: string
  fecha_informe: string
  version: string
  area_ubicacion: string | null
  equipo_tag: string | null
  resumen_ejecutivo: string | null
  antecedentes: string | null
  objetivo: string | null
  alcance: string | null
  metodologia: string | null
  desarrollo: string | null
  analisis_tecnico: string | null
  conclusiones: string | null
  responsable_nombre: string | null
  responsable_cargo: string | null
  responsable_email: string | null
  responsable_telefono: string | null
  destinatario_nombre: string | null
  destinatario_cargo: string | null
  destinatario_email: string | null
  destinatario_area: string | null
}

const tiposInforme = [
  { value: 'levantamiento_tecnico', label: 'Levantamiento técnico' },
  { value: 'mediciones', label: 'Informe de mediciones' },
  { value: 'mantenimiento', label: 'Informe de mantenimiento' },
  { value: 'falla', label: 'Informe de falla' },
  { value: 'consultoria', label: 'Informe de consultoría' },
  { value: 'avance', label: 'Informe de avance' },
  { value: 'inspeccion', label: 'Informe de inspección' },
  { value: 'mejora_propuesta', label: 'Informe de mejora propuesta' },
]

export default function EditarInformePage() {
  const params = useParams()
  const router = useRouter()
  const informeId = String(params.id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [informe, setInforme] = useState<Informe | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [aiSectionLoading, setAiSectionLoading] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [tipoInforme, setTipoInforme] = useState('levantamiento_tecnico')
  const [subtipoInforme, setSubtipoInforme] = useState('')
  const [fechaInforme, setFechaInforme] = useState('')
  const [areaUbicacion, setAreaUbicacion] = useState('')
  const [equipoTag, setEquipoTag] = useState('')

  const [destinatarioNombre, setDestinatarioNombre] = useState('')
  const [destinatarioCargo, setDestinatarioCargo] = useState('')
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [destinatarioArea, setDestinatarioArea] = useState('')

  const [responsableNombre, setResponsableNombre] = useState(RESPONSABLE_DEFAULT.nombre)
  const [responsableCargo, setResponsableCargo] = useState(RESPONSABLE_DEFAULT.cargo)
  const [responsableEmail, setResponsableEmail] = useState(RESPONSABLE_DEFAULT.email)
  const [responsableTelefono, setResponsableTelefono] = useState(RESPONSABLE_DEFAULT.telefono)

  const [resumenEjecutivo, setResumenEjecutivo] = useState('')
  const [antecedentes, setAntecedentes] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [alcance, setAlcance] = useState('')
  const [metodologia, setMetodologia] = useState('')
  const [desarrollo, setDesarrollo] = useState('')
  const [analisisTecnico, setAnalisisTecnico] = useState('')
  const [conclusiones, setConclusiones] = useState('')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
        setEmpresaActivaId(empresaId)

        if (empresaId !== RMSIC_EMPRESA_ID) {
          setLoading(false)
          return
        }

        const { data: informeData, error: informeError } = await supabase
          .from('informes_tecnicos')
          .select('*')
          .eq('id', informeId)
          .eq('empresa_id', empresaId)
          .single()

        if (informeError) {
          console.error('Error cargando informe:', informeError.message)
          setErrorMessage(informeError.message)
          setLoading(false)
          return
        }

        const informeCargado = informeData as Informe
        setInforme(informeCargado)

        setClienteId(informeCargado.cliente_id)
        setTitulo(informeCargado.titulo || '')
        setTipoInforme(informeCargado.tipo_informe || 'levantamiento_tecnico')
        setSubtipoInforme(informeCargado.subtipo_informe || '')
        setFechaInforme(informeCargado.fecha_informe || new Date().toISOString().slice(0, 10))
        setAreaUbicacion(informeCargado.area_ubicacion || '')
        setEquipoTag(informeCargado.equipo_tag || '')

        setDestinatarioNombre(informeCargado.destinatario_nombre || '')
        setDestinatarioCargo(informeCargado.destinatario_cargo || '')
        setDestinatarioEmail(informeCargado.destinatario_email || '')
        setDestinatarioArea(informeCargado.destinatario_area || '')

        setResponsableNombre(informeCargado.responsable_nombre || RESPONSABLE_DEFAULT.nombre)
        setResponsableCargo(informeCargado.responsable_cargo || RESPONSABLE_DEFAULT.cargo)
        setResponsableEmail(informeCargado.responsable_email || RESPONSABLE_DEFAULT.email)
        setResponsableTelefono(informeCargado.responsable_telefono || RESPONSABLE_DEFAULT.telefono)

        setResumenEjecutivo(informeCargado.resumen_ejecutivo || '')
        setAntecedentes(informeCargado.antecedentes || '')
        setObjetivo(informeCargado.objetivo || '')
        setAlcance(informeCargado.alcance || '')
        setMetodologia(informeCargado.metodologia || '')
        setDesarrollo(informeCargado.desarrollo || '')
        setAnalisisTecnico(informeCargado.analisis_tecnico || '')
        setConclusiones(informeCargado.conclusiones || '')

        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nombre, rut, activo')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .order('nombre', { ascending: true })

        if (clientesError) {
          console.error('Error cargando clientes:', clientesError.message)
          setErrorMessage(clientesError.message)
          setClientes([])
          return
        }

        setClientes((clientesData ?? []) as Cliente[])
      } catch (error) {
        console.error('Error inesperado cargando edición:', error)
        setErrorMessage('No se pudo cargar el informe técnico.')
      } finally {
        setLoading(false)
      }
    }

    void cargarDatos()
  }, [informeId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (empresaActivaId !== RMSIC_EMPRESA_ID) {
      setErrorMessage('El módulo está habilitado solo para RMSIC.')
      return
    }

    if (!informe) {
      setErrorMessage('No se encontró el informe.')
      return
    }

    if (informe.estado !== 'borrador') {
      setErrorMessage('Solo se pueden editar informes en estado borrador.')
      return
    }

    if (!clienteId) {
      setErrorMessage('Debes seleccionar un cliente.')
      return
    }

    if (!titulo.trim()) {
      setErrorMessage('Debes ingresar un título para el informe.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('informes_tecnicos')
        .update({
          cliente_id: clienteId,
          titulo: titulo.trim(),
          tipo_informe: tipoInforme,
          subtipo_informe: subtipoInforme.trim() || null,
          fecha_informe: fechaInforme,

          area_ubicacion: areaUbicacion.trim() || null,
          equipo_tag: equipoTag.trim() || null,

          destinatario_nombre: destinatarioNombre.trim() || null,
          destinatario_cargo: destinatarioCargo.trim() || null,
          destinatario_email: destinatarioEmail.trim() || null,
          destinatario_area: destinatarioArea.trim() || null,

          responsable_nombre: responsableNombre.trim() || null,
          responsable_cargo: responsableCargo.trim() || null,
          responsable_email: responsableEmail.trim() || null,
          responsable_telefono: responsableTelefono.trim() || null,

          resumen_ejecutivo: resumenEjecutivo.trim() || null,
          antecedentes: antecedentes.trim() || null,
          objetivo: objetivo.trim() || null,
          alcance: alcance.trim() || null,
          metodologia: metodologia.trim() || null,
          desarrollo: desarrollo.trim() || null,
          analisis_tecnico: analisisTecnico.trim() || null,
          conclusiones: conclusiones.trim() || null,

          actualizado_por: user?.id ?? null,
        })
        .eq('id', informeId)
        .eq('empresa_id', empresaActivaId)

      if (error) {
        console.error('Error actualizando informe:', error.message)
        setErrorMessage(error.message)
        return
      }

      router.push(`/informes/${informeId}`)
      router.refresh()
    } catch (error) {
      console.error('Error inesperado actualizando informe:', error)
      setErrorMessage('No se pudo actualizar el informe técnico.')
    } finally {
      setSaving(false)
    }
  }


  async function mejorarSeccionConIA(
    seccion: string,
    textoActual: string,
    actualizarTexto: (texto: string) => void,
  ) {
    const textoBase = textoActual.trim()

    setErrorMessage('')

    if (!textoBase) {
      setErrorMessage('Primero escribe un texto base para que la IA lo mejore.')
      return
    }

    const clienteSeleccionado = clientes.find((cliente) => cliente.id === clienteId)
    const tipoSeleccionado = tiposInforme.find((tipo) => tipo.value === tipoInforme)

    setAiSectionLoading(seccion)

    try {
      const response = await fetch('/api/informes/ia/mejorar-seccion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seccion,
          textoActual: textoBase,
          contexto: {
            titulo,
            tipoInforme: tipoSeleccionado?.label || tipoInforme,
            cliente: clienteSeleccionado?.nombre || '',
            areaUbicacion,
            equipoTag,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const mensajeOriginal = String(data?.error || '')
        const mensajeNormalizado = mensajeOriginal.toLowerCase()

        const mensajeIA =
          mensajeNormalizado.includes('quota') ||
          mensajeNormalizado.includes('billing') ||
          mensajeNormalizado.includes('insufficient') ||
          mensajeNormalizado.includes('api key')
            ? 'IA no disponible temporalmente. Revisa la configuración, crédito o facturación API de OpenAI.'
            : data?.error || 'No fue posible mejorar la redacción con IA.'

        setErrorMessage(mensajeIA)
        return
      }

      const textoMejorado = typeof data?.texto === 'string' ? data.texto.trim() : ''

      if (!textoMejorado) {
        throw new Error('La IA no devolvió un texto mejorado.')
      }

      actualizarTexto(textoMejorado)
    } catch (error) {
      console.error('Error mejorando sección con IA:', error)
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible mejorar la redacción con IA.')
    } finally {
      setAiSectionLoading(null)
    }
  }

  function renderCampoTextoIA(
    seccion: string,
    valor: string,
    actualizarTexto: (texto: string) => void,
    rows = 4,
  ) {
    const mejorando = aiSectionLoading === seccion
    const bloqueoIA = Boolean(aiSectionLoading) || saving

    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">{seccion}</span>
          <button
            type="button"
            onClick={() => mejorarSeccionConIA(seccion, valor, actualizarTexto)}
            disabled={bloqueoIA}
            className={`${buttonSmall} h-8 px-3 text-[11px]`}
            title="Mejora la redacción sin inventar datos técnicos"
          >
            {mejorando ? 'Mejorando...' : 'Mejorar con IA'}
          </button>
        </div>

        <textarea
          value={valor}
          onChange={(event) => actualizarTexto(event.target.value)}
          rows={rows}
          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm leading-6"
        />
      </div>
    )
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando edición del informe...</p>
      </section>
    )
  }

  if (empresaActivaId !== RMSIC_EMPRESA_ID) {
    return (
      <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-amber-700">Acceso restringido</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
          Módulo en desarrollo interno
        </h1>
        <p className="mt-3 text-sm leading-6 text-amber-800">
          El módulo Informes Técnicos se encuentra habilitado inicialmente solo para RMSIC.
        </p>
        <Link
          href="/informes"
          className={`${buttonPrimary} mt-5`}
        >
          Volver
        </Link>
      </section>
    )
  }

  if (!informe) {
    return (
      <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">Informe no encontrado</p>
        <p className="mt-2 text-sm text-red-700">
          No fue posible cargar el informe solicitado.
        </p>
        <Link
          href="/informes"
          className={`${buttonPrimary} mt-5`}
        >
          Volver al listado
        </Link>
      </section>
    )
  }

  if (informe.estado !== 'borrador') {
    return (
      <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-amber-700">Edición no permitida</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
          Este informe no está en borrador
        </h1>
        <p className="mt-3 text-sm leading-6 text-amber-800">
          Solo los informes en estado borrador pueden ser modificados.
        </p>
        <Link
          href={`/informes/${informe.id}`}
          className={`${buttonPrimary} mt-5`}
        >
          Volver al informe
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          {informe.codigo} · Borrador
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Editar informe técnico
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Modifica el contenido del informe mientras se encuentre en estado borrador.
        </p>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Datos generales</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Cliente</span>
              <select
                value={clienteId}
                onChange={(event) => setClienteId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                required
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre || 'Cliente sin nombre'}
                    {cliente.rut ? ` - ${cliente.rut}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Fecha informe</span>
              <input
                type="date"
                value={fechaInforme}
                onChange={(event) => setFechaInforme(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Título del informe</span>
              <input
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Tipo de informe</span>
              <select
                value={tipoInforme}
                onChange={(event) => setTipoInforme(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {tiposInforme.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Subtipo</span>
              <input
                value={subtipoInforme}
                onChange={(event) => setSubtipoInforme(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: Factor de potencia"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Área / ubicación</span>
              <input
                value={areaUbicacion}
                onChange={(event) => setAreaUbicacion(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Equipo / TAG</span>
              <input
                value={equipoTag}
                onChange={(event) => setEquipoTag(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Destinatario del informe</h2>
          <p className="mt-1 text-sm text-slate-500">
            Contacto o área a quien será dirigido el informe técnico. No corresponde a recepción ni firma de cliente.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Dirigido a</span>
              <input
                value={destinatarioNombre}
                onChange={(event) => setDestinatarioNombre(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nombre del contacto"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Cargo</span>
              <input
                value={destinatarioCargo}
                onChange={(event) => setDestinatarioCargo(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: Jefe de mantenimiento"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Área</span>
              <input
                value={destinatarioArea}
                onChange={(event) => setDestinatarioArea(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: Mantención / Operaciones"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Correo</span>
              <input
                type="email"
                value={destinatarioEmail}
                onChange={(event) => setDestinatarioEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="contacto@cliente.cl"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Responsable técnico RMSIC</h2>
          <p className="mt-1 text-sm text-slate-500">
            Datos de emisión y validación técnica que se mostrarán al final del informe.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Responsable</span>
              <input
                value={responsableNombre}
                onChange={(event) => setResponsableNombre(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nombre del responsable técnico"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Cargo</span>
              <input
                value={responsableCargo}
                onChange={(event) => setResponsableCargo(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Cargo / rol técnico"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Correo</span>
              <input
                type="email"
                value={responsableEmail}
                onChange={(event) => setResponsableEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="correo@rmsic.cl"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Teléfono</span>
              <input
                value={responsableTelefono}
                onChange={(event) => setResponsableTelefono(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="+56 9 ..."
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Contenido técnico</h2>

          <div className="mt-5 space-y-4">
            {renderCampoTextoIA('Resumen ejecutivo', resumenEjecutivo, setResumenEjecutivo)}
            {renderCampoTextoIA('Antecedentes', antecedentes, setAntecedentes)}
            {renderCampoTextoIA('Objetivo', objetivo, setObjetivo)}
            {renderCampoTextoIA('Alcance', alcance, setAlcance)}
            {renderCampoTextoIA('Metodología', metodologia, setMetodologia)}
            {renderCampoTextoIA('Desarrollo del levantamiento', desarrollo, setDesarrollo)}
            {renderCampoTextoIA('Análisis técnico', analisisTecnico, setAnalisisTecnico)}
            {renderCampoTextoIA('Conclusiones', conclusiones, setConclusiones)}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/informes/${informe.id}`}
            className={buttonPrimary}
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={saving}
            className={buttonPrimary}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}