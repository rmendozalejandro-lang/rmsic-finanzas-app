import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { buildGeneralMaintenanceOfflineUpdate, syncGeneralMaintenanceOffline, type OTGeneralMaintenanceSyncPayload } from './ot-general-maintenance'
import { getOfflineStructure } from './ot-structure'

test('classifies simple general maintenance without relying on company', () => {
  const structure = getOfflineStructure({ empresa_id: 'any', tipo_servicio_codigo: 'dyf_softys_mantencion_general', tipo_servicio_nombre: 'Mantenimiento general', plantilla_ot_config: { codigo: 'softys_general', usa_checklist_por_equipo: false, usa_checklist_por_horas: false, usa_equipos_multiples: false } })
  assert.equal(structure.kind, 'mantenimiento_general')
})

test('keeps preventive general services and Mespack in their existing preventive structures', () => {
  assert.equal(getOfflineStructure({ tipo_servicio_codigo: 'rmsic_mantencion_general', tipo_servicio_nombre: 'Mantenimiento preventivo general' }).kind, 'preventiva')
  assert.equal(getOfflineStructure({ tipo_servicio_codigo: 'preventiva_general', tipo_servicio_nombre: 'Mantención preventiva general' }).kind, 'preventiva')
  assert.equal(getOfflineStructure({ tipo_servicio_codigo: 'rmsic_mespack', plantilla_ot_config: { usa_checklist_por_horas: true } }).kind, 'checklist_por_horas')
})

test('maps only real maintenance columns and no offline metadata', () => {
  const update = buildGeneralMaintenanceOfflineUpdate({ fecha_ot: '2026-08-19', hora_inicio: '08:00', hora_termino: '09:30', trabajo_realizado: ' Trabajo ', hallazgos: ' Hallazgo ', resultado_servicio: ' Resultado ', recomendaciones: ' Revisar ' })
  assert.deepEqual({ trabajo_realizado: update.trabajo_realizado, hallazgos: update.hallazgos, resultado_servicio: update.resultado_servicio, recomendaciones: update.recomendaciones, duracion_minutos: update.duracion_minutos }, { trabajo_realizado: 'Trabajo', hallazgos: 'Hallazgo', resultado_servicio: 'Resultado', recomendaciones: 'Revisar', duracion_minutos: 90 })
  assert.equal(JSON.stringify(update).includes('Avance registrado offline'), false)
  assert.equal('estado_local_avance' in update, false)
})

test('Chile conversion is independent from process TZ and handles midnight', () => {
  const helperPath = require.resolve('./ot-general-maintenance')
  const runner = `const {buildGeneralMaintenanceOfflineUpdate}=require(${JSON.stringify(helperPath)});process.stdout.write(JSON.stringify(buildGeneralMaintenanceOfflineUpdate({fecha_ot:'2026-08-19',hora_inicio:'23:30',hora_termino:'01:00'})))`
  const utc = execFileSync(process.execPath, ['-e', runner], { env: { ...process.env, TZ: 'UTC' } }).toString()
  const tokyo = execFileSync(process.execPath, ['-e', runner], { env: { ...process.env, TZ: 'Asia/Tokyo' } }).toString()
  assert.equal(utc, tokyo)
  assert.equal(JSON.parse(utc).duracion_minutos, 90)
})

test('rejects equal and nonexistent Chile DST wall-clock hours', () => {
  assert.throws(() => buildGeneralMaintenanceOfflineUpdate({ fecha_ot: '2026-08-19', hora_inicio: '09:00', hora_termino: '09:00' }), /debe ser distinta/)
  assert.throws(() => buildGeneralMaintenanceOfflineUpdate({ fecha_ot: '2024-09-08', hora_inicio: '00:30', hora_termino: '02:00' }), /no existe/)
})

const payload: OTGeneralMaintenanceSyncPayload = { ot_id: 'ot-1', empresa_id: 'empresa-1', user_id: 'user-1', base_updated_at: '2026-08-19T12:00:00Z', fecha_ot: '2026-08-19', hora_inicio: '08:00', hora_termino: '09:00', trabajo_realizado: 'Trabajo', hallazgos: 'Hallazgos', resultado_servicio: 'Resultado', recomendaciones: 'Recomendaciones' }

test('atomic success filters by id, company and version, then removes draft and queue', async () => {
  const calls: string[] = []; let filters: unknown
  await syncGeneralMaintenanceOffline(payload, 'queue-1', { updateOT: async (_values, received) => { calls.push('update'); filters = received; return { data: { id: payload.ot_id }, error: null } }, removeDraft: () => calls.push('draft'), removeQueueItem: () => calls.push('queue') })
  assert.deepEqual(filters, { id: payload.ot_id, empresa_id: payload.empresa_id, updated_at: payload.base_updated_at })
  assert.deepEqual(calls, ['update', 'draft', 'queue'])
})

test('atomic conflict preserves draft and queue', async () => {
  let removed = false
  await assert.rejects(syncGeneralMaintenanceOffline(payload, 'queue-1', { updateOT: async () => ({ data: null, error: null }), removeDraft: () => { removed = true }, removeQueueItem: () => { removed = true } }), /Conflicto de versión/)
  assert.equal(removed, false)
})
