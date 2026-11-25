import test from 'node:test'
import assert from 'node:assert/strict'
import {metricFrequency, metricServiceYear, serviceCompletionCount, territoryFrequency} from '../src/metricFrequency.js'

const now = new Date('2026-10-23T15:00:00Z')
test('promedio individual respeta el período y usa solo finalizaciones del seleccionado',()=>{
  const territory={veces:4,veces_servicio:1}
  assert.equal(territoryFrequency(territory,'history',now,'2026-06-09').days,34)
  assert.equal(territoryFrequency(territory,'service',now,'2026-06-09').days,53)
  assert.equal(territoryFrequency({veces:0,veces_servicio:0},'service',now).days,null)
  assert.deepEqual(territory,{veces:4,veces_servicio:1})
})
test('el nuevo año sin finalizaciones no hereda el contador anterior', () => {
  assert.equal(serviceCompletionCount({vecesServicio:3,vecesPorAnoServicio:{2025:3}},now),0)
  assert.equal(serviceCompletionCount({vecesServicio:3},now),0)
  assert.equal(serviceCompletionCount({vecesPorAnoServicio:{2026:2}},now),2)
})
test('historial usa el inicio, no la primera finalización', () => {
  const frequency=metricFrequency([{veces:1,primera_inicio:'2026-07-23',primera:'2026-10-23'}],'history',now)
  assert.equal(frequency.days,93)
  assert.equal(metricFrequency([{veces:1,primera:'2026-10-23'}],'history',now).days,null)
})
test('el selector cambia período y finalizaciones sin mutar los datos', () => {
  const rows=[{veces:2,primera_inicio:'2025-09-01'}]
  const before=structuredClone(rows)
  const history=metricFrequency(rows,'history',now)
  const service=metricFrequency([{...rows[0],veces:1}],'service',now)
  assert.equal(service.days,53)
  assert.equal(history.days,209)
  assert.deepEqual(rows,before)
})
test('fecha de Córdoba estable durante el día y en el cambio de año', () => {
  const rows=[{veces:1}]
  assert.equal(metricFrequency(rows,'service',new Date('2026-10-23T03:01:00Z')).days,53)
  assert.equal(metricFrequency(rows,'service',new Date('2026-10-24T02:59:00Z')).days,53)
  assert.equal(metricServiceYear(new Date('2026-09-01T02:59:00Z')),2025)
  assert.equal(metricServiceYear(new Date('2026-09-01T03:00:00Z')),2026)
})
test('sin finalizaciones no inventa una frecuencia', () => {
  assert.equal(metricFrequency([{veces:0}],'service',now).days,null)
})

test('usa el primer inicio histórico verificado para todos los territorios, aun con resúmenes antiguos', () => {
  const feats=Array.from({length:64},(_,i)=>({veces:i===0?128:0}))
  const result=metricFrequency(feats,'history',now,'2026-06-09')
  assert.equal(result.start,'2026-06-09')
  assert.equal(result.elapsed,137)
  assert.equal(result.days,69)
  assert.equal(metricFrequency(feats,'service',now,'2026-06-09').start,'2026-09-01')
})
