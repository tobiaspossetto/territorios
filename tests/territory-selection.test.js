import test from 'node:test'
import assert from 'node:assert/strict'
import {territorySelection,territorySelectionFilter} from '../src/territorySelection.js'
import {assignmentTerritories} from '../src/programAssignments.js'
import {crossedBlockLayers} from '../src/crossedBlocks.js'
const data={features:['T36','T35','T31'].map(territorio=>({properties:{territorio}}))}
test('la salida selecciona todos sus territorios válidos una vez y mantiene el primero',()=>{
  const assignment={territorio:'T36',territorios:['T36','T35','T999','T35']}
  const features=territorySelection(data,assignment.territorio,assignmentTerritories(assignment))
  assert.deepEqual(features.map(f=>f.properties.territorio),['T36','T35'])
  assert.equal(features[0],data.features[0])
  assert.equal(assignment.territorios.length,4)
})
test('seleccionar después un territorio individual descarta el conjunto anterior',()=>{
  assert.deepEqual(territorySelection(data,'T31').map(f=>f.properties.territorio),['T31'])
  assert.deepEqual(territorySelection(null,'T36'),[])
})
test('polígonos y tachados usan el mismo conjunto de selección',()=>{
  const selected=['T36','T35']
  const filter=territorySelectionFilter(selected)
  const [near,far]=crossedBlockLayers({id:'tachados'},selected)
  assert.deepEqual(near.filter,filter)
  assert.equal(near.minzoom,undefined)
  assert.deepEqual(far.filter,['!',filter])
  assert.equal(far.minzoom,15.5)
})
