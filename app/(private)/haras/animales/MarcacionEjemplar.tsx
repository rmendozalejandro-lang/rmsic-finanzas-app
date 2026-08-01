'use client'

import { MouseEvent, useState } from 'react'

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

function Silueta({ vista }: { vista: Vista }) {
  const cabeza = vista === 'cabeza_frontal' || vista === 'cabeza_perfil'
  const posterior = vista === 'manos_posterior' || vista === 'patas_posterior'
  return (
    <svg viewBox="0 0 320 180" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      {cabeza ? (
        <g fill="#e2e8f0" stroke="#64748b" strokeWidth="3">
          <path d={vista === 'cabeza_frontal' ? 'M112 25 L75 8 93 61 Q90 135 160 165 Q230 135 227 61 L245 8 208 25 Q160 5 112 25Z' : 'M103 24 Q184 0 222 48 L265 82 224 112 188 106 Q180 151 120 160 L91 113 108 73 78 39Z'} />
        </g>
      ) : posterior ? (
        <g fill="#e2e8f0" stroke="#64748b" strokeWidth="3">
          <path d="M83 18 Q160 -1 237 18 L224 73 205 91 214 165 180 165 169 91 151 91 140 165 106 165 115 91 96 73Z" />
          <path d="M160 18 Q166 63 160 92" fill="none" />
        </g>
      ) : (
        <g fill="#e2e8f0" stroke="#64748b" strokeWidth="3" transform={vista === 'lateral_derecha' ? 'translate(320 0) scale(-1 1)' : undefined}>
          <path d="M44 54 L17 32 20 73 53 89 Q74 105 99 98 L107 160 127 160 137 96 207 98 219 160 239 160 245 91 Q272 81 291 57 L277 30 253 43 225 67 136 50 82 48Z" />
          <path d="M55 88 Q33 112 21 151" fill="none" />
        </g>
      )}
    </svg>
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
            <button type="button" onClick={(event) => addMark(event, vista)} aria-label={`Agregar ${nombresMarca[tipo].toLowerCase()} en ${nombresVista[vista].toLowerCase()}`} className="relative mt-2 block aspect-[16/9] w-full cursor-crosshair overflow-hidden rounded-lg border border-dashed border-slate-300 bg-gradient-to-b from-sky-50 to-emerald-50">
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
