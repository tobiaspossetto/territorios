import test from 'node:test'
import assert from 'node:assert/strict'
import {programDate,programWeekday,formatProgramDate,localProgramDate,isAssignmentToday,sortProgramEntries,currentProgramAssignments} from '../src/programDates.js'
import {buildPublicProgramAssignments} from '../src/programAssignments.js'
import {groupProgramAssignments,assignmentSearchTitle} from '../src/assignmentSearch.js'
import {mergeProgramDraft} from '../src/programDraftMerge.js'

const draft=()=>[{id:'s1',dia:'LUNES',horario:'17:15',grupos:false,detalles:[{id:'d1',territorio:'T13',lugar:'Plaza',pinCoordinates:[-62.06,-31.44],pinStatus:'manual'}]}]
test('Programa oculta fechas pasadas sin quitar registros del borrador de Admin',()=>{
  const rows=[{id:'past',fecha:'2026-11-01'}, {id:'today',fecha:'2026-11-02',horario:'08:00'}, {id:'future',fecha:'2026-11-03'}, {id:'legacy',label:'LUN - PM'}]
  const before=structuredClone(rows)
  assert.deepEqual(currentProgramAssignments(rows,new Date('2026-11-02T23:00:00Z')).map(row=>row.id),['today','future','legacy'])
  assert.deepEqual(rows,before)
})
test('el vencimiento ocurre al terminar el día en Córdoba y no al pasar la hora de salida',()=>{
  const rows=[{id:'today',fecha:'2026-11-02',horario:'09:00'}]
  assert.equal(currentProgramAssignments(rows,new Date('2026-11-03T02:59:59Z')).length,1)
  assert.equal(currentProgramAssignments(rows,new Date('2026-11-03T03:00:00Z')).length,0)
  assert.deepEqual(currentProgramAssignments([],new Date('2026-11-03T03:00:00Z')),[])
})
test('fecha opcional válida, calendario real y formato local',()=>{
  assert.equal(programDate('2028-02-29'),'2028-02-29')
  for(const value of ['',null,123,'2026-02-29','2026-04-31','21/10/2026'])assert.equal(programDate(value),'')
  assert.equal(programWeekday('2026-10-21'),'MIÉRCOLES')
  assert.equal(formatProgramDate('2026-10-21'),'21/10/2026')
  assert.equal(formatProgramDate('bad'),'')
  assert.equal(localProgramDate(new Date('2026-10-22T01:00:00Z')),'2026-10-21')
})
test('publicación nueva respeta fecha, publicación anterior conserva forma y datos',()=>{
  const legacy=buildPublicProgramAssignments(draft())[0]
  assert.equal(Object.hasOwn(legacy,'fecha'),false)
  assert.equal(legacy.label,'LUN - PM')
  const rows=draft();rows[0].fecha='2026-10-21'
  const published=buildPublicProgramAssignments(rows)[0]
  assert.equal(published.fecha,'2026-10-21')
  assert.equal(published.label,'MIE - PM')
  assert.deepEqual(published.coordinates,legacy.coordinates)
  assert.match(assignmentSearchTitle(published),/Miércoles · 21\/10\/2026/)
})
test('solo agrupa salidas de la misma fecha y horario, sin mezclar semanas',()=>{
  const first=buildPublicProgramAssignments([{...draft()[0],fecha:'2026-10-19'}])[0]
  const same={...first,id:'s2:d2',salidaId:'s2'}
  const nextWeek={...first,id:'s3:d3',salidaId:'s3',fecha:'2026-10-26'}
  const legacy={...first,id:'s4:d4',salidaId:'s4'};delete legacy.fecha
  const groups=groupProgramAssignments([first,same,nextWeek,legacy])
  assert.equal(groups.length,3)
  assert.deepEqual(groups.map(group=>group.assignments.length),[2,1,1])
  assert.deepEqual(groups.map(group=>group.fecha),['2026-10-19','2026-10-26',''])
})
test('editar o quitar fecha preserva posiciones manuales y cambios concurrentes',()=>{
  const base=draft(),remote=structuredClone(base),local=structuredClone(base)
  remote[0].detalles[0].pinCoordinates=[-62.07,-31.43]
  remote[0].campoFuturo='conservar'
  local[0].fecha='2026-10-21';local[0].dia='MIÉRCOLES'
  const merged=mergeProgramDraft(remote,local,base)
  assert.equal(merged[0].fecha,'2026-10-21')
  assert.equal(merged[0].campoFuturo,'conservar')
  assert.deepEqual(merged[0].detalles,remote[0].detalles)
  const cleared=structuredClone(merged);cleared[0].fecha=''
  assert.equal(mergeProgramDraft(merged,cleared,merged)[0].fecha,'')
  assert.equal(Object.hasOwn(buildPublicProgramAssignments(cleared)[0],'fecha'),false)
})
test('resaltado de hoy distingue fechas y mantiene compatibilidad sin fecha',()=>{
  assert.equal(isAssignmentToday({fecha:'2026-10-21',label:'MIE - PM'},'MIE','2026-10-21'),true)
  assert.equal(isAssignmentToday({fecha:'2026-10-28',label:'MIE - PM'},'MIE','2026-10-21'),false)
  assert.equal(isAssignmentToday({label:'MIE - PM'},'MIE','2026-10-21'),true)
  assert.equal(isAssignmentToday({label:'MAR - PM'},'MIE','2026-10-21'),false)
})

test('ordena fechas y horas reales, conserva grupos empatados y no muta registros',()=>{
  const entries=[
    {id:'late',fecha:'2026-11-01',horario:'09:00'},
    {id:'g2',fecha:'2026-10-31',horario:'17:15'},
    {id:'morning',fecha:'2026-10-31',horario:'9:45'},
    {id:'g1',fecha:'2026-10-31',horario:'17:15'},
    {id:'old-sat',dia:'SÁBADO',horario:'09:00'},
    {id:'old-mon',dia:'LUNES',horario:'17:00'},
  ]
  const copy=structuredClone(entries)
  assert.deepEqual(sortProgramEntries(entries).map(row=>row.id),['morning','g2','g1','late','old-mon','old-sat'])
  assert.deepEqual(entries,copy)
  assert.deepEqual(sortProgramEntries(),[])
})
