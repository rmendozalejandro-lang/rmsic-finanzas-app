'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ProtectedCotizacionesRoute from '@/components/ProtectedCotizacionesRoute'
import CotizacionForm, {
  type CotizacionFormValues,
  type CotizacionFormItem,
} from '../../_components/cotizacion-form'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type GenericRow = Record<string, unknown>

type ClienteOption = {
  id: string
  label: string
}

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

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
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

export default function EditarCotizacionPage() {
  const params = useParams<{ id: string }>()
  const cotizacionId = String(params?.id || '')

  const [empresaActivaId, setEmpresaActivaId] = useState('')
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState('')

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [initialValues, setInitialValues] = useState<CotizacionFormValues | null>(
    null
  )
  const [initialItems, setInitialItems] = useState<CotizacionFormItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usuarioRol, setUsuarioRol] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

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
      if (!empresaActivaId || !cotizacionId) {
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
        const userId = session.user.id
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        if (!apiKey || !baseUrl) {
          setError('Faltan variables públicas de Supabase.')
          setLoading(false)
          return
        }

        const [cotizacionResp, itemsResp, clientesResp, rolResp] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/cotizaciones?id=eq.${cotizacionId}&empresa_id=eq.${empresaActivaId}&select=*`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          ),
          fetch(
            `${baseUrl}/rest/v1/cotizacion_items?cotizacion_id=eq.${cotizacionId}&select=*&order=orden.asc`,
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
          fetch(
            `${baseUrl}/rest/v1/usuario_empresas?select=rol&usuario_id=eq.${userId}&empresa_id=eq.${empresaActivaId}&activo=eq.true`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${accessToken}`,
              },
            }
          ),
        ])

        const cotizacionJson = await cotizacionResp.json()
        const itemsJson = await itemsResp.json()
        const clientesJson = await clientesResp.json()
        const rolJson = await rolResp.json()

        if (!cotizacionResp.ok) {
          setError(
            cotizacionJson?.message ||
              cotizacionJson?.error_description ||
              cotizacionJson?.error ||
              'No se pudo cargar la cotización.'
          )
          setLoading(false)
          return
        }

        if (!itemsResp.ok) {
          setError(
            itemsJson?.message ||
              itemsJson?.error_description ||
              itemsJson?.error ||
              'No se pudieron cargar los ítems.'
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

        if (!rolResp.ok) {
          setError(
            rolJson?.message ||
              rolJson?.error_description ||
              rolJson?.error ||
              'No se pudo cargar el rol del usuario.'
          )
          setLoading(false)
          return
        }

        const rol =
          Array.isArray(rolJson) && rolJson.length > 0 ? rolJson[0].rol || '' : ''

        setUsuarioRol(rol)
        setIsAdmin(rol === 'admin')

        const cotizacionRow = Array.isArray(cotizacionJson)
          ? (cotizacionJson[0] as GenericRow | undefined)
          : undefined

        if (!cotizacionRow) {
          setError('No se encontró la cotización solicitada.')
          setLoading(false)
          return
        }

        const clientesOptions = Array.isArray(clientesJson)
          ? (clientesJson as GenericRow[]).map((row) => ({
              id: String(row.id),
              label: getClienteLabel(row),
            }))
          : []

        const mappedItems: CotizacionFormItem[] = Array.isArray(itemsJson)
          ? (itemsJson as GenericRow[]).map((item, index) => ({
              uid: String(item.id ?? `item-${index}`),
              descripcion:
                typeof item.descripcion === 'string' ? item.descripcion : '',
              detalle: typeof item.detalle === 'string' ? item.detalle : '',
              unidad: typeof item.unidad === 'string' ? item.unidad : '',
              cantidad: String(toNumber(item.cantidad) || 1),
              precio_unitario: String(toNumber(item.precio_unitario)),
              descuento_tipo:
                item.descuento_tipo === 'porcentaje' || item.descuento_tipo === 'monto'
                  ? item.descuento_tipo
                  : '',
              descuento_valor: String(toNumber(item.descuento_valor)),
              afecto_iva: Boolean(item.afecto_iva),
            }))
          : []

        const values: CotizacionFormValues = {
          cliente_id:
            typeof cotizacionRow.cliente_id === 'string'
              ? cotizacionRow.cliente_id
              : '',
          estado:
            cotizacionRow.estado === 'borrador' ||
            cotizacionRow.estado === 'enviada' ||
            cotizacionRow.estado === 'aprobada' ||
            cotizacionRow.estado === 'rechazada' ||
            cotizacionRow.estado === 'vencida'
              ? cotizacionRow.estado
              : 'borrador',
          titulo: typeof cotizacionRow.titulo === 'string' ? cotizacionRow.titulo : '',
          descripcion:
            typeof cotizacionRow.descripcion === 'string'
              ? cotizacionRow.descripcion
              : '',
          observaciones:
            typeof cotizacionRow.observaciones === 'string'
              ? cotizacionRow.observaciones
              : '',
          condiciones_comerciales:
            typeof cotizacionRow.condiciones_comerciales === 'string'
              ? cotizacionRow.condiciones_comerciales
              : '',
          fecha_emision:
            typeof cotizacionRow.fecha_emision === 'string'
              ? cotizacionRow.fecha_emision
              : '',
          fecha_vencimiento:
            typeof cotizacionRow.fecha_vencimiento === 'string'
              ? cotizacionRow.fecha_vencimiento
              : '',
          moneda:
            typeof cotizacionRow.moneda === 'string' ? cotizacionRow.moneda : 'CLP',
          porcentaje_iva: String(toNumber(cotizacionRow.porcentaje_iva) || 19),
          descuento_global_tipo:
            cotizacionRow.descuento_global_tipo === 'porcentaje' ||
            cotizacionRow.descuento_global_tipo === 'monto'
              ? cotizacionRow.descuento_global_tipo
              : '',
          descuento_global_valor: String(
            toNumber(cotizacionRow.descuento_global_valor)
          ),
          empresa_nombre:
            typeof cotizacionRow.empresa_nombre === 'string'
              ? cotizacionRow.empresa_nombre
              : '',
          empresa_logo_url:
            typeof cotizacionRow.empresa_logo_url === 'string'
              ? cotizacionRow.empresa_logo_url
              : '',
          empresa_email:
            typeof cotizacionRow.empresa_email === 'string'
              ? cotizacionRow.empresa_email
              : '',
          empresa_telefono:
            typeof cotizacionRow.empresa_telefono === 'string'
              ? cotizacionRow.empresa_telefono
              : '',
          empresa_web:
            typeof cotizacionRow.empresa_web === 'string'
              ? cotizacionRow.empresa_web
              : '',
          ejecutivo_nombre:
            typeof cotizacionRow.ejecutivo_nombre === 'string'
              ? cotizacionRow.ejecutivo_nombre
              : '',
          ejecutivo_email:
            typeof cotizacionRow.ejecutivo_email === 'string'
              ? cotizacionRow.ejecutivo_email
              : '',
          ejecutivo_telefono:
            typeof cotizacionRow.ejecutivo_telefono === 'string'
              ? cotizacionRow.ejecutivo_telefono
              : '',
        }

        setClientes(clientesOptions)
        setInitialItems(mappedItems)
        setInitialValues(values)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error cargando la edición.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [empresaActivaId, cotizacionId])

  if (!empresaActivaId && !loading) {
    return (
      <ProtectedCotizacionesRoute>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Editar cotización
            </h1>
            <p className="mt-2 text-sm text-slate-700">
              No se encontró una empresa activa en el navegador.
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
            Cargando edición de cotización...
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
              Editar cotización
            </h1>
            <p className="mt-2 text-sm text-rose-700">{error}</p>

            <div className="mt-4">
              <Link
                href={`/cotizaciones/${cotizacionId}`}
                className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Volver al detalle
              </Link>
            </div>
          </div>
        </div>
      </ProtectedCotizacionesRoute>
    )
  }

  if (!isAdmin) {
    return (
      <ProtectedCotizacionesRoute>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Editar cotización
            </h1>
            <p className="mt-2 text-sm text-slate-700">
              El usuario actual tiene rol{' '}
              <span className="font-semibold">
                {usuarioRol || 'sin rol asignado'}
              </span>
              .
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Solo el administrador puede editar cotizaciones.
            </p>

            <div className="mt-4">
              <Link
                href={`/cotizaciones/${cotizacionId}`}
                className="inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Volver al detalle
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
        initialItems={initialItems}
        mode="edit"
        cotizacionId={cotizacionId}
        backHref={`/cotizaciones/${cotizacionId}`}
      />
    </ProtectedCotizacionesRoute>
  )
}