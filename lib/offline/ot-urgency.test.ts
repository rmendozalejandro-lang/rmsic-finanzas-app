import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'
import { buildUrgencyOfflineUpdate, syncUrgencyOffline, type OTUrgencySyncPayload } from './ot-urgency'

test('maps every urgency field to real columns without offline metadata', () => {
  const update = buildUrgencyOfflineUpdate({
    problema_reportado: ' Problema ', causa_probable: ' Causa ', trabajo_realizado: ' Solución ',
    resultado_servicio: ' Operativo ', recomendaciones: ' Revisar en 30 días ',
    fecha_ot: '2026-08-19', hora_inicio: '09:15', hora_termino: '10:45',
  })
  assert.deepEqual(update, {
    problema_reportado: 'Problema', causa_probable: 'Causa', trabajo_realizado: 'Solución',
    resultado_servicio: 'Operativo', recomendaciones: 'Revisar en 30 días',
    hora_inicio: '2026-08-19T13:15:00.000Z', hora_termino: '2026-08-19T14:45:00.000Z', duracion_minutos: 90,
  })
  assert.doesNotMatch(JSON.stringify(update), /avance registrado offline|fecha sincronización|estado local|notas internas/i)
})

test('uses Santiago time independently of the process timezone', () => {
  const helperPath = resolve(__dirname, 'ot-urgency.js')
  const runner = `const { buildUrgencyOfflineUpdate } = require(${JSON.stringify(helperPath)}); process.stdout.write(buildUrgencyOfflineUpdate({ fecha_ot: '2026-01-15', hora_inicio: '09:00', hora_termino: '10:00' }).hora_inicio)`
  const values = ['UTC', 'America/New_York', 'Asia/Tokyo'].map((TZ) => {
    const result = spawnSync(process.execPath, ['-e', runner], { encoding: 'utf8', env: { ...process.env, TZ } })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  })
  assert.deepEqual(values, Array(3).fill('2026-01-15T12:00:00.000Z'))
})

test('rolls an urgency end time into the next Chilean calendar day', () => {
  const update = buildUrgencyOfflineUpdate({ fecha_ot: '2026-08-19', hora_inicio: '23:30', hora_termino: '01:00' })
  assert.equal(update.duracion_minutos, 90)
  assert.ok(new Date(String(update.hora_termino)) > new Date(String(update.hora_inicio)))
})

test('rejects equal urgency times', () => {
  assert.throws(() => buildUrgencyOfflineUpdate({ fecha_ot: '2026-08-19', hora_inicio: '09:00', hora_termino: '09:00' }), /debe ser distinta/)
})

const payload: OTUrgencySyncPayload = {
  ot_id: 'ot-1', empresa_id: 'empresa-1', user_id: 'user-1', base_updated_at: '2026-08-19T12:00:00.000Z',
  fecha_ot: '2026-08-19', hora_inicio: '09:00', hora_termino: '10:00',
  problema_reportado: 'Problema', causa_probable: 'Causa', trabajo_realizado: 'Solución',
  resultado_servicio: 'Resultado', recomendaciones: 'Recomendaciones',
}

test('successful atomic urgency sync uses version filters then removes draft and queue', async () => {
  const calls: string[] = []
  let filters: unknown
  await syncUrgencyOffline(payload, 'queue-1', {
    updateOT: async (_values, receivedFilters) => { calls.push('update'); filters = receivedFilters; return { data: { id: payload.ot_id }, error: null } },
    removeDraft: () => calls.push('draft'), removeQueueItem: () => calls.push('queue'),
  })
  assert.deepEqual(filters, { id: payload.ot_id, empresa_id: payload.empresa_id, updated_at: payload.base_updated_at })
  assert.deepEqual(calls, ['update', 'draft', 'queue'])
})

test('version conflict preserves urgency draft and queue', async () => {
  let removed = false
  await assert.rejects(syncUrgencyOffline(payload, 'queue-1', {
    updateOT: async () => ({ data: null, error: null }), removeDraft: () => { removed = true }, removeQueueItem: () => { removed = true },
  }), /Conflicto de versión.*conservó/)
  assert.equal(removed, false)
})

test('invalid Chilean time never executes UPDATE and preserves local data', async () => {
  let updated = false
  await assert.rejects(syncUrgencyOffline({ ...payload, fecha_ot: '2024-09-08', hora_inicio: '00:30', hora_termino: '02:00' }, 'queue-1', {
    updateOT: async () => { updated = true; return { data: { id: payload.ot_id }, error: null } },
    removeDraft: () => assert.fail('draft must be preserved'), removeQueueItem: () => assert.fail('queue must be preserved'),
  }), /no existe.*Chile/i)
  assert.equal(updated, false)
})
