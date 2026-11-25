import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,statSync} from 'node:fs'
import {guideDemoProgram,guideDemoSummaries} from '../src/guideDemo.js'
import {buildPublicProgramAssignments,visibleMapAssignments} from '../src/programAssignments.js'
import {crossedBlocks} from '../src/crossedBlocks.js'

test('guía: semana ficticia completa y grupos unidos conservando orden',()=>{
  const program=guideDemoProgram()
  assert.equal(new Set(program.map(s=>s.dia)).size,7)
  const assignments=buildPublicProgramAssignments(program)
  assert.equal(assignments.length,9)
  assert.equal(assignments[5].label,'SAB - PM - G1 - G2')
  assert.deepEqual(assignments[4].territorios,['T36','T35'])
  assert.equal(assignments[3].territorio,null)
  assert.equal(assignments[3].territorioTexto,'NEGOCIOS')
})
test('guía: ocultar G3 conserva la fila pública y no oculta los demás grupos',()=>{
  const all=buildPublicProgramAssignments(guideDemoProgram())
  assert.equal(all[6].ocultarBandera,true)
  assert.equal(visibleMapAssignments(all).length,8)
  assert.equal(visibleMapAssignments(all).some(a=>a.label==='SAB - PM - G4'),true)
})
test('guía: X en las manzanas no disponibles de un activo, sin selección',()=>{
  const summary=guideDemoSummaries().T25
  assert.equal(summary.activo,true)
  const data={type:'FeatureCollection',features:[1,2,3,4,5].map(n=>({properties:{territorio:'T25',manzana:String(n),manzanas_activas:summary.manzanasActivas}}))}
  assert.deepEqual(crossedBlocks(data,{mode:'mapa',selected:null}).features.map(f=>f.properties.manzana),['2','5'])
})
test('guía: cada apertura del editor obtiene su propio borrador de prueba',()=>{
  const first=guideDemoProgram()
  first[0].detalles[0].lugar='Modificado'
  assert.equal(guideDemoProgram()[0].detalles[0].lugar,'Plaza del barrio')
})

test('guía: la semana de prueba respeta el día y cruza el año sin fechas inválidas',()=>{
  const week=guideDemoProgram(new Date(2027,0,1,12))
  assert.equal(week[0].fecha,'2026-12-28')
  assert.equal(week[6].fecha,'2027-01-03')
  assert.deepEqual(week.map(s=>new Date(s.fecha+'T12:00:00').getDay()),[1,2,3,4,5,6,0])
})

test('guía: todas las capturas actuales existen y están optimizadas',()=>{
  const source=readFileSync(new URL('../src/guideContent.js',import.meta.url),'utf8')
  const images=[...new Set(source.match(/guide-v5-[a-z-]+\.jpg/g))]
  assert.ok(images.length>=15)
  for(const image of images){
    const size=statSync(new URL('../public/'+image,import.meta.url)).size
    assert.ok(size>1000&&size<150000,image)
  }
  assert.doesNotMatch(source,/guide-v[34]-/)
})
