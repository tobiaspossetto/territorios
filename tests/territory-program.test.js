import test from 'node:test'
import assert from 'node:assert/strict'
import {territoryProgramSchedule} from '../src/assignmentSearch.js'

test('selección múltiple reúne las salidas de ambos territorios sin duplicar la compartida',()=>{
  const rows=[
    {id:'conjunta',territorio:'T36',territorios:['T36','T35'],fecha:'2026-11-20',label:'VIE - PM',horario:'17:15'},
    {id:'otra',territorio:'T35',fecha:'2026-11-21',label:'SAB - AM',horario:'09:30'},
    {id:'ajena',territorio:'T31',fecha:'2026-11-22',label:'DOM - AM',horario:'09:30'},
  ]
  assert.deepEqual(territoryProgramSchedule(rows,['T36','T35']).map(group=>group.id),['conjunta','otra'])
  assert.deepEqual(territoryProgramSchedule(rows,'T36').map(group=>group.id),['conjunta'])
  assert.deepEqual(territoryProgramSchedule(rows,[]),[])
})

test('detalle encuentra todas las salidas de un territorio, no solo el primero de una salida',()=>{
  const rows=[
    {id:'b',territorio:'T13',territorios:['T13','T14'],fecha:'2026-10-24',label:'SAB - PM',horario:'17:15'},
    {id:'a',territorio:'T14',fecha:'2026-10-23',label:'VIE - AM',horario:'09:45',ocultarBandera:true},
    {id:'other',territorio:'T140',fecha:'2026-10-23',label:'VIE - PM',horario:'17:00'},
  ]
  const before=structuredClone(rows)
  const schedule=territoryProgramSchedule(rows,'T14')
  assert.deepEqual(schedule.map(group=>[group.title,group.horario]),[['Viernes','09:45'],['Sábado','17:15']])
  assert.deepEqual(rows,before)
  assert.deepEqual(territoryProgramSchedule(rows,'T1'),[])
  assert.deepEqual(territoryProgramSchedule(null,'T14'),[])
})

test('grupos simultáneos no repiten horario y semanas distintas permanecen separadas',()=>{
  const base={territorio:'T14',fecha:'2026-10-24',horario:'17:15',label:'SAB - PM'}
  const schedule=territoryProgramSchedule([
    {...base,id:'g1',salidaId:'s',label:'SAB - PM - G1'},
    {...base,id:'g2',salidaId:'s',label:'SAB - PM - G2'},
    {...base,id:'next',salidaId:'next',fecha:'2026-10-31'},
  ],'T14')
  assert.deepEqual(schedule.map(group=>group.fecha),['2026-10-24','2026-10-31'])
})
