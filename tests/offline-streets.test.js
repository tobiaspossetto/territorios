import test from 'node:test'
import assert from 'node:assert/strict'
import {bordeConCalles,callesDelMapa,mergeTerritoryStreetLabels} from '../src/calles.js'

const geometry={type:'Polygon',coordinates:[[[-62.06,-31.43],[-62.058,-31.43],[-62.058,-31.428],[-62.06,-31.428],[-62.06,-31.43]]]}
const roads=[{type:'Feature',properties:{name:'Calle 100'},geometry:{type:'LineString',coordinates:geometry.coordinates[0].slice(0,2)}}]

test('el contorno offline obtiene nombres del archivo local, sin consultar MapTiler',()=>{
  const map={querySourceFeatures(source,options){
    assert.equal(source,'pm')
    assert.equal(options.sourceLayer,'roads')
    return roads
  }}
  const result=bordeConCalles(geometry,callesDelMapa(map,false))
  assert.ok(result.features.some(feature=>feature.properties.calle==='Calle 100'))
})

test('online conserva la fuente de nombres del estilo actual',()=>{
  const map={getStyle:()=>({layers:[{source:'online-source','source-layer':'transportation_name'}]}),querySourceFeatures(source,options){
    assert.equal(source,'online-source')
    assert.equal(options.sourceLayer,'transportation_name')
    return roads
  }}
  assert.deepEqual(callesDelMapa(map,true),roads)
})

test('un estilo que aún está cambiando no impide seleccionar un territorio',()=>{
  assert.deepEqual(callesDelMapa({querySourceFeatures(){throw new Error('source unavailable')}},false),[])
})

test('una recarga parcial conserva los lados identificados sin duplicarlos ni mezclarlos con otro territorio',()=>{
  const full={type:'FeatureCollection',features:[...roads,{...roads[0],geometry:{type:'LineString',coordinates:geometry.coordinates[0].slice(1,3)}}]}
  const first=mergeTerritoryStreetLabels(null,full,'T36')
  assert.equal(mergeTerritoryStreetLabels(first,{features:[roads[0]]},'T36').features.length,2)
  assert.equal(mergeTerritoryStreetLabels(first,{features:[]},'T36').features.length,2)
  assert.equal(mergeTerritoryStreetLabels(first,{features:[]},'T35').features.length,0)
})
