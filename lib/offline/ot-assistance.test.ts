import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAssistanceOfflineUpdate } from './ot-assistance'

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
