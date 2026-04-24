'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../components/ProtectedModuleRoute'
import { OTDataTable } from '../../../components/ot/ot-data-table'
import { supabase } from '../../../lib/supabase/client'
import type { OTResumen } from '../../../lib/ot/types'

const STORAGE_ID_KEY = 'empresa_activa_id'

function OTPageContent() {
  const [ots, setOts] = useState<OTResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [checkingRole, setCheckingRole] = useState(true)
  const [canManageTecnicos, setCanManageTecnicos] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          throw new Error('No se pudo validar la sesión actual.')
        }

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(STORAGE_ID_KEY) || ''
            : ''

        if (!empresaActivaId) {
          throw new Error('No hay empresa activa seleccionada.')
        }

        const userId = session.user.id

        const { data: rolData, error: rolError } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', userId)
          .eq('empresa_id', empresaActivaId)
          .eq('activo', true)
          .maybeSingle()

        if (rolError) {
          throw new Error(`No se pudo validar el rol del usuario: ${rolError.message}`)
        }

        const currentRole = rolData?.rol || ''

        let otsData: OTResumen[] = []

        if (currentRole === 'tecnico_ot') {
          const { data: ownOtRows, error: ownOtError } = await supabase
            .from('ot_ordenes_trabajo')
            .select('id')
            .eq('empresa_id', empresaActivaId)
            .or(`tecnico_responsable_id.eq.${userId},created_by.eq.${userId}`)

          if (ownOtError) {
            throw new Error(`No se pudo cargar las OT del técnico: ${ownOtError.message}`)
          }

          const ownOtIds = (ownOtRows ?? []).map((item) => item.id).filter(Boolean)

          if (ownOtIds.length > 0) {
            const { data, error } = await supabase
              .from('ot_vw_resumen')
              .select('*')
              .in('id', ownOtIds)
              .order('created_at', { ascending: false })

            if (error) {
              throw new Error(`No se pudo cargar el listado OT: ${error.message}`)
            }

            otsData = (data ?? []) as OTResumen[]
          }
        } else {
          const { data, error } = await supabase
            .from('ot_vw_resumen')
            .select('*')
            .eq('empresa_id', empresaActivaId)
            .order('created_at', { ascending: false })

          if (error) {
            throw new Error(`No se pudo cargar el listado OT: ${error.message}`)
          }

          otsData = (data ?? []) as OTResumen[]
        }

        if (active) {
          setOts(otsData)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar las OT.'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const resolveRole = async () => {
      try {
        setCheckingRole(true)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          if (active) {
            setCanManageTecnicos(false)
          }
          return
        }

        const empresaActivaId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(STORAGE_ID_KEY) || ''
            : ''

        if (!empresaActivaId) {
          if (active) {
            setCanManageTecnicos(false)
          }
          return
        }

        const { data, error } = await supabase
          .from('usuario_empresas')
          .select('rol')
          .eq('usuario_id', session.user.id)
          .eq('empresa_id', empresaActivaId)
          .eq('activo', true)
          .maybeSingle()

        if (error) {
          if (active) {
            setCanManageTecnicos(false)
          }
          return
        }

        const rol = data?.rol || ''

        if (active) {
          setCanManageTecnicos(rol !== 'tecnico_ot')
        }
      } finally {
        if (active) {
          setCheckingRole(false)
        }
      }
    }

    void resolveRole()

    return () => {
      active = false
    }
  }, [])

  const totalAsignadas = useMemo(
    () => ots.filter((ot) => ot.estado_nombre?.toLowerCase() === 'asignada').length,
    [ots]
  )

  const totalEnProceso = useMemo(
    () => ots.filter((ot) => ot.estado_nombre?.toLowerCase() === 'en proceso').length,
    [ots]
  )

  const totalCerradas = useMemo(
    () => ots.filter((ot) => ot.estado_nombre?.toLowerCase() === 'cerrada').length,
    [ots]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Órdenes de Trabajo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona las OT, revisa estados y controla el avance de los trabajos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageTecnicos && !checkingRole ? (
            <Link
              href="/ot/tecnicos"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Técnicos OT
            </Link>
          ) : null}

          <Link
            href="/ot/nueva"
            style={{ backgroundColor: '#163A5F', color: '#ffffff' }}
            className="inline-flex items-center justify-center rounded-xl bg-[#163A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245C90]"
          >
            Nueva OT
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total OT</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{ots.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Asignadas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalAsignadas}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">En proceso</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalEnProceso}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cerradas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalCerradas}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando órdenes de trabajo...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : (
        <OTDataTable data={ots} />
      )}
    </div>
  )
}

export default function OTPage() {
  return (
    <ProtectedModuleRoute moduleKey="ot">
      <OTPageContent />
    </ProtectedModuleRoute>
  )
}
