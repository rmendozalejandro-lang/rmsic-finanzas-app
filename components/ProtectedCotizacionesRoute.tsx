'use client'

import { ReactNode } from 'react'
import ModuleAccessGuard from './ModuleAccessGuard'

type Props = {
  children: ReactNode
}

export default function ProtectedCotizacionesRoute({ children }: Props) {
  return (
    <ModuleAccessGuard moduleKey="cotizaciones">
      {children}
    </ModuleAccessGuard>
  )
}