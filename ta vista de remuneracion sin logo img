'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase/client'

type Remuneracion = {
  id: string
  empresa_id: string
  trabajador_nombre: string
  cargo: string | null
  periodo: string
  sueldo_base: number
  gratificacion: number
  bono_colacion: number
  bono_movilizacion: number
  horas_extra: number
  otros_haberes_imponibles: number
  otros_haberes_no_imponibles: number
  afp: number
  salud: number
  afc: number
  anticipo: number
  otros_descuentos: number
  total_imponible: number
  total_no_imponible: number
  total_descuentos: number
  liquido_pagar: number
  fecha_pago: string | null
  estado: string
  cuenta_bancaria_id: string | null
  observacion: string | null
}

type Empresa = {
  id: string
  nombre: string
}

const formatCLP = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CL')}`

const formatFechaLarga = (value: string | null) => {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const getEmpresaBranding = (empresaNombre: string) => {
  const nombre = (empresaNombre || '').trim()
  const nombreLower = nombre.toLowerCase()

  let logoSrc: string | null = null

  if (nombreLower.includes('rukalaf')) {
    logoSrc = '/rukalaf-logo.png'
  } else if (nombreLower.includes('rmsic')) {
    logoSrc = '/rmsic-logo.png'
  }

  const marcaCorta =
    nombre
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 8) || 'EMPRESA'

  return {
    titulo: nombre || 'Empresa',
    marcaCorta,
    logoSrc,
    mostrarLogo: Boolean(logoSrc),
  }
}
export default function RemuneracionDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const [remuneracion, setRemuneracion] = useState<Remuneracion | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDetalle = async () => {
      if (!id) return

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

        const remResp = await fetch(
          `${baseUrl}/rest/v1/remuneraciones?id=eq.${id}&select=*`,
          { headers }
        )

        const remJson = await remResp.json()

        if (!remResp.ok || !remJson?.length) {
          console.error(remJson)
          setError('No se pudo cargar la remuneración.')
          return
        }

        const rem = remJson[0] as Remuneracion
        setRemuneracion(rem)

        const empResp = await fetch(
          `${baseUrl}/rest/v1/empresas?id=eq.${rem.empresa_id}&select=id,nombre`,
          { headers }
        )

        const empJson = await empResp.json()

        if (empResp.ok && empJson?.length) {
          setEmpresa(empJson[0])
        }
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

    fetchDetalle()
  }, [id, router])

  const branding = useMemo(
    () => getEmpresaBranding(empresa?.nombre ?? ''),
    [empresa]
  )

  if (loading) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          Cargando liquidación...
        </div>
      </main>
    )
  }

  if (error || !remuneracion) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl bg-red-50 p-6 shadow-sm border border-red-200 text-red-700">
          {error || 'No se encontró la remuneración.'}
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6 print:space-y-4 print:bg-white">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <button
          onClick={() => router.back()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver
        </button>

        <button
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-white p-2 flex items-center justify-center">
            {branding.mostrarLogo ? (
              <img
                src={branding.logoSrc}
                alt={`Logo ${branding.titulo}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs font-semibold text-slate-500 text-center">
                {branding.marcaCorta}
              </span>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              {branding.marcaCorta}
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 mt-2">
              Liquidación interna de remuneración
            </h1>
            <p className="text-slate-600 mt-2">{branding.titulo}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <p className="text-slate-500">Trabajador</p>
            <p className="font-medium mt-1">{remuneracion.trabajador_nombre}</p>
          </div>
          <div>
            <p className="text-slate-500">Cargo</p>
            <p className="font-medium mt-1">{remuneracion.cargo ?? '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Período</p>
            <p className="font-medium mt-1">{remuneracion.periodo}</p>
          </div>
          <div>
            <p className="text-slate-500">Fecha de pago</p>
            <p className="font-medium mt-1">
              {formatFechaLarga(remuneracion.fecha_pago)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Estado</p>
            <p className="font-medium mt-1 capitalize">{remuneracion.estado}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <h2 className="text-2xl font-semibold text-slate-900">
          Haberes imponibles
        </h2>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Sueldo base</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.sueldo_base)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Gratificación</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.gratificacion)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Horas extra</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.horas_extra)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Otros haberes imponibles</td>
                <td className="py-3 text-right">
                  {formatCLP(remuneracion.otros_haberes_imponibles)}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Total imponible</td>
                <td className="py-3 text-right font-semibold">
                  {formatCLP(remuneracion.total_imponible)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <h2 className="text-2xl font-semibold text-slate-900">
          Haberes no imponibles
        </h2>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Bono colación</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.bono_colacion)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Bono movilización</td>
                <td className="py-3 text-right">
                  {formatCLP(remuneracion.bono_movilizacion)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Otros haberes no imponibles</td>
                <td className="py-3 text-right">
                  {formatCLP(remuneracion.otros_haberes_no_imponibles)}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Total no imponible</td>
                <td className="py-3 text-right font-semibold">
                  {formatCLP(remuneracion.total_no_imponible)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <h2 className="text-2xl font-semibold text-slate-900">Descuentos</h2>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">AFP</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.afp)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Salud</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.salud)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">AFC</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.afc)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Anticipo</td>
                <td className="py-3 text-right">{formatCLP(remuneracion.anticipo)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4">Otros descuentos</td>
                <td className="py-3 text-right">
                  {formatCLP(remuneracion.otros_descuentos)}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Total descuentos</td>
                <td className="py-3 text-right font-semibold">
                  {formatCLP(remuneracion.total_descuentos)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
            <p className="text-sm text-slate-500">Total imponible</p>
            <p className="text-xl font-semibold mt-2">
              {formatCLP(remuneracion.total_imponible)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
            <p className="text-sm text-slate-500">Total no imponible</p>
            <p className="text-xl font-semibold mt-2">
              {formatCLP(remuneracion.total_no_imponible)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
            <p className="text-sm text-slate-500">Líquido a pagar</p>
            <p className="text-xl font-semibold mt-2">
              {formatCLP(remuneracion.liquido_pagar)}
            </p>
          </div>
        </div>

        {remuneracion.observacion && (
          <div className="mt-6">
            <p className="text-sm text-slate-500">Observación</p>
            <p className="mt-2 text-slate-800">{remuneracion.observacion}</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10">
          <div className="text-center">
            <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
              Firma trabajador
            </div>
          </div>

          <div className="text-center">
            <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
              Firma empresa
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}