'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import PTSPdfButton from './PTSPdfButton'
import { supabase } from '../../lib/supabase/client'

const STORAGE_KEY = 'empresa_activa_id'

export default function PTSPdfContextAction() {
  const pathname = usePathname()
  const match = pathname.match(/^\/seguridad\/pts\/([0-9a-f-]{36})$/i)
  const permisoId = match?.[1] || ''
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setVisible(false)
      if (!permisoId) return
      const empresaId = window.localStorage.getItem(STORAGE_KEY) || ''
      if (!empresaId) return

      const { data } = await supabase
        .from('pts_permisos')
        .select('estado')
        .eq('id', permisoId)
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (active) setVisible(Boolean(data && ['aprobado', 'en_ejecucion', 'cerrado'].includes(data.estado)))
    }

    void load()
    return () => { active = false }
  }, [permisoId])

  if (!visible || !permisoId) return null
  return <PTSPdfButton permisoId={permisoId} />
}
