'use client'

import { MouseEvent, useState } from 'react'
import Image from 'next/image'

export const vistas = ['lateral_izquierda', 'lateral_derecha', 'cabeza_frontal', 'cabeza_perfil', 'manos_posterior', 'patas_posterior'] as const
export const tiposMarca = ['remolino', 'mancha_blanca', 'mancha_negra', 'cicatriz', 'marca_piel', 'otro'] as const

export type Vista = (typeof vistas)[number]
export type TipoMarca = (typeof tiposMarca)[number]
export type Marca = { id: string; vista: Vista; tipo_marca: TipoMarca; x: number; y: number; descripcion: string }

const nombresVista: Record<Vista, string> = {
  lateral_izquierda: 'Lateral izquierda', lateral_derecha: 'Lateral derecha',
  cabeza_frontal: 'Cabeza frontal', cabeza_perfil: 'Perfil cabeza',
  manos_posterior: 'Vista posterior manos', patas_posterior: 'Vista posterior patas',
}
const nombresMarca: Record<TipoMarca, string> = {
  remolino: 'Remolino', mancha_blanca: 'Mancha blanca', mancha_negra: 'Mancha negra',
  cicatriz: 'Cicatriz', marca_piel: 'Marca de piel', otro: 'Otra',
}
const colores: Record<TipoMarca, string> = {
  remolino: '#0f766e', mancha_blanca: '#ffffff', mancha_negra: '#0f172a',
  cicatriz: '#dc2626', marca_piel: '#d97706', otro: '#7c3aed',
}

const imagenesVista: Record<Vista, string> = {
  lateral_izquierda: '/haras/siluetas/lateral-izquierda.png',
  lateral_derecha: '/haras/siluetas/lateral-derecha.png',
  cabeza_frontal: '/haras/siluetas/cabeza-frontal.png',
  cabeza_perfil: '/haras/siluetas/cabeza-perfil.png',
  manos_posterior: '/haras/siluetas/manos-posterior.png',
  patas_posterior: '/haras/siluetas/patas-posterior.png',
}

function Silueta({ vista }: { vista: Vista }) {
  const [noDisponible, setNoDisponible] = useState(false)

  if (noDisponible) {
    return (
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium text-slate-400">
        Silueta no disponible
      </span>
    )
  }

  return (
    <Image
      src={imagenesVista[vista]}
      alt=""
      fill
      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
      onError={() => setNoDisponible(true)}
      className="pointer-events-none object-contain p-2"
    />
  )
}

export default function MarcacionEjemplar({ marcas, onChange }: { marcas: Marca[]; onChange: (marcas: Marca[]) => void }) {
  const [tipo, setTipo] = useState<TipoMarca>('remolino')
  const [descripcion, setDescripcion] = useState('')

  function addMark(event: MouseEvent<HTMLButtonElement>, vista: Vista) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    onChange([...marcas, { id: crypto.randomUUID(), vista, tipo_marca: tipo, x, y, descripcion: descripcion.trim() }])
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Tipo de marca
          <select value={tipo} onChange={(event) => setTipo(event.target.value as TipoMarca)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
            {tiposMarca.map((value) => <option key={value} value={value}>{nombresMarca[value]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Descripción para la próxima marca
          <input value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Ej.: remolino pequeño" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        </label>
      </div>
      <p className="mt-3 text-sm text-slate-600">Selecciona un tipo y haz clic en la ubicación de la seña. Las coordenadas se guardan de forma relativa.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vistas.map((vista) => (
          <article key={vista} className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="text-sm font-semibold text-slate-800">{nombresVista[vista]}</h4>
            <button type="button" onClick={(event) => addMark(event, vista)} aria-label={`Agregar ${nombresMarca[tipo].toLowerCase()} en ${nombresVista[vista].toLowerCase()}`} className="relative mt-2 block aspect-[16/9] w-full cursor-crosshair overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <Silueta vista={vista} />
              {marcas.filter((marca) => marca.vista === vista).map((marca) => (
                <span key={marca.id} title={`${nombresMarca[marca.tipo_marca]}${marca.descripcion ? `: ${marca.descripcion}` : ''}`} className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-slate-600" style={{ left: `${marca.x * 100}%`, top: `${marca.y * 100}%`, backgroundColor: colores[marca.tipo_marca] }} />
              ))}
            </button>
          </article>
        ))}
      </div>
      {marcas.length > 0 && <div className="mt-5 space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Marcas registradas ({marcas.length})</h4>
        {marcas.map((marca) => <div key={marca.id} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_2fr_auto]">
          <span className="text-sm font-medium text-slate-700"><span className="mr-2 inline-block h-3 w-3 rounded-full ring-1 ring-slate-400" style={{ backgroundColor: colores[marca.tipo_marca] }} />{nombresMarca[marca.tipo_marca]} · {nombresVista[marca.vista]}</span>
          <input aria-label={`Descripción de ${nombresMarca[marca.tipo_marca]}`} value={marca.descripcion} onChange={(event) => onChange(marcas.map((item) => item.id === marca.id ? {...item, descripcion: event.target.value} : item))} placeholder="Descripción opcional" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => onChange(marcas.filter((item) => item.id !== marca.id))} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Eliminar</button>
        </div>)}
      </div>}
    </div>
  )
}
