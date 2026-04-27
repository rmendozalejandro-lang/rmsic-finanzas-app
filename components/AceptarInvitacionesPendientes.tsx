'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase/client'

export default function AceptarInvitacionesPendientes() {
  useEffect(() => {
    const aceptarInvitaciones = async () => {
      const { data } = await supabase.auth.getSession()

      if (!data.session?.user) return

      const { error } = await supabase.rpc('aceptar_mis_invitaciones_empresa')

      if (error) {
        console.warn('No se pudieron aceptar invitaciones pendientes:', error.message)
      }
    }

    void aceptarInvitaciones()
  }, [])

  return null
}
