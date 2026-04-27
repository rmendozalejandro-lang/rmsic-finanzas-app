'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase/client'

type RespuestaInvitaciones = {
  invitaciones_aceptadas: number
  empresas_asociadas: number
}

export default function AceptarInvitacionesPendientes() {
  const procesandoRef = useRef(false)
  const usuarioProcesadoRef = useRef<string | null>(null)

  useEffect(() => {
    const aceptarInvitaciones = async () => {
      if (procesandoRef.current) return

      const { data } = await supabase.auth.getSession()
      const user = data.session?.user

      if (!user) return

      if (usuarioProcesadoRef.current === user.id) return

      procesandoRef.current = true
      usuarioProcesadoRef.current = user.id

      const { data: respuesta, error } = await supabase.rpc(
        'aceptar_mis_invitaciones_empresa'
      )

      procesandoRef.current = false

      if (error) {
        console.warn(
          'No se pudieron aceptar invitaciones pendientes:',
          error.message
        )
        return
      }

      const resultado = Array.isArray(respuesta)
        ? (respuesta[0] as RespuestaInvitaciones | undefined)
        : undefined

      const invitacionesAceptadas = resultado?.invitaciones_aceptadas ?? 0
      const empresasAsociadas = resultado?.empresas_asociadas ?? 0

      if (invitacionesAceptadas > 0 || empresasAsociadas > 0) {
        window.localStorage.removeItem('empresa_activa_id')
        window.localStorage.removeItem('empresa_activa_nombre')

        window.dispatchEvent(new Event('empresa-activa-cambiada'))

        window.location.reload()
      }
    }

    void aceptarInvitaciones()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void aceptarInvitaciones()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}