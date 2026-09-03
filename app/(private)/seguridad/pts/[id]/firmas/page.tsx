'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PTSAccessGuard from '../../../../../../components/pts/PTSAccessGuard'
import ParticipantSignaturePad from '../../../../../../components/pts/ParticipantSignaturePad'
import { supabase } from '../../../../../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

type Permiso = {
  id: string
  folio: number | null
  estado: string
  trabajo_a_realizar: string
}

type Persona = {
  id: string
  nombre_apellido: string
  rut: string
  orden: number
}

type Firma = {
  id: string
  personal_id: string
  nombre_firmante: string
  rut_firmante: string
  capturado_por_nombre: string
  firmado_at: string
}

type Stroke = { x: number; y: number }[][]

export default function FirmasParticipantesPage() {
  const params = useParams<{ id: string }>()
  const permisoId = params.id
  const [permiso, setPermiso] = useState<Permiso | null>(null)
  const [personal, setPersonal] = useState<Persona[]>([])
  const [firmas, setFirmas] = useState<Firma[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      if (!empresaId) throw new Error('No hay empresa activa seleccionada.')

      const [permisoResp, personalResp, firmasResp] = await Promise.all([
        supabase.from('pts_permisos').select('id,folio,estado,trabajo_a_realizar').eq('id', permisoId).eq('empresa_id', empresaId).single(),
        supabase.from('pts_personal').select('id,nombre_apellido,rut,orden').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('orden'),
        supabase.from('pts_firmas_participantes').select('id,personal_id,nombre_firmante,rut_firmante,capturado_por_nombre,firmado_at').eq('permiso_id', permisoId).eq('empresa_id', empresaId).order('firmado_at'),
      ])

      const firstError = [permisoResp, personalResp, firmasResp].find((result) => result.error)?.error
      if (firstError) throw firstError

      setPermiso(permisoResp.data as Permiso)
      setPersonal((personalResp.data ?? []) as Persona[])
      setFirmas((firmasResp.data ?? []) as Firma[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las firmas del PTS.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisoId])

  const firmasPorPersona = useMemo(() => new Map(firmas.map((firma) => [firma.personal_id, firma])), [firmas])
  const pendientes = personal.filter((persona) => !firmasPorPersona.has(persona.id))
  const todasFirmadas = personal.length > 0 && pendientes.length === 0
  const puedeFirmar = permiso?.estado === 'aprobado'

  const firmar = async (personalId: string, strokes: Stroke) => {
    try {
      setSavingId(personalId)
      setError('')
      setSuccess('')
      const { error: rpcError } = await supabase.rpc('pts_firmar_participante', {
        p_permiso_id: permisoId,
        p_personal_id: personalId,
        p_firma_trazos: strokes,
      })
      if (rpcError) throw new Error(rpcError.message)
      setSuccess('Firma del participante registrada correctamente.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la firma.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <PTSAccessGuard>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <Link href={`/seguridad/pts/${permisoId}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">← Volver al resumen del expediente</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#168F86]">Firmas previas al inicio</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Firmas de participantes</h1>
          {permiso ? <p className="mt-2 text-sm text-slate-500">PTS-{String(permiso.folio ?? 0).padStart(6, '0')} · {permiso.trabajo_a_realizar}</p> : null}
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Cargando participantes...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}

        {!loading && permiso ? (
          <>
            <section className={`rounded-3xl border p-5 ${todasFirmadas ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${todasFirmadas ? 'text-emerald-700' : 'text-amber-700'}`}>Estado de firmas</p>
                  <h2 className={`mt-1 text-xl font-semibold ${todasFirmadas ? 'text-emerald-950' : 'text-amber-950'}`}>{firmas.length} de {personal.length} participantes firmaron</h2>
                  <p className={`mt-1 text-sm ${todasFirmadas ? 'text-emerald-800' : 'text-amber-800'}`}>{todasFirmadas ? 'Todos los participantes aceptaron el PTS. El expediente puede continuar al inicio del trabajo.' : 'El trabajo no puede comenzar mientras exista una firma pendiente.'}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${todasFirmadas ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{todasFirmadas ? 'Firmas completas' : `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`}</span>
              </div>
            </section>

            {!puedeFirmar && !todasFirmadas ? <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Las firmas solo pueden registrarse cuando el PTS está aprobado y antes de iniciar el trabajo.</section> : null}

            <section className="space-y-4">
              {personal.map((persona) => {
                const firma = firmasPorPersona.get(persona.id)
                return (
                  <article key={persona.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${firma ? 'border-emerald-200' : 'border-slate-200'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{persona.nombre_apellido}</h2>
                        <p className="mt-1 text-sm text-slate-500">RUT {persona.rut}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${firma ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{firma ? '✓ Firmado' : 'Firma pendiente'}</span>
                    </div>

                    {firma ? (
                      <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Firmante</p><p className="mt-1 text-sm font-medium text-slate-900">{firma.nombre_firmante} · {firma.rut_firmante}</p></div>
                        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Fecha y hora</p><p className="mt-1 text-sm font-medium text-slate-900">{new Date(firma.firmado_at).toLocaleString('es-CL')}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Captura registrada por</p><p className="mt-1 text-sm font-medium text-slate-900">{firma.capturado_por_nombre}</p></div>
                      </div>
                    ) : puedeFirmar ? (
                      <>
                        <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">Entrega el dispositivo al participante para que lea la declaración y realice personalmente su firma.</div>
                        <ParticipantSignaturePad saving={savingId === persona.id} disabled={Boolean(savingId && savingId !== persona.id)} onSubmit={(strokes) => firmar(persona.id, strokes)} />
                      </>
                    ) : null}
                  </article>
                )
              })}
            </section>

            {todasFirmadas ? <Link href={`/seguridad/pts/${permisoId}`} className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Volver al PTS para iniciar trabajo</Link> : null}
          </>
        ) : null}
      </main>
    </PTSAccessGuard>
  )
}
