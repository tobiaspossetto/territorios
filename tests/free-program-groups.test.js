import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {programGroups,nextProgramGroup,buildPublicProgramAssignments,assignmentGroupLabel} from '../src/programAssignments.js'
import {assignmentSearchTitle} from '../src/assignmentSearch.js'

test('grupos admiten números, combinaciones y texto libre sin perder mayúsculas ni palabras',()=>{
  assert.deepEqual(programGroups('G4'),['G4'])
  assert.deepEqual(programGroups('G4,G3'),['G4','G3'])
  assert.deepEqual(programGroups('  Congre  '),['Congre'])
  assert.deepEqual(programGroups('G04, g 3, G4'),['G4','G3'])
  assert.deepEqual(programGroups('Congre y amigos'),['Congre y amigos'])
  assert.deepEqual(programGroups('Congre - especial'),['Congre - especial'])
  assert.deepEqual(programGroups('G4, Congre'),['G4','Congre'])
  assert.equal(nextProgramGroup([{grupo:'Congre'},{grupo:'G1,G2'}]),'G3')
})
test('publicación y buscador preservan el nombre libre completo, territorios y posición',()=>{
  const [assignment]=buildPublicProgramAssignments([{id:'s',dia:'LUNES',horario:'17:15',grupos:true,detalles:[{id:'d',grupo:'Congre - especial',lugar:'Plaza',territorio:'T13,T14',pinCoordinates:[-62,-31]}]}])
  assert.equal(assignment.groupLabel,'Congre - especial')
  assert.equal(assignmentGroupLabel(assignment),'Congre - especial')
  assert.equal(assignmentSearchTitle(assignment),'Lunes · PM · Congre - especial')
  assert.deepEqual(assignment.territorios,['T13','T14'])
  assert.deepEqual(assignment.coordinates,[-62,-31])
  assert.equal(assignmentGroupLabel({label:'SAB - PM - G4 - G3'}),'G4 · G3')
})
test('etiquetas del calendario y próxima salida usan el color y tinta de la salida',()=>{
  const css=readFileSync(new URL('../src/design-preview.css',import.meta.url),'utf8')
  assert.match(css,/\.dp-group-label \{[^}]*background:var\(--outing-color[^}]*color:var\(--outing-ink/)
  assert.match(css,/\.dp-group-label \{[^}]*overflow-wrap:anywhere/)
  const code=readFileSync(new URL('../src/DesignProgram.jsx',import.meta.url),'utf8')
  assert.equal((code.match(/assignmentGroupLabel\(assignment\)/g)||[]).length,2)
  assert.equal((code.match(/className="dp-group-label"/g)||[]).length,2)
})
