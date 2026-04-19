'use client'

import { ReactNode } from 'react'
import ModuleAccessGuard from './ModuleAccessGuard'
import type { ModuleKey } from '@/lib/auth/permissions'

type Props = {
  moduleKey: ModuleKey
  children: ReactNode
}

export default function ProtectedModuleRoute({
  moduleKey,
  children,
}: Props) {
  return (
    <ModuleAccessGuard moduleKey={moduleKey}>
      {children}
    </ModuleAccessGuard>
  )
}