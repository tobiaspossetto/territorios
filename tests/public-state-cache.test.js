import test from 'node:test'
import assert from 'node:assert/strict'
import {readPublicStateCache,writePublicStateCache} from '../src/publicStateCache.js'

const state={summaries:{T29:{activo:true}},campaignMode:false,programAssignments:[{id:'salida-1',territorio:'T29',lugar:'Encuentro'}],programWeekStart:4,splashType:'collage'}
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}}

test('un nuevo arranque recupera el programa público guardado',()=>{
  const disk=storage()
  assert.equal(writePublicStateCache('public-project-a',state,disk),true)
  assert.deepEqual(readPublicStateCache('public-project-a',disk),state)
  assert.equal(readPublicStateCache('public-project-b',disk),null)
})

test('la copia nueva reemplaza salidas modificadas y eliminadas, incluso un programa vacío',()=>{
  const disk=storage()
  writePublicStateCache('public',state,disk)
  const changed={...state,programAssignments:[{id:'salida-2',territorio:'T35'}]}
  writePublicStateCache('public',changed,disk)
  assert.deepEqual(readPublicStateCache('public',disk).programAssignments,changed.programAssignments)
  writePublicStateCache('public',{...state,programAssignments:[]},disk)
  assert.deepEqual(readPublicStateCache('public',disk).programAssignments,[])
})

test('caché corrupta o almacenamiento bloqueado no impiden usar la app con conexión',()=>{
  assert.equal(readPublicStateCache('public',{getItem:()=>'{broken'}),null)
  assert.equal(readPublicStateCache('public',{getItem:()=>JSON.stringify({version:1,state:{summaries:[]}})}),null)
  const blocked={getItem(){throw new Error('blocked')},setItem(){throw new Error('full')}}
  assert.equal(readPublicStateCache('public',blocked),null)
  assert.equal(writePublicStateCache('public',state,blocked),false)
})
