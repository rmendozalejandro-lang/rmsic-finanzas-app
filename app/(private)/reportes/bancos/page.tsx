'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ReportPageHeader from '../components/ReportPageHeader'
import ExportExcelButton from '../components/ExportExcelButton'

type SaldoBancarioRow = Record<string, unknown>

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

const formatCLP = (value: number) => {
  return `$${Number(value || 0).toLocaleString('es-CL')}`
}

const getStringValue = (row: SaldoBancarioRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return '-'
}

const getNumberValue = (row: SaldoBancarioRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== '') {
      const numberValue = Number(value)
      if (!Number.isNaN(numberValue)) return numberValue
    }
  }
  return 0
}

export default function ResumenBancarioPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saldos, setSaldos] = useState<SaldoBancarioRow[]>([])

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

  useEffect(() => {
    const fetchResumenBancario = async () => {
      if (!empresaActivaId) {
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
          `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=*`,
          { headers }
        )

        const data = await response.json()

        if (!response.ok) {
          setError('No se pudo cargar el resumen bancario.')
          return
        }

        setSaldos(Array.isArray(data) ? data : [])
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

    fetchResumenBancario()
  }, [router, empresaActivaId])

  const totalSaldo = useMemo(() => {
    return saldos.reduce(
      (acc, item) =>
        acc +
        getNumberValue(item, [
          'saldo_calculado',
          'saldo_actual',
          'saldo',
          'disponible',
          'monto',
        ]),
      0
    )
  }, [saldos])

  const totalCuentas = saldos.length

  const excelRows = useMemo(() => {
    return saldos.map((item) => ({
      Banco: getStringValue(item, ['banco', 'nombre_banco', 'institucion']),
      Cuenta: getStringValue(item, [
        'cuenta',
        'nombre_cuenta',
        'numero_cuenta',
        'descripcion',
      ]),
      Tipo: getStringValue(item, ['tipo_cuenta', 'tipo']),
      Saldo: getNumberValue(item, [
        'saldo_calculado',
        'saldo_actual',
        'saldo',
        'disponible',
        'monto',
      ]),
    }))
  }, [saldos])

  return (
    <main className="space-y-6">
      <ReportPageHeader
        title="Resumen bancario"
        empresaActivaNombre={empresaActivaNombre}
        subtitle="Vista de saldos bancarios y cuentas asociadas a la empresa activa."
        rightActions={
          <ExportExcelButton
            fileName={`resumen_bancario_${empresaActivaNombre || 'empresa'}.xlsx`}
            sheetName="Bancos"
            rows={excelRows}
            disabled={loading}
          />
        }
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando resumen bancario...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Saldo total bancos</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCLP(totalSaldo)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Cantidad de cuentas</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {totalCuentas}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Banco</th>
                    <th className="px-4 py-3 font-medium">Cuenta</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No hay cuentas bancarias registradas para la empresa activa.
                      </td>
                    </tr>
                  ) : (
                    saldos.map((item, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">
                          {getStringValue(item, ['banco', 'nombre_banco', 'institucion'])}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {getStringValue(item, [
                            'cuenta',
                            'nombre_cuenta',
                            'numero_cuenta',
                            'descripcion',
                          ])}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {getStringValue(item, ['tipo_cuenta', 'tipo'])}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCLP(
                            getNumberValue(item, [
                              'saldo_calculado',
                              'saldo_actual',
                              'saldo',
                              'disponible',
                              'monto',
                            ])
                          )}
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