import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAssistanceOfflineUpdate, requireAssistanceSyncMatch } from './ot-assistance'

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

test('uses the Santiago DST offset independently of the process timezone', () => {
  const summer = buildAssistanceOfflineUpdate({
    fecha_ot: '2026-01-15',
    hora_inicio: '09:00',
    hora_termino: '10:00',
  })
  const winter = buildAssistanceOfflineUpdate({
    fecha_ot: '2026-07-15',
    hora_inicio: '09:00',
    hora_termino: '10:00',
  })

  assert.equal(summer.hora_inicio, '2026-01-15T12:00:00.000Z')
  assert.equal(winter.hora_inicio, '2026-07-15T13:00:00.000Z')
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
