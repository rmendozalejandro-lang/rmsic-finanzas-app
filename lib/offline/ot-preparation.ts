export const OT_TERRAIN_PREPARATION_LIMIT = 50
export const OT_OPERATIVE_STATE_FILTER =
  'estado_nombre.is.null,and(estado_nombre.not.ilike.%cerrad%,estado_nombre.not.ilike.%anulad%,estado_nombre.not.ilike.%archivad%)'

type OperativeQuery = {
  is: (column: string, value: null) => OperativeQuery
  or: (filters: string) => OperativeQuery
}

export function filterOTOperativeQuery<T>(query: T): T {
  return (query as T & OperativeQuery)
    .is('fecha_cierre', null)
    .or(OT_OPERATIVE_STATE_FILTER) as T
}

export class OTPreparationContextLock {
  private readonly activeContexts = new Set<string>()

  static key(empresaId: string, userId: string) {
    return `${empresaId}:${userId}`
  }

  acquire(empresaId: string, userId: string) {
    const key = OTPreparationContextLock.key(empresaId, userId)
    if (this.activeContexts.has(key)) return false
    this.activeContexts.add(key)
    return true
  }

  release(empresaId: string, userId: string) {
    this.activeContexts.delete(OTPreparationContextLock.key(empresaId, userId))
  }
}

export function isActiveOTPreparationContext(
  preparationContextKey: string,
  activeContextKey: string,
) {
  return preparationContextKey === activeContextKey
}

export function buildOTPreparationFailureState(input: {
  empresaId: string
  userId: string
  lastAttemptAt: string
  lastSuccessAt: string | null
  cachedCount: number | null
  previousCount: number
  error: string
}) {
  return {
    empresa_id: input.empresaId,
    user_id: input.userId,
    status: 'error' as const,
    last_attempt_at: input.lastAttemptAt,
    last_success_at: input.lastSuccessAt,
    prepared_count: input.cachedCount ?? input.previousCount,
    error: input.error,
  }
}
