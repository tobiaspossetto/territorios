import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeProgramDraft} from '../src/programDraftMerge.js'
import {buildPublicProgramAssignments,layoutAssignmentPosts,firstProgramTerritory,assignmentColorsByTerritory,applyAssignmentColors} from '../src/programAssignments.js'
import {BUILDING_PLACES} from '../src/buildingPlaces.js'

const draft=()=>Array.from({length:5},(_,i)=>({id:`s${i}`,dia:'SÁBADO',horario:'17:00',grupos:false,detalles:[{id:`d${i}`,territorio:`T${i+1}`,direccion:'',pinCoordinates:null,pinStatus:''}]}))
test('varios territorios usan solo el primero para la bandera sin cambiar el programa',()=>{
  const salidas=draft()
  salidas[0].detalles[0].territorio='T13, T14'
  salidas[0].detalles[0].pinCoordinates=[-62.06,-31.44]
  const assignment=buildPublicProgramAssignments(salidas)[0]
  assert.equal(assignment.territorio,'T13')
  assert.deepEqual(assignment.territorios,['T13','T14'])
  assert.deepEqual(assignment.coordinates,[-62.06,-31.44])
  assert.equal(salidas[0].detalles[0].territorio,'T13, T14')
  assert.equal(firstProgramTerritory(' t14 , T13 '),'T14')
  assert.equal(firstProgramTerritory('T13'),'T13')
  assert.equal(firstProgramTerritory('incorrecto, T13'),null)
})
test('todos los territorios comparten color, manteniendo una sola bandera en el primero',()=>{
  const salidas=draft();salidas[0].detalles[0].territorio='T13, T14'
  const assignments=buildPublicProgramAssignments(salidas)
  const palette=assignmentColorsByTerritory(assignments)
  assert.deepEqual(palette.T13,palette.T14)
  const posts=assignments.map(a=>({...a,...palette[a.territorio]}))
  const data={type:'FeatureCollection',features:['T13','T14','T99'].map(territorio=>({type:'Feature',properties:{territorio}}))}
  const painted=applyAssignmentColors(data,posts)
  assert.equal(painted.features[0].properties.assignmentColor,palette.T13.color)
  assert.equal(painted.features[1].properties.assignmentColor,palette.T13.color)
  assert.equal(painted.features[2].properties.assignmentColor,null)
  assert.equal(posts.filter(p=>p.territorio==='T13').length,1)
})
test('editar un territorio no borra las otras cuatro posiciones manuales',()=>{
  const base=draft(),latest=structuredClone(base),edited=structuredClone(base)
  latest.forEach((s,i)=>Object.assign(s.detalles[0],{pinCoordinates:[-62.06+i*.001,-31.44],pinStatus:'manual'}))
  edited[0].detalles[0].territorio='T36'
  const merged=mergeProgramDraft(latest,edited,base)
  assert.equal(merged[0].detalles[0].territorio,'T36')
  for(let i=1;i<5;i++)assert.deepEqual(merged[i],latest[i])
  assert.deepEqual(buildPublicProgramAssignments(merged).slice(1).map(p=>p.coordinates),latest.slice(1).map(s=>s.detalles[0].pinCoordinates))
})
test('cambiar dirección o territorio resetea solo el pin editado',()=>{
  const base=draft();base.forEach(s=>Object.assign(s.detalles[0],{pinCoordinates:[-62.06,-31.44],pinStatus:'manual'}))
  const edited=structuredClone(base)
  Object.assign(edited[0].detalles[0],{direccion:'Calle 3 100',pinCoordinates:null,pinStatus:''})
  const merged=mergeProgramDraft(base,edited,base)
  assert.equal(merged[0].detalles[0].pinCoordinates,null)
  assert.deepEqual(merged.slice(1),base.slice(1))
})
test('conserva un arrastre remoto y una edición local sin guardar',()=>{
  const base=draft(),remote=structuredClone(base),local=structuredClone(base)
  remote[1].detalles[0].pinCoordinates=[-62.07,-31.43]
  remote[1].detalles[0].pinStatus='manual'
  local[0].detalles[0].lugar='Nuevo lugar'
  const merged=mergeProgramDraft(remote,local,base)
  assert.equal(merged[0].detalles[0].lugar,'Nuevo lugar')
  assert.deepEqual(merged[1],remote[1])
  assert.deepEqual(mergeProgramDraft(merged,merged,merged),merged)
})
test('las altas remotas y las bajas locales no se pisan',()=>{
  const base=draft(),remote=[...base,{id:'extra',detalles:[]}]
  const merged=mergeProgramDraft(remote,base.slice(1),base)
  assert.equal(merged.some(s=>s.id==='s0'),false)
  assert.equal(merged.some(s=>s.id==='extra'),true)
  assert.deepEqual(mergeProgramDraft([],base,[]),base)
})
test('cinco banderas comparten punto, mantienen coordenadas y hoy queda arriba',()=>{
  const posts=Array.from({length:5},(_,i)=>({id:String(i),label:i===0?'MIE - PM':'SAB - AM',coordinates:[-62.06,-31.44]}))
  const layout=layoutAssignmentPosts(posts,'MIE')
  assert.equal(new Set(layout.map(p=>p.stemHeight)).size,5)
  assert.equal(layout[0].stemHeight,Math.max(...layout.map(p=>p.stemHeight)))
  layout.forEach(p=>{assert.equal(p.offsetX,0);assert.deepEqual(p.coordinates,[-62.06,-31.44])})
  assert.deepEqual(layoutAssignmentPosts([...posts].reverse(),'MIE').sort((a,b)=>a.id.localeCompare(b.id)),layout)
})
test('la referencia JW reemplaza todas las huellas anteriores',()=>{
  assert.deepEqual(BUILDING_PLACES.find(p=>p.id==='jw').bounds,[[-62.0686448,-31.4404423,-62.0684999,-31.4402066]])
})
