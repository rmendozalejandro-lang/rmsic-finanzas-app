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

const silhouetteStyle = {
  fill: '#f8fafc',
  stroke: '#334155',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function SiluetaLateral({ derecha }: { derecha: boolean }) {
  return (
    <g {...silhouetteStyle} transform={derecha ? 'translate(320 0) scale(-1 1)' : undefined}>
      <path d="M48 67 C38 64 28 57 21 48 C18 43 19 35 23 29 C29 37 37 42 47 44 C52 35 61 29 72 27 C79 20 88 18 97 21 C104 23 109 29 113 37 C131 40 149 39 169 36 C192 32 217 34 234 44 C244 50 250 59 257 65 C268 64 280 57 291 48 C295 54 294 62 288 68 C280 76 270 81 259 84 C251 91 245 99 239 108 L243 150 L250 158 L247 164 L224 164 L219 155 L221 112 L211 97 C191 101 169 103 148 100 L137 113 L134 151 L140 159 L136 164 L112 164 L106 156 L110 106 C100 101 90 97 79 94 C67 91 57 83 48 67 Z" />
      <path d="M48 67 C45 82 40 97 34 111 C29 124 25 138 24 153" fill="none" />
      <path d="M47 44 C57 49 64 57 67 68 M72 27 C82 29 90 35 94 44 M62 52 C65 48 70 47 74 50" fill="none" />
      <circle cx="71" cy="48" r="1.8" fill="#334155" stroke="none" />
      <path d="M105 47 C99 64 100 83 110 106 M113 37 C122 51 132 58 148 61 M148 100 C143 88 141 74 143 61 M211 97 C218 83 221 65 218 40 M234 44 C229 55 228 69 232 82 M221 112 L229 112 M110 106 L121 108" fill="none" />
      <path d="M106 156 L135 156 M221 155 L246 155 M257 65 C260 71 260 78 259 84" fill="none" />
      <path d="M25 151 C30 153 34 156 37 161 M24 153 C22 158 20 162 17 165" fill="none" />
    </g>
  )
}

function SiluetaCabezaFrontal() {
  return (
    <g {...silhouetteStyle}>
      <path d="M118 36 C109 27 96 19 80 14 C81 31 87 47 98 57 C94 73 94 91 99 111 C105 136 125 157 151 166 C157 168 163 168 169 166 C195 157 215 136 221 111 C226 91 226 73 222 57 C233 47 239 31 240 14 C224 19 211 27 202 36 C190 26 176 22 160 22 C144 22 130 26 118 36 Z" />
      <path d="M98 57 C107 49 113 42 118 36 M222 57 C213 49 207 42 202 36 M160 23 L160 111" fill="none" />
      <path d="M107 77 C118 70 132 72 141 80 M213 77 C202 70 188 72 179 80" fill="none" />
      <path d="M109 84 C119 89 130 89 139 84 M211 84 C201 89 190 89 181 84" fill="none" />
      <circle cx="126" cy="82" r="2.2" fill="#334155" stroke="none" />
      <circle cx="194" cy="82" r="2.2" fill="#334155" stroke="none" />
      <path d="M125 131 C133 143 145 149 160 150 C175 149 187 143 195 131 M136 132 C141 127 147 127 151 132 M184 132 C179 127 173 127 169 132" fill="none" />
      <path d="M101 109 C113 114 123 114 133 110 M219 109 C207 114 197 114 187 110" fill="none" />
    </g>
  )
}

function SiluetaCabezaPerfil() {
  return (
    <g {...silhouetteStyle}>
      <path d="M94 41 C96 27 102 16 112 9 C120 22 124 34 124 46 C144 27 170 20 196 29 C214 35 225 48 230 63 C239 70 252 78 267 84 C259 96 248 103 234 106 C225 119 213 128 196 132 C191 147 179 158 163 166 L119 160 C111 146 105 132 103 117 C96 105 91 91 92 76 C83 65 78 53 78 41 C83 39 89 39 94 41 Z" />
      <path d="M94 41 C105 44 115 47 124 46 M103 117 C118 126 136 132 155 131 M196 132 C179 129 164 123 153 114" fill="none" />
      <path d="M124 46 C134 52 141 60 144 70 M139 73 C151 66 166 67 176 76 C165 83 151 84 140 79" fill="none" />
      <circle cx="159" cy="76" r="2.2" fill="#334155" stroke="none" />
      <path d="M230 63 C221 72 219 82 222 92 M234 106 C225 102 216 99 208 98 M246 91 C251 91 255 93 258 96" fill="none" />
      <path d="M117 159 C125 149 129 137 128 125 M163 166 C158 151 157 140 160 127" fill="none" />
    </g>
  )
}

function SiluetaExtremidades({ posteriores }: { posteriores: boolean }) {
  return (
    <g {...silhouetteStyle}>
      {posteriores ? (
        <>
          <path d="M91 27 C107 16 130 11 160 13 C190 11 213 16 229 27 C231 47 226 67 214 82 C207 96 205 116 207 143 L218 157 L214 165 L181 165 L176 157 L177 116 C172 105 166 96 160 88 C154 96 148 105 143 116 L144 157 L139 165 L106 165 L102 157 L113 143 C115 116 113 96 106 82 C94 67 89 47 91 27 Z" />
          <path d="M160 14 C151 36 151 65 160 88 C169 65 169 36 160 14 M106 82 C123 88 140 88 160 80 C180 88 197 88 214 82" fill="none" />
          <path d="M113 143 L143 143 M177 143 L207 143 M105 157 L143 157 M177 157 L215 157" fill="none" />
        </>
      ) : (
        <>
          <path d="M111 18 C126 11 143 9 160 11 C177 9 194 11 209 18 L216 55 C211 71 203 84 193 94 L197 146 L207 158 L203 165 L174 165 L168 157 L170 99 C166 94 163 89 160 83 C157 89 154 94 150 99 L152 157 L146 165 L117 165 L113 158 L123 146 L127 94 C117 84 109 71 104 55 Z" />
          <path d="M111 18 C121 31 128 47 128 65 M209 18 C199 31 192 47 192 65 M127 94 C138 89 149 85 160 83 C171 85 182 89 193 94" fill="none" />
          <path d="M123 146 L151 146 M169 146 L197 146 M115 158 L151 158 M169 158 L205 158" fill="none" />
        </>
      )}
    </g>
  )
}

function Silueta({ vista }: { vista: Vista }) {
  return (
    <svg viewBox="0 0 320 180" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      {vista === 'cabeza_frontal' ? <SiluetaCabezaFrontal />
        : vista === 'cabeza_perfil' ? <SiluetaCabezaPerfil />
          : vista === 'manos_posterior' ? <SiluetaExtremidades posteriores={false} />
            : vista === 'patas_posterior' ? <SiluetaExtremidades posteriores />
              : <SiluetaLateral derecha={vista === 'lateral_derecha'} />}
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
