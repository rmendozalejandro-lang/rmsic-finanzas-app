'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CotizacionForm from '../_components/cotizacion-form'
import { supabase } from '@/lib/supabase/client'
import { getEmpresaLogoSrc } from '@/lib/empresa-branding'
import ProtectedCotizacionesRoute from '@/components/ProtectedCotizacionesRoute'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type ClienteOption = {
  id: string
  label: string
}

type GenericRow = Record<string, unknown>

function pickFirstString(row: GenericRow | null | undefined, keys: string[]) {
  if (!row) return ''

  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return ''
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function getClienteLabel(cliente: GenericRow) {
  return (
    pickFirstString(cliente, [
      'razon_social',
      'nombre',
      'nombre_fantasia',
      'empresa',
      'cliente',
      'rut',
    ]) || 'Cliente sin nombre'
  )
}

export default function NuevaCotizacionPage() {
  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [initialValues, setInitialValues] = useState<{
    cliente_id: string
    estado: 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'vencida'
    titulo: string
    descripcion: string
    observaciones: string
    condiciones_comerciales: string
    fecha_emision: string
    fecha_vencimiento: string
    moneda: string
    porcentaje_iva: string
    descuento_global_tipo: '' | 'porcentaje' | 'monto'
    descuento_global_valor: string
    empresa_nombre: string
    empresa_logo_url: string
    empresa_email: string
    empresa_telefono: string
    empresa_web: string
    ejecutivo_nombre: string
    ejecutivo_email: string
    ejecutivo_telefono: string
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    const fetchData = async () => {
      if (!empresaActivaId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        const session = data.session

        if (sessionError || !session) {
          setError('No se pudo recuperar la sesión activa del navegador.')
          setLoading(false)
          return
        }

        const accessToken = session.access_token
        const user = session.user
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        if (!apiKey || !baseUrl) {
          setError('Faltan variables públicas de Supabase.')
          setLoading(false)
          return
        }

        const [empresaResp, clientesResp] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/empresas?id=eq.${empresaActivaId}&select=*`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          ),
          fetch(
            `${baseUrl}/rest/v1/clientes?empresa_id=eq.${empresaActivaId}&select=*&order=nombre.asc`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          ),
        ])

        const empresaJson = await empresaResp.json()
        const clientesJson = await clientesResp.json()

        if (!empresaResp.ok) {
          setError(
            empresaJson?.message ||
              empresaJson?.error_description ||
              empresaJson?.error ||
              'No se pudo cargar la información de la empresa activa.'
          )
          setLoading(false)
          return
        }

        if (!clientesResp.ok) {
          setError(
            clientesJson?.message ||
              clientesJson?.error_description ||
              clientesJson?.error ||
              'No se pudieron cargar los clientes.'
          )
          setLoading(false)
          return
        }

        const empresaRow = Array.isArray(empresaJson)
          ? (empresaJson[0] as GenericRow | undefined)
          : undefined

        const empresaNombreCompleto =
          pickFirstString(empresaRow, [
            'razon_social',
            'nombre',
            'nombre_fantasia',
            'empresa',
          ]) || empresaActivaNombre || ''

        const empresaLogoUrl = getEmpresaLogoSrc({
          empresaLogoUrl: pickFirstString(empresaRow, [
            'logo_url',
            'logo',
            'url_logo',
            'image_url',
            'imagen_url',
          ]),
          empresaNombre: empresaNombreCompleto,
          empresaActivaNombre,
        })

        const empresaEmail = pickFirstString(empresaRow, [
          'email',
          'correo',
          'correo_electronico',
        ])

        const empresaTelefono = pickFirstString(empresaRow, [
          'telefono',
          'celular',
          'phone',
          'telefono_contacto',
        ])

        const empresaWeb = pickFirstString(empresaRow, [
          'web',
          'sitio_web',
          'website',
          'url_web',
          'pagina_web',
        ])

        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>

        const ejecutivoNombre =
          (typeof metadata.full_name === 'string' && metadata.full_name) ||
          (typeof metadata.name === 'string' && metadata.name) ||
          (typeof metadata.nombre === 'string' && metadata.nombre) ||
          ''

        const ejecutivoTelefono =
          (typeof metadata.phone === 'string' && metadata.phone) ||
          (typeof metadata.telefono === 'string' && metadata.telefono) ||
          (typeof metadata.celular === 'string' && metadata.celular) ||
          ''

        const clientesOptions = Array.isArray(clientesJson)
          ? (clientesJson as GenericRow[]).map((row) => ({
              id: String(row.id),
              label: getClienteLabel(row),
            }))
          : []

        const today = new Date()
        const fechaEmision = formatDateInput(today)
        const fechaVencimiento = formatDateInput(addDays(today, 10))

        setClientes(clientesOptions)
        setInitialValues({
          cliente_id: '',
          estado: 'borrador',
          titulo: '',
          descripcion: '',
          observaciones: '',
          condiciones_comerciales: 'Validez de la cotización: 15 días',
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVencimiento,
          moneda: 'CLP',
          porcentaje_iva: '19',
          descuento_global_tipo: '',
          descuento_global_valor: '0',
          empresa_nombre: empresaNombreCompleto,
          empresa_logo_url: empresaLogoUrl,
          empresa_email: empresaEmail,
          empresa_telefono: empresaTelefono,
          empresa_web: empresaWeb,
          ejecutivo_nombre: ejecutivoNombre,
          ejecutivo_email: user.email || '',
          ejecutivo_telefono: ejecutivoTelefono,
        })
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error cargando la nueva cotización.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [empresaActivaId, empresaActivaNombre])

  if (!empresaActivaId && !loading) {
    return (
      <ProtectedCotizacionesRoute>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Nueva cotización
            </h1>
            <p className="mt-2 text-sm text-slate-700">
              No se encontró una empresa activa en el navegador.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Vuelve al dashboard, selecciona una empresa y luego entra nuevamente a
              cotizaciones.
            </p>

            <div className="mt-4">
              <Link
                href="/cotizaciones"
                className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Volver a cotizaciones
              </Link>
            </div>
          </div>
        </div>
      </ProtectedCotizacionesRoute>
    )
  }

  if (loading || !initialValues) {
    return (
      <ProtectedCotizacionesRoute>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            Cargando formulario de nueva cotización...
          </div>
        </div>
      </ProtectedCotizacionesRoute>
    )
  }

  if (error) {
    return (
      <ProtectedCotizacionesRoute>
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Nueva cotización
            </h1>
            <p className="mt-2 text-sm text-rose-700">{error}</p>

            <div className="mt-4">
              <Link
                href="/cotizaciones"
                className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Volver a cotizaciones
              </Link>
            </div>
          </div>
        </div>
      </ProtectedCotizacionesRoute>
    )
  }

  return (
    <ProtectedCotizacionesRoute>
      <CotizacionForm
        empresaId={empresaActivaId}
        clientes={clientes}
        initialValues={initialValues}
      />
    </ProtectedCotizacionesRoute>
  )
}