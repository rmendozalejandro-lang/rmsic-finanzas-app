'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'
import { buttonGroup, buttonPrimary, buttonSmall } from '../../../../lib/styles/buttons'

const RMSIC_EMPRESA_ID = '557a054c-71ef-4c5f-8637-594755ad669b'
const STORAGE_ID_KEY = 'empresa_activa_id'

type PlantillaInforme = {
  id: string
  empresa_id: string
  nombre: string
  tipo_informe: string
  descripcion: string | null
  configuracion_json: ConfiguracionPlantilla
  activa: boolean
  created_at: string
  updated_at: string
}

type ConfiguracionPlantilla = {
  resumen_ejecutivo?: string
  antecedentes?: string
  objetivo?: string
  alcance?: string
  metodologia?: string
  desarrollo?: string
  analisis_tecnico?: string
  conclusiones?: string
}

type FormPlantilla = {
  id: string | null
  nombre: string
  tipo_informe: string
  descripcion: string
  activa: boolean
  resumen_ejecutivo: string
  antecedentes: string
  objetivo: string
  alcance: string
  metodologia: string
  desarrollo: string
  analisis_tecnico: string
  conclusiones: string
}

const formularioInicial: FormPlantilla = {
  id: null,
  nombre: '',
  tipo_informe: '',
  descripcion: '',
  activa: true,
  resumen_ejecutivo: '',
  antecedentes: '',
  objetivo: '',
  alcance: '',
  metodologia: '',
  desarrollo: '',
  analisis_tecnico: '',
  conclusiones: '',
}

const camposContenido: Array<{
  key: keyof Pick<
    FormPlantilla,
    | 'resumen_ejecutivo'
    | 'antecedentes'
    | 'objetivo'
    | 'alcance'
    | 'metodologia'
    | 'desarrollo'
    | 'analisis_tecnico'
    | 'conclusiones'
  >
  label: string
}> = [
  { key: 'resumen_ejecutivo', label: 'Resumen ejecutivo' },
  { key: 'antecedentes', label: 'Antecedentes' },
  { key: 'objetivo', label: 'Objetivo' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'metodologia', label: 'Metodología' },
  { key: 'desarrollo', label: 'Desarrollo' },
  { key: 'analisis_tecnico', label: 'Análisis técnico' },
  { key: 'conclusiones', label: 'Conclusiones' },
]

function crearTipoDesdeNombre(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function obtenerConfiguracion(valor: unknown): ConfiguracionPlantilla {
  if (!valor || typeof valor !== 'object') return {}
  return valor as ConfiguracionPlantilla
}

function plantillaAFormulario(plantilla: PlantillaInforme): FormPlantilla {
  const configuracion = obtenerConfiguracion(plantilla.configuracion_json)

  return {
    id: plantilla.id,
    nombre: plantilla.nombre || '',
    tipo_informe: plantilla.tipo_informe || '',
    descripcion: plantilla.descripcion || '',
    activa: Boolean(plantilla.activa),
    resumen_ejecutivo: configuracion.resumen_ejecutivo || '',
    antecedentes: configuracion.antecedentes || '',
    objetivo: configuracion.objetivo || '',
    alcance: configuracion.alcance || '',
    metodologia: configuracion.metodologia || '',
    desarrollo: configuracion.desarrollo || '',
    analisis_tecnico: configuracion.analisis_tecnico || '',
    conclusiones: configuracion.conclusiones || '',
  }
}

export default function PlantillasInformesPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaInforme[]>([])
  const [formulario, setFormulario] = useState<FormPlantilla>(formularioInicial)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const esEdicion = Boolean(formulario.id)

  const plantillasActivas = useMemo(
    () => plantillas.filter((plantilla) => plantilla.activa).length,
    [plantillas],
  )

  useEffect(() => {
    const empresaActiva = window.localStorage.getItem(STORAGE_ID_KEY)
    setEmpresaId(empresaActiva)
  }, [])

  useEffect(() => {
    if (!empresaId) return

    if (empresaId !== RMSIC_EMPRESA_ID) {
      setCargando(false)
      return
    }

    cargarPlantillas(empresaId)
  }, [empresaId])

  async function cargarPlantillas(idEmpresa: string) {
    setCargando(true)
    setErrorMessage(null)

    const { data, error } = await supabase
      .from('informes_plantillas')
      .select('id, empresa_id, nombre, tipo_informe, descripcion, configuracion_json, activa, created_at, updated_at')
      .eq('empresa_id', idEmpresa)
      .order('activa', { ascending: false })
      .order('nombre', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      setPlantillas([])
    } else {
      setPlantillas((data || []) as PlantillaInforme[])
    }

    setCargando(false)
  }

  function actualizarCampo<K extends keyof FormPlantilla>(campo: K, valor: FormPlantilla[K]) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
      ...(campo === 'nombre' && !actual.id
        ? { tipo_informe: crearTipoDesdeNombre(String(valor)) }
        : {}),
    }))
  }

  function limpiarFormulario() {
    setFormulario(formularioInicial)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  function editarPlantilla(plantilla: PlantillaInforme) {
    setFormulario(plantillaAFormulario(plantilla))
    setErrorMessage(null)
    setSuccessMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function cambiarEstadoPlantilla(plantilla: PlantillaInforme) {
    if (!empresaId || empresaId !== RMSIC_EMPRESA_ID) return

    const nuevoEstado = !plantilla.activa
    const accion = nuevoEstado ? 'activar' : 'desactivar'

    const confirmar = window.confirm(`¿Deseas ${accion} la plantilla "${plantilla.nombre}"?`)
    if (!confirmar) return

    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase
      .from('informes_plantillas')
      .update({
        activa: nuevoEstado,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plantilla.id)
      .eq('empresa_id', empresaId)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setSuccessMessage(nuevoEstado ? 'Plantilla activada correctamente.' : 'Plantilla desactivada correctamente.')
    cargarPlantillas(empresaId)
  }

  async function duplicarPlantilla(plantilla: PlantillaInforme) {
    if (!empresaId || empresaId !== RMSIC_EMPRESA_ID) return

    const confirmar = window.confirm(`¿Deseas duplicar la plantilla "${plantilla.nombre}"?`)
    if (!confirmar) return

    setErrorMessage(null)
    setSuccessMessage(null)

    const nombreDuplicado = `${plantilla.nombre} copia`
    const tipoDuplicado = `${plantilla.tipo_informe}_copia_${Date.now()}`

    const { error } = await supabase.from('informes_plantillas').insert({
      empresa_id: empresaId,
      nombre: nombreDuplicado,
      tipo_informe: tipoDuplicado,
      descripcion: plantilla.descripcion,
      configuracion_json: plantilla.configuracion_json || {},
      activa: false,
    })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setSuccessMessage('Plantilla duplicada como inactiva. Puedes editarla antes de activarla.')
    cargarPlantillas(empresaId)
  }

  async function guardarPlantilla(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!empresaId || empresaId !== RMSIC_EMPRESA_ID) {
      setErrorMessage('Acceso restringido a RMSIC.')
      return
    }

    const nombre = formulario.nombre.trim()
    const tipoInforme = formulario.tipo_informe.trim() || crearTipoDesdeNombre(nombre)

    if (!nombre) {
      setErrorMessage('Debes ingresar el nombre de la plantilla.')
      return
    }

    if (!tipoInforme) {
      setErrorMessage('Debes ingresar el tipo interno de informe.')
      return
    }

    setGuardando(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const configuracion: ConfiguracionPlantilla = {
      resumen_ejecutivo: formulario.resumen_ejecutivo.trim(),
      antecedentes: formulario.antecedentes.trim(),
      objetivo: formulario.objetivo.trim(),
      alcance: formulario.alcance.trim(),
      metodologia: formulario.metodologia.trim(),
      desarrollo: formulario.desarrollo.trim(),
      analisis_tecnico: formulario.analisis_tecnico.trim(),
      conclusiones: formulario.conclusiones.trim(),
    }

    const payload = {
      empresa_id: empresaId,
      nombre,
      tipo_informe: tipoInforme,
      descripcion: formulario.descripcion.trim() || null,
      configuracion_json: configuracion,
      activa: formulario.activa,
      updated_at: new Date().toISOString(),
    }

    const consulta = formulario.id
      ? supabase
          .from('informes_plantillas')
          .update(payload)
          .eq('id', formulario.id)
          .eq('empresa_id', empresaId)
      : supabase.from('informes_plantillas').insert(payload)

    const { error } = await consulta

    if (error) {
      setErrorMessage(error.message)
      setGuardando(false)
      return
    }

    setSuccessMessage(formulario.id ? 'Plantilla actualizada correctamente.' : 'Plantilla creada correctamente.')
    setFormulario(formularioInicial)
    await cargarPlantillas(empresaId)
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Cargando plantillas...</p>
        </div>
      </div>
    )
  }

  if (empresaId !== RMSIC_EMPRESA_ID) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Acceso restringido</p>
          <p className="mt-2 text-sm text-slate-600">
            La administración de plantillas de informes técnicos se encuentra habilitada solo para RMSIC.
          </p>
          <div className="mt-5">
            <Link href="/informes" className={buttonPrimary}>
              Volver a informes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="flex flex-col gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#163A5F]">
            Informes Técnicos
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Administración de plantillas
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Crea, edita, activa o desactiva plantillas base para iniciar informes técnicos con estructura predefinida.
            El contenido sugerido siempre queda editable antes de guardar el informe.
          </p>
        </div>

        <div className={buttonGroup}>
          <Link href="/informes/nuevo" className={buttonPrimary}>
            Nuevo informe
          </Link>
          <Link href="/informes" className={buttonPrimary}>
            Volver a informes
          </Link>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <form onSubmit={guardarPlantilla} className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {esEdicion ? 'Editar plantilla' : 'Nueva plantilla'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Completa los textos base que se precargarán al crear un informe.
              </p>
            </div>

            {esEdicion && (
              <button type="button" onClick={limpiarFormulario} className={buttonSmall}>
                Nueva plantilla
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Nombre</span>
              <input
                type="text"
                value={formulario.nombre}
                onChange={(event) => actualizarCampo('nombre', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#163A5F] focus:ring-4 focus:ring-[#163A5F]/10"
                placeholder="Ej: Medición factor de potencia"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Tipo interno</span>
              <input
                type="text"
                value={formulario.tipo_informe}
                onChange={(event) => actualizarCampo('tipo_informe', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#163A5F] focus:ring-4 focus:ring-[#163A5F]/10"
                placeholder="Ej: medicion_factor_potencia"
              />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-slate-700">Descripción</span>
            <textarea
              value={formulario.descripcion}
              onChange={(event) => actualizarCampo('descripcion', event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#163A5F] focus:ring-4 focus:ring-[#163A5F]/10"
              placeholder="Describe cuándo utilizar esta plantilla."
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formulario.activa}
              onChange={(event) => actualizarCampo('activa', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#163A5F] focus:ring-[#163A5F]"
            />
            Plantilla activa y disponible al crear informes
          </label>

          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Contenido sugerido</h3>
              <p className="mt-1 text-sm text-slate-500">
                Estos textos se copian al informe cuando el usuario selecciona la plantilla.
              </p>
            </div>

            {camposContenido.map((campo) => (
              <label key={campo.key} className="space-y-2 block">
                <span className="text-sm font-semibold text-slate-700">{campo.label}</span>
                <textarea
                  value={formulario[campo.key]}
                  onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-[#163A5F] focus:ring-4 focus:ring-[#163A5F]/10"
                />
              </label>
            ))}
          </div>

          <div className={buttonGroup}>
            <button type="submit" disabled={guardando} className={buttonPrimary}>
              {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear plantilla'}
            </button>
            <button type="button" onClick={limpiarFormulario} className={buttonPrimary}>
              Limpiar
            </button>
          </div>
        </form>

        <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-950">Plantillas registradas</h2>
            <p className="mt-1 text-sm text-slate-500">
              {plantillas.length} plantilla{plantillas.length === 1 ? '' : 's'} registrada{plantillas.length === 1 ? '' : 's'} · {plantillasActivas} activa{plantillasActivas === 1 ? '' : 's'}
            </p>
          </div>

          {plantillas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              Aún no existen plantillas registradas.
            </div>
          ) : (
            <div className="space-y-3">
              {plantillas.map((plantilla) => (
                <article key={plantilla.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">{plantilla.nombre}</h3>
                      <p className="mt-1 text-xs text-slate-500">{plantilla.tipo_informe}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        plantilla.activa
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      {plantilla.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {plantilla.descripcion && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{plantilla.descripcion}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => editarPlantilla(plantilla)} className={buttonSmall}>
                      Editar
                    </button>
                    <button type="button" onClick={() => duplicarPlantilla(plantilla)} className={buttonSmall}>
                      Duplicar
                    </button>
                    <button type="button" onClick={() => cambiarEstadoPlantilla(plantilla)} className={buttonSmall}>
                      {plantilla.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}
