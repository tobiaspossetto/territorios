import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {programWeekStartDate,programWeekBreaks,normalizeProgramWeekStart} from '../src/programWeeks.js'
const source=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('día de comienzo válido, lunes por defecto y semanas estables entre años',()=>{
  for(const value of [undefined,null,'2',7,-1,1.5])assert.equal(normalizeProgramWeekStart(value),0)
  assert.equal(normalizeProgramWeekStart(6),6)
  assert.equal(programWeekStartDate('2026-10-27',0),'2026-10-26')
  assert.equal(programWeekStartDate('2026-10-27',2),'2026-10-21')
  assert.equal(programWeekStartDate('2027-01-01',6),'2026-12-27')
  assert.equal(programWeekStartDate('2026-02-30',2),'')
})
test('separa al cruzar la semana aunque no haya salida el día de referencia',()=>{
  const groups=[{fecha:'2026-10-27',title:'Martes'},{fecha:'2026-10-29',title:'Jueves'},{fecha:'2026-11-05',title:'Jueves'}]
  const before=structuredClone(groups)
  assert.deepEqual(programWeekBreaks(groups,2),[null,{start:'2026-10-28'},{start:'2026-11-04'}])
  assert.deepEqual(programWeekBreaks(groups,0),[null,null,{start:'2026-11-02'}])
  assert.deepEqual(groups,before)
})
test('sin duplicar líneas entre grupos del mismo día o una misma semana',()=>{
  assert.deepEqual(programWeekBreaks([{fecha:'2026-10-28'},{fecha:'2026-10-28'},{fecha:'2026-10-29'}],2),[null,null,null])
  assert.deepEqual(programWeekBreaks([],2),[])
})
test('programas antiguos sin fecha admiten la referencia por día',()=>{
  assert.deepEqual(programWeekBreaks([{title:'Lunes'},{title:'Martes'},{title:'Jueves'},{title:'Domingo'}],2),[null,null,{start:''},null])
})
test('Otros integra ajustes y administradores sin mostrarlos en Registros',()=>{
  const code=source('AdminPanelV2.jsx')
  assert.doesNotMatch(code,/setView\('admins'\)/)
  const other=code.slice(code.indexOf("view === 'otros' ? <div"),code.indexOf('<div className="admin-record-filters"'))
  for(const text of ['ProgramWeekSettings','Mostrar modo campaña','Mostrar Métrica a usuarios públicos','AdminUsers','Restablecer'])assert.ok(other.includes(text),text)
  assert.match(source('ProgramWeekSettings.jsx'),/Día de referencia donde comienza un nuevo programa/)
  assert.match(source('ProgramWeekSettings.jsx'),/await onSave\(day\)/)
  assert.match(source('DesignProgram.jsx'),/role="separator" aria-label="Próxima Semana"/)
})
test('configuración compartida se sincroniza y se guarda con merge protegido',()=>{
  const code=source('firebaseData.js')
  assert.match(code,/programWeekStart=normalizeProgramWeekStart\(value\?\.programWeekStart\)/)
  assert.match(code,/function setProgramWeekStart\(programWeekStart\) \{\s*assertWritableFirebase\(\)/)
  assert.match(code,/\{programWeekStart, updatedAt:Date.now\(\)\}, \{merge:true\}/)
  assert.match(source('App.jsx'),/onProgramWeekStartChange=\{adminPreview \? async value => setProgramWeekStartState\(value\) : setProgramWeekStart\}/)
})
