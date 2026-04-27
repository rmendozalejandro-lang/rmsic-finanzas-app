'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Empresa = {
  id: string
  nombre: string
  razon_social: string | null
  rut: string | null
  giro: string | null
  email: string | null
  moneda: string
  activa: boolean
  created_at: string
}

type UsuarioEmpresa = {
  id: string
  empresa_id: string
  usuario_id: string
  rol: string
  activo: boolean
}

function dateCL(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export default function AdminEmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<UsuarioEmpresa[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'activas' | 'inactivas' | 'todas'>('activas')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: superData, error: superError } = await supabase.rpc('es_super_admin')
      if (superError) throw new Error(superError.message)

      const allowed = Boolean(superData)
      setIsSuperAdmin(allowed)

      if (!allowed) {
        setEmpresas([])
        setUsuariosEmpresa([])
        return
      }

      const [empresasResp, usuariosResp] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre, razon_social, rut, giro, email, moneda, activa, created_at')
          .order('nombre', { ascending: true }),

        supabase
          .from('usuario_empresas')
          .select('id, empresa_id, usuario_id, rol, activo')
          .eq('activo', true),
      ])

      if (empresasResp.error) throw new Error(empresasResp.error.message)
      if (usuariosResp.error) throw new Error(usuariosResp.error.message)

      setEmpresas((empresasResp.data || []) as Empresa[])
      setUsuariosEmpresa((usuariosResp.data || []) as UsuarioEmpresa[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las empresas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const usuariosPorEmpresa = useMemo(() => {
    return usuariosEmpresa.reduce<Record<string, UsuarioEmpresa[]>>((acc, item) => {
      if (!acc[item.empresa_id]) acc[item.empresa_id] = []
      acc[item.empresa_id].push(item)
      return acc
    }, {})
  }, [usuariosEmpresa])

  const empresasFiltradas = useMemo(() => {
    const q = normalize(busqueda)

    return empresas.filter((empresa) => {
      if (estadoFiltro === 'activas' && !empresa.activa) return false
      if (estadoFiltro === 'inactivas' && empresa.activa) return false

      if (!q) return true

      return [
        empresa.nombre,
        empresa.razon_social,
        empresa.rut,
        empresa.giro,
        empresa.email,
      ]
        .map(normalize)
        .join(' ')
        .includes(q)
    })
  }, [empresas, busqueda, estadoFiltro])

  const toggleEmpresa = async (empresa: Empresa) => {
    const accion = empresa.activa ? 'desactivar' : 'activar'
    const confirmed = window.confirm(`¿Deseas ${accion} ${empresa.nombre}?`)
    if (!confirmed) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: updateError } = await supabase
        .from('empresas')
        .update({
          activa: !empresa.activa,
          updated_at: new Date().toISOString(),
        })
        .eq('id', empresa.id)

      if (updateError) throw new Error(updateError.message)

      setSuccess(`Empresa ${empresa.activa ? 'desactivada' : 'activada'} correctamente.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la empresa.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando administración de empresas...</p>
        </section>
      </main>
    )
  }

  if (!isSuperAdmin) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            No tienes permisos de super administrador para acceder a este módulo.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Administración del sistema</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Empresas
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Administra empresas/clientes de la plataforma. Cada empresa mantiene sus datos
              separados por empresa_id.
            </p>
          </div>

          <Link
            href="/admin/empresas/nueva"
            className="rounded-2xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245C90]"
          >
            Nueva empresa
          </Link>
        </div>
      </section>

      {(error || success) && (
        <section
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || success}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi title="Empresas totales" value={String(empresas.length)} />
        <Kpi title="Activas" value={String(empresas.filter((item) => item.activa).length)} tone="emerald" />
        <Kpi title="Inactivas" value={String(empresas.filter((item) => !item.activa).length)} tone="amber" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
            <select
              value={estadoFiltro}
              onChange={(event) =>
                setEstadoFiltro(event.target.value as 'activas' | 'inactivas' | 'todas')
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            >
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
              <option value="todas">Todas</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar</label>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre, razón social, RUT, giro o email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#245C90]"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Datos</th>
                  <th className="px-4 py-3">Usuarios activos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creada</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {empresasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay empresas para mostrar.
                    </td>
                  </tr>
                ) : (
                  empresasFiltradas.map((empresa) => (
                    <tr key={empresa.id} className="align-top">
                      <td className="min-w-[260px] px-4 py-3">
                        <div className="font-semibold text-slate-900">{empresa.nombre}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {empresa.razon_social || 'Sin razón social'}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-400">{empresa.id}</div>
                      </td>

                      <td className="min-w-[240px] px-4 py-3 text-slate-700">
                        <div>RUT: {empresa.rut || '-'}</div>
                        <div>Giro: {empresa.giro || '-'}</div>
                        <div>Email: {empresa.email || '-'}</div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {(usuariosPorEmpresa[empresa.id] || []).length}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            empresa.activa
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {empresa.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {dateCL(empresa.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/empresas/${empresa.id}/usuarios`}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Usuarios
                          </Link>

                          <button
                            type="button"
                            onClick={() => void toggleEmpresa(empresa)}
                            disabled={saving}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                              empresa.activa
                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {empresa.activa ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}

function Kpi({
  title,
  value,
  tone = 'slate',
}: {
  title: string
  value: string
  tone?: 'emerald' | 'rose' | 'amber' | 'slate'
}) {
  const className = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    slate: 'text-slate-900',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-xl font-semibold ${className}`}>{value}</p>
    </div>
  )
}
