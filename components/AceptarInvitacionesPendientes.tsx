'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase/client'

type RespuestaInvitaciones = {
  invitaciones_aceptadas: number
  empresas_asociadas: number
}

export default function AceptarInvitacionesPendientes() {
  const procesandoRef = useRef(false)
  const recargoRef = useRef(false)

  useEffect(() => {
    const aceptarInvitaciones = async () => {
      if (procesandoRef.current || recargoRef.current) return

      procesandoRef.current = true

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession()

        if (sessionError) {
          console.warn('No se pudo obtener sesión:', sessionError.message)
          return
        }

        const user = sessionData.session?.user

        if (!user) return

        const { data: respuesta, error } = await supabase.rpc(
          'aceptar_mis_invitaciones_empresa'
        )

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
          recargoRef.current = true

          window.localStorage.removeItem('empresa_activa_id')
          window.localStorage.removeItem('empresa_activa_nombre')

          window.dispatchEvent(new Event('empresa-activa-cambiada'))

          window.setTimeout(() => {
            window.location.reload()
          }, 500)
        }
      } catch (err) {
        console.warn('Error inesperado aceptando invitaciones:', err)
      } finally {
        procesandoRef.current = false
      }
    }

    void aceptarInvitaciones()

    const timeout1 = window.setTimeout(() => {
      void aceptarInvitaciones()
    }, 1000)

    const timeout2 = window.setTimeout(() => {
      void aceptarInvitaciones()
    }, 3000)

    const timeout3 = window.setTimeout(() => {
      void aceptarInvitaciones()
    }, 6000)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        void aceptarInvitaciones()
      }, 500)
    })

    return () => {
      window.clearTimeout(timeout1)
      window.clearTimeout(timeout2)
      window.clearTimeout(timeout3)
      subscription.unsubscribe()
    }
  }, [])

  return null
}