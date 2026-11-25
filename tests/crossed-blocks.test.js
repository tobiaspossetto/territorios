import test from 'node:test'
import assert from 'node:assert/strict'
import {crossedBlocks,crossedBlockLayers} from '../src/crossedBlocks.js'
const data={features:[
  {properties:{territorio:'T1',manzana:'1',manzanas_activas:['1']}},
  {properties:{territorio:'T1',manzana:'2',manzanas_activas:['1']}},
  {properties:{territorio:'T2',manzana:3,manzanas_activas:[]}},
  {properties:{territorio:'T3',manzana:'1',manzanas_activas:null}},
]}
test('prepara tachados sin seleccionar, tanto en mapa como campaña',()=>{
  for(const mode of ['mapa','campana'])assert.deepEqual(crossedBlocks(data,{mode}).features.map(f=>f.properties.territorio),['T1','T2'])
  assert.equal(crossedBlocks(data,{mode:'metrica'}),null)
})
test('los tachados de otros territorios solo se dibujan cerca',()=>{
  const layers=crossedBlockLayers({id:'tachados',type:'fill'},'T1')
  assert.equal(layers[0].minzoom,undefined)
  assert.deepEqual(layers[0].filter,['==',['get','territorio'],'T1'])
  assert.equal(layers[1].minzoom,15.5)
  assert.deepEqual(layers[1].filter,['!=',['get','territorio'],'T1'])
})
test('el link explícito cambia solo el territorio elegido',()=>{
  assert.deepEqual(crossedBlocks(data,{mode:'mapa',selected:'T1',explicit:true,excluded:['1']}).features.map(f=>`${f.properties.territorio}:${f.properties.manzana}`),['T1:1','T2:3'])
  assert.equal(crossedBlocks(null,{mode:'mapa'}),null)
})
