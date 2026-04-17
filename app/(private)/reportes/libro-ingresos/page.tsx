'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import DateRangeFilter from '../components/DateRangeFilter'
import ReportPageHeader from '../components/ReportPageHeader'
import ExportExcelButton from '../components/ExportExcelButton'

type MovimientoIngreso = {
  id: string
  fecha: string
  descripcion: string | null
  tipo_documento: string | null
  numero_documento: string | null
  monto_total: number
  tipo_movimiento: string
  estado: string
}

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatCLP = (value: number) => {
  return `$${Number(value || 0).toLocaleString('es-CL')}`
}

const formatFecha = (value: string) => {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CL')
}

const getToday = () => new Date().toISOString().slice(0, 10)

const getFirstDayOfMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

const getSignedIngresoAmount = (item: {
  tipo_movimiento?: string
  tipo_documento?: string | null
  monto_total?: number
}) => {
  const monto = Number(item.monto_total || 0)
  const tipoMovimiento = (item.tipo_movimiento || '').toLowerCase()
  const tipoDocumento = (item.tipo_documento || '').toLowerCase()

  if (tipoMovimiento !== 'ingreso') return monto
  if (tipoDocumento === 'nota_credito') return -monto

  return monto
}

export default function LibroIngresosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [movimientos, setMovimientos] = useState<MovimientoIngreso[]>([])

  const [desde, setDesde] = useState(getFirstDayOfMonth())
  const [hasta, setHasta] = useState(getToday())

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_ID_KEY) || ''
      const empresaNombre = window.localStorage.getItem(STORAGE_NAME_KEY) || ''

      setEmpresaActivaId(empresaId)
      setEmpresaActivaNombre(empresaNombre)
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  const handlePresetChange = (preset: string) => {
    const now = new Date()

    if (preset === 'este_mes') {
      setDesde(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
      setHasta(getToday())
      return
    }

    if (preset === 'mes_pasado') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0)
      setDesde(firstDayPrev.toISOString().slice(0, 10))
      setHasta(lastDayPrev.toISOString().slice(0, 10))
      return
    }

    if (preset === 'anio_actual') {
      setDesde(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10))
      setHasta(getToday())
      return
    }

    if (preset === 'ultimos_30') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setDesde(d.toISOString().slice(0, 10))
      setHasta(getToday())
    }
  }

  useEffect(() => {
    const fetchLibroIngresos = async () => {
      if (!empresaActivaId || !desde || !hasta) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const { data: sessionData } = await supabase.auth.getSession()

        if (!sessionData.session) {
          router.push('/login')
          return
        }

        const accessToken = sessionData.session.access_token
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        const headers = {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
        }

        const response = await fetch(
          `${baseUrl}/rest/v1/movimientos?select=id,fecha,descripcion,tipo_documento,numero_documento,monto_total,tipo_movimiento,estado&empresa_id=eq.${empresaActivaId}&tipo_movimiento=eq.ingreso&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.desc`,
          { headers }
        )

        const data = await response.json()

        if (!response.ok) {
          setError('No se pudo cargar el libro de ingresos.')
          return
        }

        setMovimientos(Array.isArray(data) ? data : [])
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Error desconocido')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchLibroIngresos()
  }, [router, empresaActivaId, desde, hasta])

  const totalIngresos = useMemo(() => {
    return movimientos.reduce((acc, item) => acc + getSignedIngresoAmount(item), 0)
  }, [movimientos])

  const excelRows = useMemo(() => {
    return movimientos.map((item) => ({
      Fecha: formatFecha(item.fecha),
      Documento: [item.tipo_documento, item.numero_documento].filter(Boolean).join(' ') || '-',
      Descripcion: item.descripcion || '-',
      Estado: item.estado || '-',
      Monto: getSignedIngresoAmount(item),
    }))
  }, [movimientos])

  return (
    <main className="space-y-6">
      <ReportPageHeader
        title="Libro de ingresos"
        empresaActivaNombre={empresaActivaNombre}
        subtitle="Detalle de ingresos registrados para la empresa activa."
        desde={desde}
        hasta={hasta}
        rightActions={
          <ExportExcelButton
            fileName={`libro_ingresos_${empresaActivaNombre || 'empresa'}_${desde}_${hasta}.xlsx`}
            sheetName="Ingresos"
            rows={excelRows}
            disabled={loading}
          />
        }
      />

      <DateRangeFilter
        desde={desde}
        hasta={hasta}
        onDesdeChange={setDesde}
        onHastaChange={setHasta}
        onPresetChange={handlePresetChange}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando libro de ingresos...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total ingresos del período</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCLP(totalIngresos)}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Documento</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No hay ingresos registrados para el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    movimientos.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">
                          {formatFecha(item.fecha)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {[item.tipo_documento, item.numero_documento].filter(Boolean).join(' ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.descripcion || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.estado || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCLP(getSignedIngresoAmount(item))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}