import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {nextProgramGroup} from '../src/programAssignments.js'

test('agregar un grupo después de grupos unidos no repite un número',()=>{
  const details=[{grupo:'G1, G2'},{grupo:'G3'},{grupo:'G4'}]
  const original=JSON.stringify(details)
  assert.equal(nextProgramGroup(details),'G5')
  assert.equal(JSON.stringify(details),original)
})
test('normaliza grupos y utiliza el primer número disponible',()=>{
  assert.equal(nextProgramGroup([{grupo:'g01 / G3'},{grupo:'G4;G5'}]),'G2')
  assert.equal(nextProgramGroup([{grupo:'G1 y G2'}]),'G3')
  assert.equal(nextProgramGroup([{grupo:''}]),'G1')
  assert.equal(nextProgramGroup(),'G1')
})
test('desactivar múltiples lugares requiere una decisión explícita en la POC',()=>{
  const code=fs.readFileSync(new URL('../src/ProgramGenerator.jsx',import.meta.url),'utf8')
  assert.match(code,/designPreview && !enabled && salida.detalles.length > 1.*setCollapseGroupsId\(salida.id\); return/)
  assert.match(code,/role="alert"/)
  assert.match(code,/>Conservar grupos<\/button>/)
  assert.match(code,/>Usar solo el primer lugar<\/button>/)
  assert.match(code,/detalleVacio\(nextProgramGroup\(s.detalles\)\)/)
  assert.match(code,/if\(!backdropPointer.current\|\|event.target!==event.currentTarget\)return/)
})
test('Programa reserva espacio para retomar Admin sin cubrir las filas',()=>{
  const css=fs.readFileSync(new URL('../src/design-workspace.css',import.meta.url),'utf8')
  assert.match(css,/admin-is-minimized \.dp-program \{ bottom:calc\(116px/)
  assert.match(css,/admin-is-minimized \.info-card \{ bottom:calc\(126px/)
})
