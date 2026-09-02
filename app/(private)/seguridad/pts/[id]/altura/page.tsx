'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PTSAccessGuard from '../../../../../../components/pts/PTSAccessGuard'
import { supabase } from '../../../../../../lib/supabase/client'
import {
  PERMISO_ALTURA_CHECKLIST,
  PERMISO_ALTURA_REQUISITOS_PERSONAS,
} from '../../../../../../lib/pts/checklists'

const STORAGE_KEY = 'empresa_activa_id'

type Respuesta = 'si' | 'no' | 'na' | ''

type ChecklistState = Record<
  string,
  {
    respuesta: Respuesta
    observacion: string
  }
>

type PermisoComplementario = {
  id: string
  estado: string
  nombre: string
  codigo_fuente: string | null
}

export default function PermisoAlturaPage() {
  const params = useParams<{ id: string }>()
  const permisoId = params.id
  const [empresaId, setEmpresaId] = useState('')
  const [permiso, setPermiso] = useState<PermisoComplementario | null>(null)
  const [respuestas, setRespuestas] = useState<ChecklistState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const activeEmpresaId = window.localStorage.getItem(STORAGE_KEY) || ''
        if (!activeEmpresaId) throw new Error('No hay empresa activa seleccionada.')
        if (active) setEmpresaId(activeEmpresaId)

        const { data: complementario, error: complementarioError } = await supabase
          .from('pts_permisos_complementarios')
          .select('id,estado,nombre,codigo_fuente')
          .eq('permiso_id', permisoId)
          .eq('empresa_id', activeEmpresaId)
          .eq('tipo', 'altura')
          .eq('requerido', true)
          .maybeSingle()

        if (complementarioError) throw complementarioError
        if (!complementario) throw new Error('Este expediente no tiene un Permiso de Trabajo en Altura requerido.')

        const { data: existentes, error: existentesError } = await supabase
          .from('pts_checklist_respuestas')
          .select('codigo_item,respuesta,observacion')
          .eq('permiso_complementario_id', complementario.id)
          .eq('empresa_id', activeEmpresaId)

        if (existentesError) throw existentesError

        const initial: ChecklistState = {}
        for (const item of PERMISO_ALTURA_CHECKLIST) {
          const existente = (existentes ?? []).find((row) => row.codigo_item === item.codigo)
          initial[item.codigo] = {
            respuesta: (existente?.respuesta as Respuesta | null) ?? '',
            observacion: existente?.observacion ?? '',
          }
        }

        if (active) {
          setPermiso(complementario as PermisoComplementario)
          setRespuestas(initial)
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el Permiso de Trabajo en Altura.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [permisoId])

  const pendientes = useMemo(
    () => PERMISO_ALTURA_CHECKLIST.filter((item) => !respuestas[item.codigo]?.respuesta).length,
    [respuestas]
  )

  const bloqueantesNo = useMemo(
    () =>
      PERMISO_ALTURA_CHECKLIST.filter(
        (item) => item.bloqueanteSiNo && respuestas[item.codigo]?.respuesta === 'no'
      ).length,
    [respuestas]
  )

  const completos = PERMISO_ALTURA_CHECKLIST.length - pendientes
  const porcentaje = Math.round((completos / PERMISO_ALTURA_CHECKLIST.length) * 100)
  const listo = pendientes === 0 && bloqueantesNo === 0

  const setRespuesta = (codigo: string, respuesta: Respuesta) => {
    setRespuestas((current) => ({
      ...current,
      [codigo]: {
        respuesta,
        observacion: current[codigo]?.observacion ?? '',
      },
    }))
  }

  const setObservacion = (codigo: string, observacion: string) => {
    setRespuestas((current) => ({
      ...current,
      [codigo]: {
        respuesta: current[codigo]?.respuesta ?? '',
        observacion,
      },
    }))
  }

  const guardar = async () => {
    if (!permiso || !empresaId) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const rows = PERMISO_ALTURA_CHECKLIST.map((item) => ({
        permiso_complementario_id: permiso.id,
        empresa_id: empresaId,
        codigo_item: item.codigo,
        seccion: item.seccion,
        pregunta: item.pregunta,
        respuesta: respuestas[item.codigo]?.respuesta || null,
        bloqueante_si_no: item.bloqueanteSiNo,
        observacion: respuestas[item.codigo]?.observacion.trim() || null,
        orden: item.orden,
      }))

      const { error: upsertError } = await supabase
        .from('pts_checklist_respuestas')
        .upsert(rows, { onConflict: 'permiso_complementario_id,codigo_item' })

      if (upsertError) throw upsertError

      const nuevoEstado = listo ? 'completo' : bloqueantesNo > 0 ? 'observado' : 'borrador'
      const { error: estadoError } = await supabase
        .from('pts_permisos_complementarios')
        .update({ estado: nuevoEstado })
        .eq('id', permiso.id)
        .eq('empresa_id', empresaId)

      if (estadoError) throw estadoError

      const { error: historialError } = await supabase.from('pts_historial').insert({
        permiso_id: permisoId,
        empresa_id: empresaId,
        evento: 'permiso_altura_guardado',
        detalle: listo
          ? 'Permiso de Trabajo en Altura completado sin respuestas bloqueantes.'
          : bloqueantesNo > 0
            ? `Permiso de Trabajo en Altura guardado con ${bloqueantesNo} respuesta(s) NO bloqueante(s).`
            : `Permiso de Trabajo en Altura guardado con ${pendientes} respuesta(s) pendiente(s).`,
      })

      if (historialError) throw historialError

      setPermiso({ ...permiso, estado: nuevoEstado })
      setSuccess(
        listo
          ? 'Permiso de Trabajo en Altura completo y habilitado para continuar el flujo.'
          : bloqueantesNo > 0
            ? 'Guardado. El permiso permanece bloqueado porque existe al menos una respuesta NO.'
            : 'Borrador guardado. Aún quedan respuestas pendientes.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el Permiso de Trabajo en Altura.')
    } finally {
      setSaving(false)
    }
  }

  const secciones = Array.from(new Set(PERMISO_ALTURA_CHECKLIST.map((item) => item.seccion)))

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href={`/seguridad/pts/${permisoId}/permisos`} className="text-sm font-medium text-slate-500 hover:text-slate-900">← Volver a permisos complementarios</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#168F86]">Permiso complementario</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Permiso de Trabajo en Altura</h1>
            <p className="mt-2 text-sm text-slate-500">RE-MO9-PR-02 · Todos los controles requeridos deben quedar conformes antes de solicitar revisión.</p>
          </div>
          {permiso ? (
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${
              permiso.estado === 'completo'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : permiso.estado === 'observado'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              {permiso.estado === 'completo' ? 'Completo' : permiso.estado === 'observado' ? 'Bloqueado' : 'Borrador'}
            </span>
          ) : null}
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando permiso...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}

        {!loading && permiso ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Avance</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{porcentaje}%</p>
                <p className="mt-1 text-sm text-slate-500">{completos} de {PERMISO_ALTURA_CHECKLIST.length} controles respondidos</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pendientes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{pendientes}</p>
                <p className="mt-1 text-sm text-slate-500">Deben quedar en cero antes de revisión</p>
              </div>
              <div className={`rounded-2xl border p-5 shadow-sm ${bloqueantesNo > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${bloqueantesNo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Respuestas NO</p>
                <p className={`mt-2 text-3xl font-semibold ${bloqueantesNo > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{bloqueantesNo}</p>
                <p className={`mt-1 text-sm ${bloqueantesNo > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{bloqueantesNo > 0 ? 'El permiso no puede aprobarse' : 'Sin bloqueos registrados'}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Requisitos de las personas</h2>
              <div className="mt-4 space-y-3">
                {PERMISO_ALTURA_REQUISITOS_PERSONAS.map((requisito) => (
                  <div key={requisito} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <span className="font-semibold text-[#168F86]">✓</span>
                    <span>{requisito}</span>
                  </div>
                ))}
              </div>
            </section>

            {secciones.map((seccion) => (
              <section key={seccion} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{seccion}</h2>
                <p className="mt-1 text-sm text-slate-500">Selecciona Sí, No o N/A. Una respuesta No bloquea la autorización hasta que la condición sea corregida y reevaluada.</p>
                <div className="mt-5 space-y-4">
                  {PERMISO_ALTURA_CHECKLIST.filter((item) => item.seccion === seccion).map((item) => {
                    const row = respuestas[item.codigo] ?? { respuesta: '', observacion: '' }
                    const bloqueado = row.respuesta === 'no' && item.bloqueanteSiNo
                    return (
                      <div key={item.codigo} className={`rounded-2xl border p-4 ${bloqueado ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-2xl">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{item.codigo}</span>
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-red-500">Bloqueante</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-900">{item.pregunta}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(['si', 'no', 'na'] as const).map((value) => {
                              const selected = row.respuesta === value
                              const label = value === 'si' ? 'Sí' : value === 'no' ? 'No' : 'N/A'
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setRespuesta(item.codigo, value)}
                                  className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                                    selected
                                      ? value === 'no'
                                        ? 'border-red-500 bg-red-600 text-white'
                                        : value === 'si'
                                          ? 'border-emerald-500 bg-emerald-600 text-white'
                                          : 'border-slate-500 bg-slate-700 text-white'
                                      : 'border-slate-300 bg-white text-slate-600'
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <textarea
                          value={row.observacion}
                          onChange={(e) => setObservacion(item.codigo, e.target.value)}
                          rows={2}
                          placeholder={bloqueado ? 'Indica la condición insegura y la corrección requerida antes de reevaluar...' : 'Observación opcional...'}
                          className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#18B7A8]"
                        />
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}

            {bloqueantesNo > 0 ? (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <strong>Permiso bloqueado:</strong> existe al menos una respuesta NO. El trabajo en altura no puede ser autorizado hasta corregir la condición y reevaluar el punto.
              </section>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link href={`/seguridad/pts/${permisoId}/permisos`} className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700">Volver</Link>
              <button type="button" onClick={guardar} disabled={saving} className="inline-flex justify-center rounded-xl bg-[#18B7A8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#11998E] disabled:opacity-60">
                {saving ? 'Guardando...' : listo ? 'Guardar permiso completo' : 'Guardar avance'}
              </button>
            </div>
          </>
        ) : null}
      </main>
    </PTSAccessGuard>
  )
}
