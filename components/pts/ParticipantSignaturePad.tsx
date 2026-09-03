'use client'

import { PointerEvent, useMemo, useRef, useState } from 'react'

type Point = { x: number; y: number }
type Stroke = Point[]

type Props = {
  disabled?: boolean
  saving?: boolean
  onSubmit: (strokes: Stroke[]) => Promise<void> | void
}

export default function ParticipantSignaturePad({ disabled = false, saving = false, onSubmit }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drawingRef = useRef(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [accepted, setAccepted] = useState(false)

  const currentPath = useMemo(
    () => strokes.map((stroke) => stroke.map((point) => `${point.x},${point.y}`).join(' ')),
    [strokes]
  )

  const pointFromEvent = (event: PointerEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: Number((((event.clientX - rect.left) / rect.width) * 1000).toFixed(2)),
      y: Number((((event.clientY - rect.top) / rect.height) * 300).toFixed(2)),
    }
  }

  const start = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || saving) return
    const point = pointFromEvent(event)
    if (!point) return
    drawingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setStrokes((current) => [...current, [point]])
  }

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || disabled || saving) return
    const point = pointFromEvent(event)
    if (!point) return
    setStrokes((current) => {
      if (!current.length) return current
      const next = current.slice()
      const last = next[next.length - 1]
      const previous = last[last.length - 1]
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return current
      next[next.length - 1] = [...last, point].slice(0, 500)
      return next.slice(0, 20)
    })
  }

  const stop = () => {
    drawingRef.current = false
    setStrokes((current) => current.filter((stroke) => stroke.length >= 2))
  }

  const limpiar = () => {
    if (disabled || saving) return
    setStrokes([])
    setAccepted(false)
  }

  const guardar = async () => {
    if (disabled || saving || !accepted || strokes.length === 0) return
    await onSubmit(strokes)
    setStrokes([])
    setAccepted(false)
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 300"
          role="img"
          aria-label="Área para firma manuscrita"
          className="h-44 w-full touch-none select-none bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
        >
          <line x1="40" y1="250" x2="960" y2="250" stroke="currentColor" strokeWidth="1" className="text-slate-200" />
          {currentPath.map((points, index) => (
            <polyline
              key={index}
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-900"
            />
          ))}
        </svg>
      </div>
      <p className="text-xs text-slate-500">Firma dentro del recuadro con el dedo, lápiz o mouse.</p>
      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          disabled={disabled || saving}
          className="mt-0.5 h-4 w-4"
        />
        <span>Declaro haber leído y comprendido los riesgos, controles y condiciones de este PTS, y me comprometo a cumplirlos durante la ejecución del trabajo.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={limpiar} disabled={disabled || saving || strokes.length === 0} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Limpiar firma</button>
        <button type="button" onClick={guardar} disabled={disabled || saving || strokes.length === 0 || !accepted} className="rounded-xl bg-[#18B7A8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Guardando firma...' : 'Aceptar y firmar'}</button>
      </div>
    </div>
  )
}
