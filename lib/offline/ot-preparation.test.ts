import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOTPreparationFailureState,
  filterOTOperativeQuery,
  isActiveOTPreparationContext,
  OT_OPERATIVE_STATE_FILTER,
  OTPreparationContextLock,
  OT_TERRAIN_PREPARATION_LIMIT,
} from './ot-preparation'

type FakeOT = { id: string; estado_nombre: string; fecha_cierre: string | null }

class FakeOTQuery {
  rows: FakeOT[]
  calls: string[]

  constructor(rows: FakeOT[], calls: string[] = []) {
    this.rows = rows
    this.calls = calls
  }

  is(column: string, value: null) {
    this.calls.push(`is:${column}:${value}`)
    this.rows = this.rows.filter((row) => row.fecha_cierre === value)
    return this
  }

  or(filters: string) {
    this.calls.push(`or:${filters}`)
    const excludedStateFragments = ['cerrad', 'anulad', 'archivad'].filter((fragment) =>
      filters.includes(`estado_nombre.not.ilike.%${fragment}%`)
    )
    this.rows = this.rows.filter((row) =>
      !excludedStateFragments.some((fragment) => row.estado_nombre.toLowerCase().includes(fragment))
    )
    return this
  }

  limit(value: number) {
    this.calls.push(`limit:${value}`)
    this.rows = this.rows.slice(0, value)
    return this
  }
}

test('filtra OT operativas en servidor antes de limitar las 50 más recientes', () => {
  const rows: FakeOT[] = [
    ...Array.from({ length: 50 }, (_, index) => ({
      id: `cerrada-${index}`,
      estado_nombre: 'Cerrada',
      fecha_cierre: '2026-08-18',
    })),
    { id: 'cerrada-sin-fecha', estado_nombre: 'Cerrada', fecha_cierre: null },
    { id: 'anulada-sin-fecha', estado_nombre: 'Anulada', fecha_cierre: null },
    { id: 'archivada-sin-fecha', estado_nombre: 'Archivada', fecha_cierre: null },
    { id: 'operativa-anterior', estado_nombre: 'Asignada', fecha_cierre: null },
  ]
  const query = new FakeOTQuery(rows)

  filterOTOperativeQuery(query).limit(OT_TERRAIN_PREPARATION_LIMIT)

  assert.deepEqual(query.rows.map((row) => row.id), ['operativa-anterior'])
  assert.deepEqual(query.calls, [
    'is:fecha_cierre:null',
    `or:${OT_OPERATIVE_STATE_FILTER}`,
    'limit:50',
  ])
})

test('un fallo conserva la referencia a la última copia válida', () => {
  const result = buildOTPreparationFailureState({
    empresaId: 'empresa-a',
    userId: 'usuario',
    lastAttemptAt: '2026-08-18T12:05:00.000Z',
    lastSuccessAt: '2026-08-18T12:00:00.000Z',
    cachedCount: 7,
    previousCount: 5,
    error: 'fallo controlado',
  })

  assert.equal(result.status, 'error')
  assert.equal(result.last_success_at, '2026-08-18T12:00:00.000Z')
  assert.equal(result.prepared_count, 7)
})

test('permite preparar dos empresas a la vez pero no duplica el mismo contexto', () => {
  const lock = new OTPreparationContextLock()

  assert.equal(lock.acquire('empresa-a', 'usuario'), true)
  assert.equal(lock.acquire('empresa-a', 'usuario'), false)
  assert.equal(lock.acquire('empresa-b', 'usuario'), true)
  lock.release('empresa-a', 'usuario')
  assert.equal(lock.acquire('empresa-a', 'usuario'), true)
})

test('una preparación antigua no puede publicar el terrain context de otra empresa', () => {
  const oldContext = OTPreparationContextLock.key('empresa-a', 'usuario')

  assert.equal(isActiveOTPreparationContext(oldContext, OTPreparationContextLock.key('empresa-a', 'usuario')), true)
  assert.equal(isActiveOTPreparationContext(oldContext, OTPreparationContextLock.key('empresa-b', 'usuario')), false)
})
