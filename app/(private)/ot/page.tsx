'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedModuleRoute from '../../../components/ProtectedModuleRoute'
import { OTDataTable } from '../../../components/ot/ot-data-table'
import { supabase } from '../../../lib/supabase/client'
import { getOTResumenList } from '../../../lib/ot/queries'
import type { OTResumen } from '../../../lib/ot/types'

function OTPageContent() {
  const [ots, setOts] = useState<OTResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const rows = await getOTResumenList(supabase)

        if (active) {
          setOts(rows)
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

        <div className="flex gap-3">
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