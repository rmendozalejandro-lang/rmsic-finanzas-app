'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import EmpresaActivaBanner from '../../../components/EmpresaActivaBanner'

type CuentaBancaria = {
  id: string
  empresa_id: string
  banco: string
  nombre_cuenta: string
  tipo_cuenta: string | null
  moneda: string | null
  saldo_inicial: number
  activa: boolean
  deleted_at?: string | null
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
  transferencias_entrantes: number
  transferencias_salientes: number
  activa?: boolean | null
  deleted_at?: string | null
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
  origen?: string | null
  activo?: boolean | null
  deleted_at?: string | null
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
    case 'transferencia_entrada':
      return 'Transferencia entrada'
    case 'transferencia_salida':
      return 'Transferencia salida'
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

      const [cuentasResp, saldosResp] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/cuentas_bancarias?empresa_id=eq.${empresaActivaId}&activa=eq.true&deleted_at=is.null&select=id,empresa_id,banco,nombre_cuenta,tipo_cuenta,moneda,saldo_inicial,activa&order=banco.asc,nombre_cuenta.asc`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/v_saldos_bancarios?empresa_id=eq.${empresaActivaId}&select=*`,
          { headers }
        ),
      ])

      const cuentasJson = await cuentasResp.json()
      const saldosJson = await saldosResp.json()

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

      const cuentasActivas = (cuentasJson ?? []) as CuentaBancaria[]
      const cuentasActivasIds = new Set(cuentasActivas.map((cuenta) => cuenta.id))
      const saldosActivos = ((saldosJson ?? []) as SaldoBancario[]).filter(
        (saldo) => cuentasActivasIds.has(saldo.id)
      )

      const movimientosBaseUrl = `${baseUrl}/rest/v1/v_movimientos_bancarios?empresa_id=eq.${empresaActivaId}&select=id,fecha,tipo_movimiento,tipo_documento,numero_documento,descripcion,monto_total,estado,cuenta_bancaria_id,empresa_id,origen&cuenta_bancaria_id=not.is.null&order=fecha.desc&limit=30`

      let movimientosResp = await fetch(
        `${movimientosBaseUrl}&activo=eq.true&deleted_at=is.null`,
        { headers }
      )

      let movimientosJson = await movimientosResp.json()

      if (!movimientosResp.ok) {
        console.warn(
          'La vista v_movimientos_bancarios no permitió filtrar por activo/deleted_at. Se usará filtro por cuentas activas como respaldo.',
          movimientosJson
        )

        movimientosResp = await fetch(movimientosBaseUrl, { headers })
        movimientosJson = await movimientosResp.json()
      }

      if (!movimientosResp.ok) {
        console.error(movimientosJson)
        setError('No se pudieron cargar los movimientos bancarios.')
        return
      }

      const movimientosActivos = ((movimientosJson ?? []) as MovimientoBanco[]).filter(
        (movimiento) => {
          const cuentaId = movimiento.cuenta_bancaria_id

          if (!cuentaId || !cuentasActivasIds.has(cuentaId)) return false
          if (movimiento.activo === false) return false
          if (movimiento.deleted_at) return false

          return true
        }
      )

      setCuentas(cuentasActivas)
      setSaldos(saldosActivos)
      setMovimientos(movimientosActivos)
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900">Bancos</h1>
          <p className="mt-2 text-slate-600">
            Cuentas, saldos y movimientos bancarios de la empresa activa.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/bancos/importar"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Importar cartola
          </Link>

          <Link
            href="/bancos/importaciones"
            className="inline-flex items-center justify-center rounded-xl border border-[#163A5F] bg-white px-4 py-2 text-sm font-semibold text-[#163A5F] hover:bg-blue-50"
          >
            Ver importaciones
          </Link>
        </div>
      </div>

      <EmpresaActivaBanner
        modulo="Bancos"
        descripcion="Toda la información mostrada corresponde exclusivamente a la empresa activa seleccionada."
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando información bancaria...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
              Cuentas bancarias
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Cuentas registradas para la empresa activa.
            </p>

            {cuentas.length === 0 ? (
              <div className="text-sm text-slate-500">
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
              Saldos bancarios
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Resumen financiero por cuenta bancaria.
            </p>

            {saldos.length === 0 ? (
              <div className="text-sm text-slate-500">
                No hay saldos bancarios disponibles para esta empresa.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {saldos.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <p className="text-sm text-slate-500">{item.banco}</p>
                    <h3 className="mt-1 text-xl font-semibold">
                      {item.nombre_cuenta}
                    </h3>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Saldo inicial</p>
                        <p className="mt-1 font-medium">
                          {formatCLP(item.saldo_inicial)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Saldo calculado</p>
                        <p className="mt-1 font-medium">
                          {formatCLP(item.saldo_calculado)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Ingresos pagados</p>
                        <p className="mt-1 font-medium">
                          {formatCLP(item.ingresos_pagados)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Egresos pagados</p>
                        <p className="mt-1 font-medium">
                          {formatCLP(item.egresos_pagados)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Transferencias entrantes</p>
                        <p className="mt-1 font-medium">
                          {formatCLP(item.transferencias_entrantes)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Transferencias salientes</p>
                        <p className="mt-1 font-medium">
                          {formatCLP(item.transferencias_salientes)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
              Últimos movimientos bancarios
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Movimientos asociados a cuentas bancarias de la empresa activa.
            </p>

            {movimientos.length === 0 ? (
              <div className="text-sm text-slate-500">
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
                        <td className="py-3 pr-4">
                          {item.numero_documento ?? '-'}
                        </td>
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