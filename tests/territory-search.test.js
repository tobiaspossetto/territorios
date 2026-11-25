import test from 'node:test'
import assert from 'node:assert/strict'
import {searchTerritories} from '../src/territorySearch.js'
const data={features:[51,1,13,14,10,1].map(n=>({properties:{territorio:`T${n}`,zona:'San Francisco'}}))}
test('lista numérica simple sin duplicados',()=>assert.deepEqual(searchTerritories(data).map(t=>t.id),['T1','T10','T13','T14','T51']))
test('número exacto primero, con prefijo T o ceros',()=>{
  for(const query of ['1','T1','01'])assert.deepEqual(searchTerritories(data,query).map(t=>t.id),['T1','T10','T13','T14'])
  assert.equal(searchTerritories(data,' t13 ')[0].id,'T13')
})
test('sin coincidencias y entrada inválida no muestran todos',()=>{
  assert.deepEqual(searchTerritories(data,'99'),[])
  assert.deepEqual(searchTerritories(data,'abc'),[])
  assert.deepEqual(searchTerritories(null),[])
})
