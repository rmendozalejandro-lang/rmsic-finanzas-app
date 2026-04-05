'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type SaldoBancario = {
  id: string
  banco: string
  nombre_cuenta: string
  tipo_cuenta: string
  moneda: string
  saldo_inicial: number
  ingresos_pagados: number
  egresos_pagados: number
  saldo_calculado: number
}

type LibroBanco = {
  fecha: string
  banco: string
  nombre_cuenta: string
  tipo_movimiento: string
  tipo_documento: string | null
  numero_documento: string | null
  descripcion: string
  ingreso: number
  egreso: number
  estado: string
}

export default function BancosPage() {
  const router = useRouter()

  const [saldos, setSaldos] = useState<SaldoBancario[]>([])
  const [libro, setLibro] = useState<LibroBanco[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchBancos = async () => {
      try {
        setLoading(true)
        setError('')

        const { data: sessionData } = await import('../../../lib/supabase/client').then(m => m.supabase.auth.getSession())

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

        const [saldosResp, libroResp] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/v_saldos_bancarios?select=*`, { headers }),
          fetch(`${baseUrl}/rest/v1/v_libro_bancos?select=*&order=fecha.desc`, { headers }),
        ])

        const saldosJson = await saldosResp.json()
        const libroJson = await libroResp.json()

        if (!saldosResp.ok) {
          setError(`Error saldos: ${JSON.stringify(saldosJson)}`)
          return
        }

        if (!libroResp.ok) {
          setError(`Error libro bancos: ${JSON.stringify(libroJson)}`)
          return
        }

        setSaldos(saldosJson ?? [])
        setLibro(libroJson ?? [])
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

    fetchBancos()
  }, [router])

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Bancos</h1>
        <p className="text-slate-600 mt-2">
          Saldos bancarios y libro de movimientos.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          Cargando bancos...
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 p-6 shadow-sm border border-red-200 text-red-700">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saldos.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200"
              >
                <p className="text-sm text-slate-500">{item.banco}</p>
                <h2 className="text-2xl font-semibold mt-1">{item.nombre_cuenta}</h2>
                <p className="text-sm text-slate-500 mt-1">{item.tipo_cuenta}</p>

                <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
                  <div>
                    <p className="text-slate-500">Saldo inicial</p>
                    <p className="font-semibold mt-1">
                      ${Number(item.saldo_inicial).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Saldo calculado</p>
                    <p className="font-semibold mt-1">
                      ${Number(item.saldo_calculado).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Ingresos pagados</p>
                    <p className="font-semibold mt-1">
                      ${Number(item.ingresos_pagados).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Egresos pagados</p>
                    <p className="font-semibold mt-1">
                      ${Number(item.egresos_pagados).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900">Libro de bancos</h2>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Movimientos pagados asociados a cuentas bancarias.
            </p>

            {libro.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No hay movimientos bancarios.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="py-3 pr-4">Banco</th>
                      <th className="py-3 pr-4">Cuenta</th>
                      <th className="py-3 pr-4">Tipo</th>
                      <th className="py-3 pr-4">Documento</th>
                      <th className="py-3 pr-4">Descripción</th>
                      <th className="py-3 pr-4">Ingreso</th>
                      <th className="py-3 pr-4">Egreso</th>
                      <th className="py-3 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libro.map((item, index) => (
                      <tr key={`${item.numero_documento}-${index}`} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{item.fecha}</td>
                        <td className="py-3 pr-4">{item.banco}</td>
                        <td className="py-3 pr-4">{item.nombre_cuenta}</td>
                        <td className="py-3 pr-4">{item.tipo_movimiento}</td>
                        <td className="py-3 pr-4">{item.numero_documento ?? '-'}</td>
                        <td className="py-3 pr-4">{item.descripcion}</td>
                        <td className="py-3 pr-4">
                          ${Number(item.ingreso).toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 pr-4">
                          ${Number(item.egreso).toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 pr-4">{item.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}