
'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../../../lib/supabase/client'
import {
  MODULO_PRINCIPAL_LABELS,
  MODULOS_PRINCIPALES,
  type ModuloPrincipal,
} from '../../../../../../lib/auth/permissions'

type Empresa = {
  id: string
  nombre: string
}

type EmpresaModulo = {
  id?: string
  empresa_id: string
  modulo: ModuloPrincipal
  habilitado: boolean
}

const MODULO_DESCRIPCIONES: Record<ModuloPrincipal, string> = {
  comercial: 'Clientes, cotizaciones, ingresos/ventas y cobranzas.',
  financiero: 'Bancos, egresos, proveedores, transferencias y flujo de caja.',
  contable: 'Plan de cuentas, reportes, balances, libro mayor y estados financieros.',
  operacional: 'Órdenes de trabajo, evidencias, informes técnicos y registro de tiempos.',
  rrhh: 'Remuneraciones, personal, contratos y gestión de recursos humanos.',
  administracion: 'Empresas, usuarios, roles y configuración interna.',
}

export default function EmpresaModulosPage() {
  const router = useRouter()
  const params = useParams()

  const empresaIdParam = params?.id
  const empresaId = Array.isArray(empresaIdParam)
    ? empresaIdParam[0]
    : empresaIdParam || ''

  const [loading, setLoading] = useState(true)
  const [savingModulo, setSavingModulo] = useState<ModuloPrincipal | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [modulos, setModulos] = useState<EmpresaModulo[]>([])
  const [error, setError] = useState('')

  const modulosOrdenados = useMemo(() => {
    return MODULOS_PRINCIPALES.map((modulo) => {
      const existente = modulos.find((item) => item.modulo === modulo)

      return (
        existente || {
          empresa_id: empresaId,
          modulo,
          habilitado: true,
        }
      )
    })
  }, [empresaId, modulos])

  const cargarDatos = async () => {
    if (!empresaId) return

    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const superAdminResp = await supabase.rpc('es_super_admin')

      if (superAdminResp.error || !superAdminResp.data) {
        setIsSuperAdmin(false)
        setError('No tienes permisos de super_admin para administrar módulos.')
        return
      }

      setIsSuperAdmin(true)

      const empresaResp = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('id', empresaId)
        .maybeSingle()

      if (empresaResp.error) {
        setError(empresaResp.error.message)
        return
      }

      if (!empresaResp.data) {
        setError('No se encontró la empresa solicitada.')
        return
      }

      setEmpresa(empresaResp.data as Empresa)

      const modulosResp = await supabase
        .from('empresa_modulos')
        .select('id, empresa_id, modulo, habilitado')
        .eq('empresa_id', empresaId)

      if (modulosResp.error) {
        setError(modulosResp.error.message)
        return
      }

      const modulosData = (modulosResp.data ?? []) as EmpresaModulo[]
      const modulosExistentes = new Set(modulosData.map((item) => item.modulo))

      const faltantes = MODULOS_PRINCIPALES.filter(
        (modulo) => !modulosExistentes.has(modulo)
      )

      if (faltantes.length > 0) {
        const insertResp = await supabase.from('empresa_modulos').insert(
          faltantes.map((modulo) => ({
            empresa_id: empresaId,
            modulo,
            habilitado: true,
          }))
        )

        if (insertResp.error) {
          setError(insertResp.error.message)
          setModulos(modulosData)
          return
        }

        const reloadResp = await supabase
          .from('empresa_modulos')
          .select('id, empresa_id, modulo, habilitado')
          .eq('empresa_id', empresaId)

        if (reloadResp.error) {
          setError(reloadResp.error.message)
          setModulos(modulosData)
          return
        }

        setModulos((reloadResp.data ?? []) as EmpresaModulo[])
      } else {
        setModulos(modulosData)
      }
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error inesperado cargando los módulos.')
    } finally {
      setLoading(false)
    }
  }

  const cambiarEstadoModulo = async (modulo: ModuloPrincipal) => {
    if (!empresaId) return

    const actual = modulosOrdenados.find((item) => item.modulo === modulo)
    const nuevoEstado = !actual?.habilitado

    setSavingModulo(modulo)
    setError('')

    const resp = await supabase
      .from('empresa_modulos')
      .upsert(
        {
          empresa_id: empresaId,
          modulo,
          habilitado: nuevoEstado,
        },
        {
          onConflict: 'empresa_id,modulo',
        }
      )
      .select('id, empresa_id, modulo, habilitado')
      .single()

    if (resp.error) {
      setError(resp.error.message)
      setSavingModulo(null)
      return
    }

    const actualizado = resp.data as EmpresaModulo

    setModulos((actuales) => {
      const existe = actuales.some((item) => item.modulo === modulo)

      if (!existe) {
        return [...actuales, actualizado]
      }

      return actuales.map((item) =>
        item.modulo === modulo ? actualizado : item
      )
    })

    window.dispatchEvent(new Event('empresa-activa-cambiada'))
    setSavingModulo(null)
  }

  useEffect(() => {
    void cargarDatos()
  }, [empresaId])

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Cargando módulos de empresa...</p>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-semibold text-red-900">Acceso restringido</h1>
        <p className="mt-2 text-sm text-red-700">
          {error || 'Solo un super_admin puede administrar módulos por empresa.'}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Administración de empresa
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Módulos habilitados
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Empresa:{' '}
            <span className="font-semibold text-slate-900">
              {empresa?.nombre || 'Sin nombre'}
            </span>
          </p>
        </div>

        <Link
          href="/admin/empresas"
          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline transition hover:bg-slate-50"
        >
          Volver a empresas
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {modulosOrdenados.map((item) => {
          const activo = item.habilitado
          const guardando = savingModulo === item.modulo

          return (
            <div
              key={item.modulo}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {MODULO_PRINCIPAL_LABELS[item.modulo]}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {MODULO_DESCRIPCIONES[item.modulo]}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activo
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void cambiarEstadoModulo(item.modulo)}
                disabled={guardando}
                className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  activo
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-[#163A5F] hover:bg-[#245C90]'
                }`}
              >
                {guardando
                  ? 'Guardando...'
                  : activo
                    ? 'Desactivar módulo'
                    : 'Activar módulo'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
        <strong>Importante:</strong> si desactivas un módulo para una empresa, sus
        submódulos dejan de aparecer en el menú aunque el usuario tenga rol con
        permiso. El acceso final queda definido por módulo habilitado de empresa
        más permiso del rol.
      </div>
    </div>
  )
}
