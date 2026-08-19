import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'
import { buildAssistanceOfflineUpdate, requireAssistanceSyncMatch, syncAssistanceOffline, type OTAssistanceSyncPayload } from './ot-assistance'

test('maps assistance fields directly without synchronization metadata', () => {
  const update = buildAssistanceOfflineUpdate({
    problema_reportado: ' Falla de sensor ',
    causa_probable: ' Cable suelto ',
    trabajo_realizado: ' Se reconectó el cable ',
    fecha_ot: '2026-08-19',
    hora_inicio: '09:15',
    hora_termino: '10:45',
  })

  assert.equal(update.problema_reportado, 'Falla de sensor')
  assert.equal(update.causa_probable, 'Cable suelto')
  assert.equal(update.trabajo_realizado, 'Se reconectó el cable')
  assert.equal(update.duracion_minutos, 90)
  assert.equal(update.hora_inicio, '2026-08-19T13:15:00.000Z')
  assert.doesNotMatch(JSON.stringify(update), /offline|sincronizaci[oó]n|estado local/i)
})

test('calculates an assistance service that crosses midnight', () => {
  const update = buildAssistanceOfflineUpdate({
    fecha_ot: '2026-08-19',
    hora_inicio: '23:30',
    hora_termino: '01:00',
  })

  assert.equal(update.duracion_minutos, 90)
  assert.ok(new Date(String(update.hora_termino)) > new Date(String(update.hora_inicio)))
})

test('produces the same Santiago instant under different process timezones', () => {
  const helperPath = resolve(__dirname, 'ot-assistance.js')
  const runner = `const { buildAssistanceOfflineUpdate } = require(${JSON.stringify(helperPath)}); process.stdout.write(buildAssistanceOfflineUpdate({ fecha_ot: '2026-01-15', hora_inicio: '09:00', hora_termino: '10:00' }).hora_inicio)`
  const results = ['UTC', 'America/New_York', 'Asia/Tokyo'].map((timezone) => {
    const result = spawnSync(process.execPath, ['-e', runner], {
      encoding: 'utf8',
      env: { ...process.env, TZ: timezone },
    })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  })

  assert.deepEqual(results, Array(3).fill('2026-01-15T12:00:00.000Z'))
})

test('rejects equal start and end times instead of creating a 24 hour service', () => {
  assert.throws(
    () => buildAssistanceOfflineUpdate({ fecha_ot: '2026-08-19', hora_inicio: '09:00', hora_termino: '09:00' }),
    /debe ser distinta/,
  )
})

test('treats an atomic update without a matching version as a conflict', () => {
  assert.throws(() => requireAssistanceSyncMatch(null), /Conflicto de versión/)
  assert.deepEqual(requireAssistanceSyncMatch({ id: 'ot-55' }), { id: 'ot-55' })
})

test('rejects a provided Santiago time that does not exist during the DST jump', () => {
  assert.throws(
    () => buildAssistanceOfflineUpdate({ fecha_ot: '2024-09-08', hora_inicio: '00:30', hora_termino: '02:00' }),
    /hora de inicio.*no existe.*Chile/i,
  )
})

const syncPayload: OTAssistanceSyncPayload = {
  ot_id: 'ot-55',
  empresa_id: 'empresa-1',
  user_id: 'user-1',
  base_updated_at: '2026-08-19T12:00:00.000Z',
  fecha_ot: '2026-08-19',
  hora_inicio: '09:00',
  hora_termino: '10:00',
  problema_reportado: 'Problema',
  causa_probable: 'Causa',
  trabajo_realizado: 'Solución',
}

test('atomic assistance sync filters by OT, company and expected version before removing local data', async () => {
  const calls: string[] = []
  let receivedFilters: unknown
  await syncAssistanceOffline(syncPayload, 'queue-1', {
    updateOT: async (_values, filters) => {
      calls.push('update')
      receivedFilters = filters
      return { data: { id: syncPayload.ot_id }, error: null }
    },
    removeDraft: () => calls.push('draft'),
    removeQueueItem: () => calls.push('queue'),
  })

  assert.deepEqual(receivedFilters, {
    id: syncPayload.ot_id,
    empresa_id: syncPayload.empresa_id,
    updated_at: syncPayload.base_updated_at,
  })
  assert.deepEqual(calls, ['update', 'draft', 'queue'])
})

test('atomic assistance conflict preserves the draft and queue item for manual review', async () => {
  let draftRemoved = false
  let queueRemoved = false
  await assert.rejects(
    syncAssistanceOffline(syncPayload, 'queue-1', {
      updateOT: async () => ({ data: null, error: null }),
      removeDraft: () => { draftRemoved = true },
      removeQueueItem: () => { queueRemoved = true },
    }),
    /Conflicto de versión.*conservó.*revisión manual/,
  )

  assert.equal(draftRemoved, false)
  assert.equal(queueRemoved, false)
})

test('invalid provided time prevents the atomic update and preserves offline data', async () => {
  let updateExecuted = false
  const invalidPayload = { ...syncPayload, fecha_ot: '2024-09-08', hora_inicio: '00:30', hora_termino: '02:00' }
  await assert.rejects(
    syncAssistanceOffline(invalidPayload, 'queue-1', {
      updateOT: async () => {
        updateExecuted = true
        return { data: { id: syncPayload.ot_id }, error: null }
      },
      removeDraft: () => assert.fail('draft must be preserved'),
      removeQueueItem: () => assert.fail('queue item must be preserved'),
    }),
    /no existe.*Chile/i,
  )
  assert.equal(updateExecuted, false)
})
