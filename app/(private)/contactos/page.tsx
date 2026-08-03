'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute'
import StatusBadge from '@/components/StatusBadge'
import { canAccessResourcePermission } from '@/lib/auth/permissions'
import { supabase } from '@/lib/supabase/client'

type Entidad = { id: string; nombre: string }
type Contacto = {
  id: string
  empresa_id: string
  cliente_id: string | null
  proveedor_id: string | null
  nombre: string
  cargo: string | null
  email: string | null
  telefono: string | null
  tipo_contacto: string
  observaciones: string | null
  activo: boolean
}

const tipos = [
  ['comercial', 'Comercial'],
  ['administrativo', 'Administrativo'],
  ['tecnico', 'Técnico'],
  ['cobranza', 'Cobranza'],
  ['otro', 'Otro'],
] as const

const emptyForm = {
  nombre: '', cargo: '', email: '', telefono: '', cliente_id: '', proveedor_id: '',
  tipo_contacto: 'otro', observaciones: '', activo: 'true',
}

export default function ContactosPage() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [rol, setRol] = useState('')
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [clientes, setClientes] = useState<Entidad[]>([])
  const [proveedores, setProveedores] = useState<Entidad[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('todos')
  const [clienteFilter, setClienteFilter] = useState('')
  const [proveedorFilter, setProveedorFilter] = useState('')
  const [form, setForm] = useState(emptyForm)

  const canCreate = canAccessResourcePermission(rol, 'crear_contactos')
  const canEdit = canAccessResourcePermission(rol, 'editar_contactos')

  useEffect(() => {
    const sync = () => setEmpresaId(localStorage.getItem('empresa_activa_id') || '')
    sync()
    window.addEventListener('empresa-activa-cambiada', sync)
    return () => window.removeEventListener('empresa-activa-cambiada', sync)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clienteId = params.get('cliente_id') || ''
    const proveedorId = params.get('proveedor_id') || ''

    // Los parámetros de navegación inicializan los filtros del maestro transversal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClienteFilter(clienteId)
    setProveedorFilter(proveedorId)
  }, [])

  const loadData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    const [contactosResp, clientesResp, proveedoresResp, rolResp] = await Promise.all([
      supabase.from('contactos').select('*').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('empresa_id', empresaId).is('deleted_at', null).order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresaId).is('deleted_at', null).order('nombre'),
      supabase.from('usuario_empresas').select('rol').eq('usuario_id', session.user.id)
        .eq('empresa_id', empresaId).eq('activo', true).maybeSingle(),
    ])

    const firstError = contactosResp.error || clientesResp.error || proveedoresResp.error || rolResp.error
    if (firstError) setError(`No se pudo cargar el maestro de contactos: ${firstError.message}`)
    else {
      setContactos((contactosResp.data ?? []) as Contacto[])
      setClientes((clientesResp.data ?? []) as Entidad[])
      setProveedores((proveedoresResp.data ?? []) as Entidad[])
      setRol(rolResp.data?.rol || '')
    }
    setLoading(false)
  }, [empresaId, router])

  useEffect(() => {
    // La carga sincroniza el maestro con la empresa activa, un sistema externo a React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const clientesById = useMemo(() => new Map(clientes.map((item) => [item.id, item.nombre])), [clientes])
  const proveedoresById = useMemo(() => new Map(proveedores.map((item) => [item.id, item.nombre])), [proveedores])
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    return contactos.filter((item) => {
      const matchesSearch = !query || [item.nombre, item.email, item.telefono]
        .some((value) => value?.toLocaleLowerCase('es').includes(query))
      return matchesSearch && (estado === 'todos' || String(item.activo) === estado)
        && (!clienteFilter || item.cliente_id === clienteFilter)
        && (!proveedorFilter || item.proveedor_id === proveedorFilter)
    })
  }, [contactos, search, estado, clienteFilter, proveedorFilter])

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm) }
  const openNewContact = () => {
    setEditingId(null)
    setForm({ ...emptyForm, cliente_id: clienteFilter, proveedor_id: proveedorFilter })
    setShowForm(true)
    setSuccess('')
    setError('')
  }
  const clearAssociationFilter = () => {
    setClienteFilter('')
    setProveedorFilter('')
    router.replace('/contactos')
  }
  const edit = (item: Contacto) => {
    setEditingId(item.id)
    setForm({
      nombre: item.nombre, cargo: item.cargo || '', email: item.email || '', telefono: item.telefono || '',
      cliente_id: item.cliente_id || '', proveedor_id: item.proveedor_id || '', tipo_contacto: item.tipo_contacto,
      observaciones: item.observaciones || '', activo: String(item.activo),
    })
    setShowForm(true); setError(''); setSuccess('')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre del contacto es obligatorio.'); return }
    if ((editingId && !canEdit) || (!editingId && !canCreate)) { setError('No tienes permiso para guardar este contacto.'); return }
    setSaving(true); setError(''); setSuccess('')
    const payload = {
      empresa_id: empresaId, nombre: form.nombre.trim(), cargo: form.cargo.trim() || null,
      email: form.email.trim() || null, telefono: form.telefono.trim() || null,
      cliente_id: form.cliente_id || null, proveedor_id: form.proveedor_id || null,
      tipo_contacto: form.tipo_contacto, observaciones: form.observaciones.trim() || null,
      activo: form.activo === 'true',
    }
    const response = editingId
      ? await supabase.from('contactos').update(payload).eq('id', editingId).eq('empresa_id', empresaId)
      : await supabase.from('contactos').insert(payload)
    if (response.error) setError(`No se pudo guardar el contacto: ${response.error.message}`)
    else { setSuccess(editingId ? 'Contacto actualizado correctamente.' : 'Contacto creado correctamente.'); closeForm(); await loadData() }
    setSaving(false)
  }

  return (
    <ProtectedModuleRoute moduleKey="contactos">
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-widest text-[#245C90]">Maestros</p>
            <h1 className="text-3xl font-semibold text-slate-900">Contactos</h1>
            <p className="mt-1 text-sm text-slate-500">Directorio transversal de clientes y proveedores.</p></div>
          {canCreate && <button onClick={openNewContact} className="rounded-xl bg-[#163A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#245C90]">Nuevo contacto</button>}
        </header>

        {(error || success) && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || success}</div>}

        {(clienteFilter || proveedorFilter) && (
          <section className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-blue-900">
              <span className="font-semibold">Filtro aplicado:</span>
              {clienteFilter && (
                <span className="rounded-full border border-blue-200 bg-white px-3 py-1 font-medium">
                  Contactos asociados al cliente{clientesById.get(clienteFilter) ? `: ${clientesById.get(clienteFilter)}` : ''}
                </span>
              )}
              {proveedorFilter && (
                <span className="rounded-full border border-blue-200 bg-white px-3 py-1 font-medium">
                  Contactos asociados al proveedor{proveedoresById.get(proveedorFilter) ? `: ${proveedoresById.get(proveedorFilter)}` : ''}
                </span>
              )}
            </div>
            <button type="button" onClick={clearAssociationFilter} className="self-start rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 sm:self-auto">
              Ver todos los contactos
            </button>
          </section>
        )}

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <input aria-label="Buscar contactos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre, email o teléfono" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="todos">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option></select>
          <select aria-label="Filtrar por cliente" value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Todos los clientes</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
          <select aria-label="Filtrar por proveedor" value={proveedorFilter} onChange={(e) => setProveedorFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Todos los proveedores</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Cargando contactos...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No hay contactos que coincidan con los filtros.</p> :
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Nombre', 'Cargo', 'Email', 'Teléfono', 'Tipo', 'Cliente', 'Proveedor', 'Estado', ''].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-900">{item.nombre}</td><td className="px-4 py-3">{item.cargo || '—'}</td><td className="px-4 py-3">{item.email || '—'}</td><td className="px-4 py-3">{item.telefono || '—'}</td><td className="px-4 py-3">{tipos.find(([value]) => value === item.tipo_contacto)?.[1] || item.tipo_contacto}</td><td className="px-4 py-3">{item.cliente_id ? clientesById.get(item.cliente_id) || '—' : '—'}</td><td className="px-4 py-3">{item.proveedor_id ? proveedoresById.get(item.proveedor_id) || '—' : '—'}</td><td className="px-4 py-3"><StatusBadge status={item.activo ? 'activo' : 'inactivo'} /></td><td className="px-4 py-3">{canEdit && <button onClick={() => edit(item)} className="font-semibold text-[#245C90] hover:underline">Editar</button>}</td></tr>)}</tbody></table></div>}
        </section>

        {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) closeForm() }}><form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{editingId ? 'Editar contacto' : 'Nuevo contacto'}</h2><button type="button" onClick={closeForm} className="text-sm text-slate-500">Cerrar</button></div><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *"><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="input" /></Field>
          <Field label="Cargo"><input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="input" /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="input" /></Field>
          <Field label="Cliente"><select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className="input"><option value="">Sin cliente</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></Field>
          <Field label="Proveedor"><select value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })} className="input"><option value="">Sin proveedor</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></Field>
          <Field label="Tipo de contacto"><select value={form.tipo_contacto} onChange={(e) => setForm({ ...form, tipo_contacto: e.target.value })} className="input">{tipos.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Estado"><select value={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.value })} className="input"><option value="true">Activo</option><option value="false">Inactivo</option></select></Field>
          <div className="sm:col-span-2"><Field label="Observaciones"><textarea rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="input" /></Field></div>
        </div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeForm} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Cancelar</button><button disabled={saving} className="rounded-xl bg-[#163A5F] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar contacto'}</button></div></form></div>}
        <style jsx>{`.input { width: 100%; border: 1px solid rgb(203 213 225); border-radius: .75rem; padding: .625rem .75rem; font-size: .875rem; background: white; }`}</style>
      </main>
    </ProtectedModuleRoute>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}</span>{children}</label>
}
