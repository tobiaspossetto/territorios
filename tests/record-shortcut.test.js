import test from 'node:test'
import assert from 'node:assert/strict'
import {startedTerritoryRecord} from '../src/recordShortcut.js'

test('reanuda trabajo empezado conservando ID, inicio, campaña y manzanas',()=>{
  const started={id:'actual',territorio:'T25',inicio:'2026-10-24',fin:null,campania:true,manzanasActivas:['1','3']}
  const rows=[started,{id:'cerrado',territorio:'T25',inicio:'2026-11-01',fin:'2026-11-02'},{id:'otro',territorio:'T26',inicio:'2026-11-03'}]
  assert.equal(startedTerritoryRecord(rows,'T25'),started)
  assert.equal(rows[0],started)
})
test('nunca reutiliza registros terminados y tolera listas vacías',()=>{
  assert.equal(startedTerritoryRecord([{id:'pasado',territorio:'T25',inicio:'2026-10-01',fin:'2026-10-03'}],'T25'),null)
  assert.equal(startedTerritoryRecord([], 'T25'),null)
})
test('si existen varios empezados selecciona el más reciente sin reordenar los datos',()=>{
  const rows=[{id:'viejo',territorio:'T25',inicio:'2026-10-01'},{id:'nuevo',territorio:'T25',inicio:'2026-11-01'}]
  assert.equal(startedTerritoryRecord(rows,'T25').id,'nuevo')
  assert.deepEqual(rows.map(r=>r.id),['viejo','nuevo'])
})
