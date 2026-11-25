import test from 'node:test'
import assert from 'node:assert/strict'
import {nextProgramAssignments} from '../src/nextProgramAssignments.js'
const now=new Date('2026-10-25T15:00:30-03:00')
const outing=(id,fecha,horario)=>({id,fecha,horario,label:'DOM - PM'})
test('elige el próximo instante, incluye todos los grupos y no modifica el programa',()=>{
  const entries=[outing('later','2026-10-27','10:00'),outing('g1','2026-10-26','09:00'),outing('past','2026-10-25','12:59'),outing('g2','2026-10-26','09:00')]
  const snapshot=JSON.stringify(entries)
  assert.deepEqual(nextProgramAssignments(entries,now).assignments.map(a=>a.id),['g1','g2'])
  assert.equal(JSON.stringify(entries),snapshot)
})
test('mantiene la salida dos horas y no repite fechas pasadas',()=>{
  const entries=[outing('now','2026-10-25','15:00')]
  assert.equal(nextProgramAssignments(entries,now).horario,'15:00')
  assert.equal(nextProgramAssignments(entries,new Date('2026-10-25T16:59:59-03:00')).horario,'15:00')
  assert.equal(nextProgramAssignments(entries,new Date('2026-10-25T17:00:00-03:00')),null)
})

test('salida de 17:30 permanece hasta 19:30 antes de mostrar la de mañana 09:30',()=>{
  const entries=[outing('actual','2026-11-03','17:30'),outing('mañana','2026-11-04','09:30')]
  for(const hour of ['17:29:00','17:30:00','18:30:00','19:29:59']){
    assert.equal(nextProgramAssignments(entries,new Date(`2026-11-03T${hour}-03:00`)).assignments[0].id,'actual')
  }
  assert.equal(nextProgramAssignments(entries,new Date('2026-11-03T19:30:00-03:00')).assignments[0].id,'mañana')
})
test('conserva todos los grupos simultáneos durante las dos horas de margen',()=>{
  const entries=[outing('g1','2026-11-03','17:30'),outing('g2','2026-11-03','17:30'),outing('siguiente','2026-11-03','19:00')]
  assert.deepEqual(nextProgramAssignments(entries,new Date('2026-11-03T19:15:00-03:00')).assignments.map(a=>a.id),['g1','g2'])
})
test('el margen cruza medianoche tanto con fecha explícita como sin fecha',()=>{
  for(const fecha of ['2026-11-02','']){
    const entries=[{...outing('noche',fecha,'23:30'),label:'LUN - PM'},outing('mañana','2026-11-03','09:30')]
    assert.equal(nextProgramAssignments(entries,new Date('2026-11-03T01:29:59-03:00')).assignments[0].id,'noche')
    assert.equal(nextProgramAssignments(entries,new Date('2026-11-03T01:30:00-03:00')).assignments[0].id,'mañana')
  }
})
test('usa el calendario argentino al cruzar medianoche UTC',()=>{
  const result=nextProgramAssignments([outing('a','2026-10-25','23:00')],new Date('2026-10-26T01:00:00Z'))
  assert.equal(result.fecha,'2026-10-25')
})
test('omite fechas y horarios inválidos; AM o PM no equivalen a una hora exacta',()=>{
  assert.equal(nextProgramAssignments([outing('a','2026-02-30','17:00'),outing('b','2026-10-26','24:00'),outing('c','2026-10-26','AM'),outing('d','2026-10-26','12:60')],now),null)
})
test('registros antiguos sin fecha usan la próxima ocurrencia del día y hora',()=>{
  const result=nextProgramAssignments([outing('a','','13:00')],now)
  assert.equal(result.fecha,'2026-11-01')
})
