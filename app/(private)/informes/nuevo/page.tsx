'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase/client'
import { buttonGroup, buttonPrimary } from '../../../../lib/styles/buttons'

const RMSIC_EMPRESA_ID = '557a054c-71ef-4c5f-8637-594755ad669b'
const STORAGE_ID_KEY = 'empresa_activa_id'

type Cliente = {
  id: string
  nombre: string | null
  rut: string | null
  activo: boolean | null
}

type PlantillaConfig = {
  resumen_ejecutivo?: string | null
  antecedentes?: string | null
  objetivo?: string | null
  alcance?: string | null
  metodologia?: string | null
  desarrollo?: string | null
  analisis_tecnico?: string | null
  conclusiones?: string | null
}

type PlantillaInforme = {
  id: string
  nombre: string
  tipo_informe: string
  descripcion: string | null
  configuracion_json: PlantillaConfig | null
  activa: boolean
}

const tiposInforme = [
  { value: 'levantamiento_tecnico', label: 'Levantamiento técnico' },
  { value: 'medicion_factor_potencia', label: 'Medición factor de potencia' },
  { value: 'diagnostico_electrico', label: 'Diagnóstico eléctrico' },
  { value: 'informe_falla', label: 'Informe de falla' },
  { value: 'mediciones', label: 'Informe de mediciones' },
  { value: 'mantenimiento', label: 'Informe de mantenimiento' },
  { value: 'falla', label: 'Informe de falla general' },
  { value: 'consultoria', label: 'Informe de consultoría' },
  { value: 'avance', label: 'Informe de avance' },
  { value: 'inspeccion', label: 'Informe de inspección' },
  { value: 'mejora_propuesta', label: 'Informe de mejora propuesta' },
]

export default function NuevoInformePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaInforme[]>([])
  const [plantillaId, setPlantillaId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [tipoInforme, setTipoInforme] = useState('levantamiento_tecnico')
  const [subtipoInforme, setSubtipoInforme] = useState('')
  const [fechaInforme, setFechaInforme] = useState(() => new Date().toISOString().slice(0, 10))

  const [areaUbicacion, setAreaUbicacion] = useState('')
  const [equipoTag, setEquipoTag] = useState('')

  const [resumenEjecutivo, setResumenEjecutivo] = useState('')
  const [antecedentes, setAntecedentes] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [alcance, setAlcance] = useState('')
  const [metodologia, setMetodologia] = useState('')
  const [desarrollo, setDesarrollo] = useState('')
  const [analisisTecnico, setAnalisisTecnico] = useState('')
  const [conclusiones, setConclusiones] = useState('')

  const [destinatarioNombre, setDestinatarioNombre] = useState('')
  const [destinatarioCargo, setDestinatarioCargo] = useState('')
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [destinatarioArea, setDestinatarioArea] = useState('')

  const [responsableNombre, setResponsableNombre] = useState('Raúl Mendoza Céledon')
  const [responsableCargo, setResponsableCargo] = useState('Ingeniero de Proyecto / Magíster en Ingeniería Industrial')
  const [responsableEmail, setResponsableEmail] = useState('')
  const [responsableTelefono, setResponsableTelefono] = useState('')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
        setEmpresaActivaId(empresaId)

        if (empresaId !== RMSIC_EMPRESA_ID) {
          setLoading(false)
          return
        }

        const [clientesResponse, plantillasResponse] = await Promise.all([
          supabase
            .from('clientes')
            .select('id, nombre, rut, activo')
            .eq('empresa_id', empresaId)
            .eq('activo', true)
            .order('nombre', { ascending: true }),
          supabase
            .from('informes_plantillas')
            .select('id, nombre, tipo_informe, descripcion, configuracion_json, activa')
            .eq('empresa_id', empresaId)
            .eq('activa', true)
            .order('nombre', { ascending: true }),
        ])

        if (clientesResponse.error) {
          console.error('Error cargando clientes:', clientesResponse.error.message)
          setErrorMessage(clientesResponse.error.message)
          setClientes([])
        } else {
          setClientes((clientesResponse.data ?? []) as Cliente[])
        }

        if (plantillasResponse.error) {
          console.error('Error cargando plantillas:', plantillasResponse.error.message)
        } else {
          setPlantillas((plantillasResponse.data ?? []) as PlantillaInforme[])
        }
      } catch (error) {
        console.error('Error inesperado cargando datos:', error)
        setErrorMessage('No se pudieron cargar los datos iniciales.')
      } finally {
        setLoading(false)
      }
    }

    void cargarDatos()
  }, [])

  function obtenerTextoPlantilla(config: PlantillaConfig | null | undefined, campo: keyof PlantillaConfig) {
    const valor = config?.[campo]
    return typeof valor === 'string' ? valor : ''
  }

  function handleSeleccionPlantilla(id: string) {
    setPlantillaId(id)

    if (!id) return

    const plantilla = plantillas.find((item) => item.id === id)

    if (!plantilla) return

    const camposActuales = [
      resumenEjecutivo,
      antecedentes,
      objetivo,
      alcance,
      metodologia,
      desarrollo,
      analisisTecnico,
      conclusiones,
    ]

    const hayContenido = camposActuales.some((campo) => campo.trim().length > 0)

    if (hayContenido) {
      const confirmar = window.confirm(
        'La plantilla reemplazará los textos actuales del contenido técnico. ¿Deseas continuar?',
      )

      if (!confirmar) {
        setPlantillaId('')
        return
      }
    }

    const config = plantilla.configuracion_json

    setTipoInforme(plantilla.tipo_informe)
    setSubtipoInforme(plantilla.nombre)
    setResumenEjecutivo(obtenerTextoPlantilla(config, 'resumen_ejecutivo'))
    setAntecedentes(obtenerTextoPlantilla(config, 'antecedentes'))
    setObjetivo(obtenerTextoPlantilla(config, 'objetivo'))
    setAlcance(obtenerTextoPlantilla(config, 'alcance'))
    setMetodologia(obtenerTextoPlantilla(config, 'metodologia'))
    setDesarrollo(obtenerTextoPlantilla(config, 'desarrollo'))
    setAnalisisTecnico(obtenerTextoPlantilla(config, 'analisis_tecnico'))
    setConclusiones(obtenerTextoPlantilla(config, 'conclusiones'))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (empresaActivaId !== RMSIC_EMPRESA_ID) {
      setErrorMessage('El módulo está habilitado solo para RMSIC.')
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

      const { error } = await supabase.from('informes_tecnicos').insert({
        empresa_id: empresaActivaId,
        cliente_id: clienteId,
        titulo: titulo.trim(),
        tipo_informe: tipoInforme,
        subtipo_informe: subtipoInforme.trim() || null,
        estado: 'borrador',
        fecha_informe: fechaInforme,
        version: '1.0',

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

        creado_por: user?.id ?? null,
        actualizado_por: user?.id ?? null,
      })

      if (error) {
        console.error('Error creando informe:', error.message)
        setErrorMessage(error.message)
        return
      }

      router.push('/informes')
      router.refresh()
    } catch (error) {
      console.error('Error inesperado creando informe:', error)
      setErrorMessage('No se pudo crear el informe técnico.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando formulario...</p>
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
        <Link href="/informes" className={`${buttonPrimary} mt-5`}>
          Volver
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">RMSIC</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Nuevo informe técnico
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Crea un informe técnico en estado borrador. Las secciones sin información se omitirán posteriormente en el PDF.
            </p>
          </div>

          <Link href="/informes/plantillas" className={`${buttonPrimary} whitespace-nowrap`}>
            Administrar plantillas
          </Link>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Datos generales</h2>

          {plantillas.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[#B8D4EA] bg-[#F4FAFE] p-4">
              <label className="block space-y-1.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium text-[#163A5F]">Plantilla de informe</span>
                  <Link
                    href="/informes/plantillas"
                    className="text-xs font-semibold text-[#163A5F] no-underline hover:underline"
                  >
                    Crear o editar plantillas
                  </Link>
                </div>
                <select
                  value={plantillaId}
                  onChange={(event) => handleSeleccionPlantilla(event.target.value)}
                  className="w-full rounded-2xl border border-[#B8D4EA] bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="">Crear informe sin plantilla</option>
                  {plantillas.map((plantilla) => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre}
                    </option>
                  ))}
                </select>
              </label>

              {plantillaId && (
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  La plantilla precarga textos sugeridos en el contenido técnico. Todo queda editable antes de guardar.
                </p>
              )}
            </div>
          )}

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
                placeholder="Ej: Informe técnico de medición de factor de potencia"
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
                placeholder="Ej: Sala eléctrica, tablero general"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Equipo / TAG</span>
              <input
                value={equipoTag}
                onChange={(event) => setEquipoTag(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-slate-900">Destinatario del informe</h2>
            <p className="text-sm leading-6 text-slate-500">
              Contacto al que irá dirigido el informe. Es opcional, pero ayuda a identificar a quién se envía el documento.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Dirigido a</span>
              <input
                value={destinatarioNombre}
                onChange={(event) => setDestinatarioNombre(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: Encargado de mantenimiento"
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
                placeholder="Ej: Mantención / Producción / Operaciones"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Correo</span>
              <input
                type="email"
                value={destinatarioEmail}
                onChange={(event) => setDestinatarioEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="correo@cliente.cl"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-slate-900">Responsable técnico RMSIC</h2>
            <p className="text-sm leading-6 text-slate-500">
              Estos datos se usarán en el bloque final del PDF como emitido por RMSIC. No incluye recepción ni firma del cliente.
            </p>
          </div>

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
                placeholder="Opcional"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Contenido técnico</h2>

          <div className="mt-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Resumen ejecutivo</span>
              <textarea value={resumenEjecutivo} onChange={(e) => setResumenEjecutivo(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Antecedentes</span>
              <textarea value={antecedentes} onChange={(e) => setAntecedentes(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Objetivo</span>
              <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Alcance</span>
              <textarea value={alcance} onChange={(e) => setAlcance(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Metodología</span>
              <textarea value={metodologia} onChange={(e) => setMetodologia(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Desarrollo del levantamiento</span>
              <textarea value={desarrollo} onChange={(e) => setDesarrollo(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Análisis técnico</span>
              <textarea value={analisisTecnico} onChange={(e) => setAnalisisTecnico(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Conclusiones</span>
              <textarea value={conclusiones} onChange={(e) => setConclusiones(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
        </section>

        <div className={`${buttonGroup} justify-end`}>
          <Link href="/informes" className={buttonPrimary}>
            Cancelar
          </Link>

          <button type="submit" disabled={saving} className={buttonPrimary}>
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
        </div>
      </form>
    </div>
  )
}