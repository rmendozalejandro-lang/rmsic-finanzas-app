'use client'

import { useEffect, useState } from 'react'

const STORAGE_ID_KEY = 'empresa_activa_id'
const STORAGE_NAME_KEY = 'empresa_activa_nombre'

type EmpresaActivaBannerProps = {
  modulo: string
  descripcion?: string
}

export default function EmpresaActivaBanner({
  modulo,
  descripcion,
}: EmpresaActivaBannerProps) {
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')

  useEffect(() => {
    const syncEmpresaActiva = () => {
      setEmpresaId(window.localStorage.getItem(STORAGE_ID_KEY) || '')
      setEmpresaNombre(window.localStorage.getItem(STORAGE_NAME_KEY) || '')
    }

    syncEmpresaActiva()
    window.addEventListener('empresa-activa-cambiada', syncEmpresaActiva)

    return () => {
      window.removeEventListener('empresa-activa-cambiada', syncEmpresaActiva)
    }
  }, [])

  if (!empresaId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          Contexto activo
        </p>
        <h2 className="mt-1 text-lg font-semibold text-amber-900">{modulo}</h2>
        <p className="mt-2 text-sm text-amber-800">
          No hay una empresa activa seleccionada.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            Contexto activo
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {modulo}
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Empresa activa:{' '}
            <span className="font-semibold">
              {empresaNombre || empresaId}
            </span>
          </p>
        </div>

        {descripcion ? (
          <p className="max-w-2xl text-sm text-slate-600">{descripcion}</p>
        ) : null}
      </div>
    </section>
  )
}