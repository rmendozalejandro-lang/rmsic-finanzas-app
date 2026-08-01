'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import ModuleAccessGuard from '@/components/ModuleAccessGuard'
import { supabase } from '@/lib/supabase/client'

const EMPRESA_KEY = 'empresa_activa_id'
const categorias = ['yegua', 'cria', 'año', 'potro', 'chileno', 'otro'] as const
const estados = ['activo', 'inactivo', 'fallecido', 'vendido'] as const
const sexos = ['hembra', 'macho', 'desconocido'] as const

type Animal = {
  id: string
  nombre: string
  categoria: (typeof categorias)[number]
  sexo: (typeof sexos)[number] | null
  fecha_nacimiento: string | null
  madre_id: string | null
  padre_id: string | null
  identificador: string | null
  estado: (typeof estados)[number]
  observaciones: string | null
}

type AnimalForm = {
  nombre: string
  categoria: Animal['categoria']
  sexo: NonNullable<Animal['sexo']>
  fecha_nacimiento: string
  madre_id: string
  padre_id: string
  identificador: string
  estado: Animal['estado']
  observaciones: string
}

const emptyForm: AnimalForm = {
  nombre: '', categoria: 'otro', sexo: 'desconocido', fecha_nacimiento: '',
  madre_id: '', padre_id: '', identificador: '', estado: 'activo', observaciones: '',
}

const labels: Record<string, string> = {
  cria: 'Cría', 'año': 'Año', yegua: 'Yegua', potro: 'Potro', chileno: 'Chileno',
  otro: 'Otro', hembra: 'Hembra', macho: 'Macho', desconocido: 'Desconocido',
  activo: 'Activo', inactivo: 'Inactivo', fallecido: 'Fallecido', vendido: 'Vendido',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL').format(new Date(`${value}T00:00:00`))
}

export default function AnimalesPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [animales, setAnimales] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AnimalForm>(emptyForm)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setEmpresaId(window.localStorage.getItem(EMPRESA_KEY))
  }, [])

  const loadAnimals = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('vet_animales')
      .select('id, nombre, categoria, sexo, fecha_nacimiento, madre_id, padre_id, identificador, estado, observaciones')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (queryError) setError(`No fue posible cargar los ejemplares: ${queryError.message}`)
    else setAnimales((data ?? []) as Animal[])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { void loadAnimals() }, [loadAnimals])

  const animalNames = useMemo(() => new Map(animales.map((animal) => [animal.id, animal.nombre])), [animales])
  const filteredAnimals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    return animales.filter((animal) =>
      (!query || animal.nombre.toLocaleLowerCase('es').includes(query)) &&
      (!categoryFilter || animal.categoria === categoryFilter) &&
      (!statusFilter || animal.estado === statusFilter))
  }, [animales, categoryFilter, search, statusFilter])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function openEdit(animal: Animal) {
    setEditingId(animal.id)
    setForm({
      nombre: animal.nombre, categoria: animal.categoria, sexo: animal.sexo ?? 'desconocido',
      fecha_nacimiento: animal.fecha_nacimiento ?? '', madre_id: animal.madre_id ?? '',
      padre_id: animal.padre_id ?? '', identificador: animal.identificador ?? '',
      estado: animal.estado, observaciones: animal.observaciones ?? '',
    })
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  async function saveAnimal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!empresaId) return setError('Selecciona una empresa activa antes de guardar.')
    if (!form.nombre.trim()) return setError('El nombre del ejemplar es obligatorio.')
    if (form.madre_id && form.madre_id === form.padre_id) return setError('Madre y padre deben ser ejemplares distintos.')

    setSaving(true)
    setError(null)
    setSuccess(null)
    const payload = {
      empresa_id: empresaId,
      nombre: form.nombre.trim(), categoria: form.categoria, sexo: form.sexo,
      fecha_nacimiento: form.fecha_nacimiento || null, madre_id: form.madre_id || null,
      padre_id: form.padre_id || null, identificador: form.identificador.trim() || null,
      estado: form.estado, observaciones: form.observaciones.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const response = editingId
      ? await supabase.from('vet_animales').update(payload).eq('id', editingId).eq('empresa_id', empresaId)
      : await supabase.from('vet_animales').insert(payload)

    if (response.error) {
      const duplicate = response.error.code === '23505'
      setError(duplicate ? 'El identificador o microchip ya está registrado en esta empresa.' : `No fue posible guardar: ${response.error.message}`)
    } else {
      setSuccess(editingId ? 'Ejemplar actualizado correctamente.' : 'Ejemplar creado correctamente.')
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await loadAnimals()
    }
    setSaving(false)
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

  return (
    <ModuleAccessGuard moduleKey="haras">
      <main className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-5 rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Tralixia Haras</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Animales / Ejemplares</h1>
              <p className="mt-2 text-sm text-slate-300">Registro, identificación y genealogía de los animales del haras.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/haras" className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-slate-800">Volver a Haras</Link>
              <button type="button" onClick={openNew} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Nuevo ejemplar</button>
            </div>
          </header>

          {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
          {success && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

          {showForm && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="animal-form-title">
              <div className="flex items-center justify-between">
                <h2 id="animal-form-title" className="text-xl font-semibold text-slate-900">{editingId ? 'Editar ejemplar' : 'Nuevo ejemplar'}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-sm font-medium text-slate-600 hover:text-slate-950">Cerrar</button>
              </div>
              <form onSubmit={saveAnimal} className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Nombre <span className="text-red-600">*</span><input value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className={inputClass} required /></label>
                <label className="text-sm font-medium text-slate-700">Categoría<select value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value as Animal['categoria']})} className={inputClass}>{categorias.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Sexo<select value={form.sexo} onChange={(e) => setForm({...form, sexo: e.target.value as AnimalForm['sexo']})} className={inputClass}>{sexos.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Fecha de nacimiento<input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({...form, fecha_nacimiento: e.target.value})} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Madre<select value={form.madre_id} onChange={(e) => setForm({...form, madre_id: e.target.value})} className={inputClass}><option value="">Sin registrar</option>{animales.filter((a) => a.id !== editingId && a.sexo !== 'macho').map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Padre<select value={form.padre_id} onChange={(e) => setForm({...form, padre_id: e.target.value})} className={inputClass}><option value="">Sin registrar</option>{animales.filter((a) => a.id !== editingId && a.sexo !== 'hembra').map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Identificador / microchip<input value={form.identificador} onChange={(e) => setForm({...form, identificador: e.target.value})} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Estado<select value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value as Animal['estado']})} className={inputClass}>{estados.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2 lg:col-span-3">Observaciones<textarea rows={3} value={form.observaciones} onChange={(e) => setForm({...form, observaciones: e.target.value})} className={inputClass} /></label>
                <div className="flex gap-3 md:col-span-2 lg:col-span-3">
                  <button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar ejemplar'}</button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                </div>
              </form>
            </section>
          )}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="listado-title">
            <div className="border-b border-slate-200 p-5">
              <h2 id="listado-title" className="text-xl font-semibold text-slate-900">Ejemplares registrados</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Buscar por nombre<input type="search" placeholder="Nombre del ejemplar" value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} /></label>
                <label className="text-sm font-medium text-slate-700">Categoría<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}><option value="">Todas</option>{categorias.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Estado<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}><option value="">Todos</option>{estados.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Nombre', 'Categoría', 'Sexo', 'Fecha nacimiento', 'Madre', 'Padre', 'Identificador / microchip', 'Estado', 'Acciones'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? <tr><td colSpan={9} className="px-4 py-10 text-center">Cargando ejemplares…</td></tr> : filteredAnimals.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No hay ejemplares que coincidan con los filtros.</td></tr> : filteredAnimals.map((animal) => (
                    <tr key={animal.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{animal.nombre}</td><td className="whitespace-nowrap px-4 py-3">{labels[animal.categoria]}</td><td className="whitespace-nowrap px-4 py-3">{labels[animal.sexo ?? 'desconocido']}</td><td className="whitespace-nowrap px-4 py-3">{formatDate(animal.fecha_nacimiento)}</td><td className="whitespace-nowrap px-4 py-3">{animal.madre_id ? animalNames.get(animal.madre_id) ?? '—' : '—'}</td><td className="whitespace-nowrap px-4 py-3">{animal.padre_id ? animalNames.get(animal.padre_id) ?? '—' : '—'}</td><td className="whitespace-nowrap px-4 py-3">{animal.identificador || '—'}</td><td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{labels[animal.estado]}</span></td><td className="px-4 py-3"><button type="button" onClick={() => openEdit(animal)} className="font-semibold text-emerald-700 hover:text-emerald-900">Editar</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </ModuleAccessGuard>
  )
}
