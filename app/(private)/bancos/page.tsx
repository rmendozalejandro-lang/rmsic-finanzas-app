'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type CuentaBancaria = {
  id: string
  empresa_id: string
  banco: string
  nombre_cuenta: string
  tipo_cuenta: string | null
  moneda: string | null
  saldo_inicial: number
  activa: boolean
}

type SaldoBancario = {
  empresa_id: string
  id: string
  banco: string
  nombre_cuenta: string
  tipo_cuenta: string | null
  moneda: string | null
  saldo_inicial: number
  ingresos_pagados: number
  egresos_pagados: number
  saldo_calculado: number
}

type MovimientoBanco = {
  id: string
  fecha: string
  tipo_movimiento: string
  numero_documento: string | null
  descripcion: string
  monto_total: number
  estado: string
  cuenta_bancaria_id: string | null
  empresa_id: string
}

const STORAGE_KEY = 'empresa_activa_id'

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatTipoMovimiento = (value: string) => {
  switch ((value || '').toLowerCase()) {
    case 'ingreso':
      return 'Ingreso'
    case 'egreso':
      return 'Egreso'
    default:
      return value || '-'
  }
}

export default function BancosPage() {
  const router = useRouter()

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [saldos, setSaldos] = useState<SaldoBancario[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoBanco[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      setEmpresaActivaId(empresaId)
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  const fetchData = async () => {
    if (!empresaActivaId) return

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

      const [cuentasResp, saldosResp, movimientosResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?empresa_id=eq.${empresaActivaId}&select=id,empresa_id,banco,nombre_cuenta,tipo_cuenta,moneda,saldo_inicial,activa&order=banco.asc,nombre_cuenta.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=*`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/movimientos?empresa_id=eq.${empresaActivaId}&select=id,fecha,tipo_movimiento,numero_documento,descripcion,monto_total,estado,cuenta_bancaria_id,empresa_id&cuenta_bancaria_id=not.is.null&order=fecha.desc&limit=30`,
          { headers }
        ),
      ])

      const cuentasJson = await cuentasResp.json()
      const saldosJson = await saldosResp.json()
      const movimientosJson = await movimientosResp.json()

      if (!cuentasResp.ok) {
        console.error(cuentasJson)
        setError('No se pudieron cargar las cuentas bancarias.')
        return
      }

      if (!saldosResp.ok) {
        console.error(saldosJson)
        setError('No se pudieron cargar los saldos bancarios.')
        return
      }

      if (!movimientosResp.ok) {
        console.error(movimientosJson)
        setError('No se pudieron cargar los movimientos bancarios.')
        return
      }

      setCuentas(cuentasJson ?? [])
      setSaldos(saldosJson ?? [])
      setMovimientos(movimientosJson ?? [])
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

  useEffect(() => {
    fetchData()
  }, [router, empresaActivaId])

  const cuentasMap = useMemo(() => {
    return new Map(
      cuentas.map((cuenta) => [
        cuenta.id,
        `${cuenta.banco} - ${cuenta.nombre_cuenta}`,
      ])
    )
  }, [cuentas])

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Bancos</h1>
        <p className="text-slate-600 mt-2">
          Cuentas, saldos y movimientos bancarios de la empresa activa.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          Cargando información bancaria...
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 p-6 shadow-sm border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900">
              Cuentas bancarias
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Cuentas registradas para la empresa activa.
            </p>

            {cuentas.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay cuentas bancarias registradas para esta empresa.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Banco</th>
                      <th className="py-3 pr-4">Cuenta</th>
                      <th className="py-3 pr-4">Tipo</th>
                      <th className="py-3 pr-4">Moneda</th>
                      <th className="py-3 pr-4">Saldo inicial</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map((cuenta) => (
                      <tr key={cuenta.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{cuenta.banco}</td>
                        <td className="py-3 pr-4">{cuenta.nombre_cuenta}</td>
                        <td className="py-3 pr-4">{cuenta.tipo_cuenta ?? '-'}</td>
                        <td className="py-3 pr-4">{cuenta.moneda ?? '-'}</td>
                        <td className="py-3 pr-4 font-medium">
                          {formatCLP(cuenta.saldo_inicial)}
                        </td>
                        <td className="py-3 pr-4">
                          {cuenta.activa ? 'Activa' : 'Inactiva'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900">
              Saldos bancarios
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Resumen financiero por cuenta bancaria.
            </p>

            {saldos.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay saldos bancarios disponibles para esta empresa.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {saldos.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-slate-50 p-5 border border-slate-200"
                  >
                    <p className="text-sm text-slate-500">{item.banco}</p>
                    <h3 className="text-xl font-semibold mt-1">
                      {item.nombre_cuenta}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-slate-500">Saldo inicial</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.saldo_inicial)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Saldo calculado</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.saldo_calculado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Ingresos pagados</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.ingresos_pagados)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Egresos pagados</p>
                        <p className="font-medium mt-1">
                          {formatCLP(item.egresos_pagados)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900">
              Últimos movimientos bancarios
            </h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Movimientos asociados a cuentas bancarias de la empresa activa.
            </p>

            {movimientos.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay movimientos bancarios registrados para esta empresa.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Tipo</th>
                      <th className="py-3 pr-4">Documento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Cuenta</th>
                      <th className="py-3 pr-4">Monto</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{item.fecha}</td>
                        <td className="py-3 pr-4">
                          {formatTipoMovimiento(item.tipo_movimiento)}
                        </td>
                        <td className="py-3 pr-4">{item.numero_documento ?? '-'}</td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4">
                          {item.cuenta_bancaria_id
                            ? cuentasMap.get(item.cuenta_bancaria_id) ?? '-'
                            : '-'}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {formatCLP(item.monto_total)}
                        </td>
                        <td className="py-3 pr-4">{item.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}