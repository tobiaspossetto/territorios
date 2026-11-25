import test from 'node:test'
import assert from 'node:assert/strict'
import {programOrderAssignments,assignmentSearchTitle,assignmentCanNavigate,assignmentTerritoryText,groupProgramAssignments,calendarProgramDays} from '../src/assignmentSearch.js'
import {buildPublicProgramAssignments,visibleMapAssignments,applyAssignmentColors,programGroups} from '../src/programAssignments.js'
import {mergeProgramDraft} from '../src/programDraftMerge.js'

test('ocultar bandera conserva la salida pública y posiciones pero quita solo su resaltado',()=>{
  const base=[{id:'s',dia:'SÁBADO',horario:'17:00',grupos:true,detalles:[{id:'1',territorio:'T13, T14',pinCoordinates:[-62,-31]},{id:'2',territorio:'T15'}]},
    {id:'otra',dia:'LUNES',horario:'09:00',detalles:[{id:'x',territorio:'T14'}]}]
  const incoming=base.map(s=>s.id==='s'?{...s,ocultarBandera:true}:s)
  const merged=mergeProgramDraft(base,incoming,base)
  const published=buildPublicProgramAssignments(merged)
  assert.equal(published.length,3)
  assert.deepEqual(published[0].coordinates,[-62,-31])
  assert.deepEqual(visibleMapAssignments(published).map(a=>a.id),['otra:x'])
  const data={features:['T13','T14','T15'].map(territorio=>({properties:{territorio}}))}
  const colored=applyAssignmentColors(data,visibleMapAssignments(published).map(a=>({...a,color:'blue',ink:'navy'})))
  assert.deepEqual(colored.features.map(f=>f.properties.assignmentColor),[null,'blue',null])
  const restored=buildPublicProgramAssignments(merged.map(s=>({...s,ocultarBandera:false})))
  assert.equal(visibleMapAssignments(restored).length,3)
  assert.equal(visibleMapAssignments([{id:'legacy'}]).length,1)
})
const assignments=[
  {id:'s1',label:'SAB - PM - G2',territorio:'T13',territorios:['T13','T14']},
  {id:'s2',label:'JUE - AM',territorio:'T51'},
  {id:'s3',label:'SAB - AM',territorio:'T20'},
  {id:'s4',label:'SAB - PM - G1',territorio:'T30'},
]
test('calendario agrupa todo el día con horarios propios, sin mezclar fechas ni modificar filas',()=>{
  const entries=[{id:'pm',fecha:'2026-10-27',horario:'17:45',label:'MAR - PM'}, {id:'am',fecha:'2026-10-27',horario:'09:45',label:'MAR - AM'}, {id:'next-week',fecha:'2026-11-03',horario:'09:45',label:'MAR - AM'}]
  const snapshot=JSON.stringify(entries)
  const result=calendarProgramDays(entries)
  assert.equal(result.length,2)
  assert.deepEqual(result[0].assignments.map(a=>[a.id,a.horario]),[['am','09:45'],['pm','17:45']])
  assert.equal(JSON.stringify(entries),snapshot)
})
test('oculta cada lugar por separado y respeta el tilde general antiguo',()=>{
  const base=[{id:'s',dia:'SÁBADO',horario:'17:15',grupos:true,ocultarBandera:true,detalles:[
    {id:'g1',grupo:'G1',territorio:'T13',pinCoordinates:[-62,-31]},
    {id:'g2',grupo:'G2',territorio:'T14',pinCoordinates:[-62.1,-31.1]},
  ]}]
  assert.equal(visibleMapAssignments(buildPublicProgramAssignments(base)).length,0)
  const incoming=base.map(s=>({...s,detalles:s.detalles.map(d=>d.id==='g2'?{...d,ocultarBandera:false}:d)}))
  const merged=mergeProgramDraft(base,incoming,base)
  const options=buildPublicProgramAssignments(merged)
  assert.deepEqual(options.map(a=>a.ocultarBandera),[true,false])
  assert.deepEqual(visibleMapAssignments(options).map(a=>a.id),['s:g2'])
  assert.deepEqual(options.map(a=>a.coordinates),[[-62,-31],[-62.1,-31.1]])
  const independent=[{...base[0],ocultarBandera:false,detalles:base[0].detalles.map(d=>({...d,ocultarBandera:d.id==='g1'}))}]
  assert.deepEqual(buildPublicProgramAssignments(independent).map(a=>a.ocultarBandera),[true,false])
})
test('varios grupos comparten una sola salida, bandera y territorio',()=>{
  assert.deepEqual(programGroups('G2, G1, G2'),['G2','G1'])
  assert.deepEqual(programGroups('g2 / G1'),['G2','G1'])
  assert.deepEqual(programGroups('G2 - G1'),['G2','G1'])
  assert.deepEqual(programGroups('G1'),['G1'])
  assert.deepEqual(programGroups(''),[])
  const options=buildPublicProgramAssignments([{id:'s',dia:'SÁBADO',horario:'17:15',grupos:true,detalles:[{id:'d',grupo:'G2, G1',lugar:'Nanci',territorio:'T37',pinCoordinates:[-62,-31]}]}])
  assert.equal(options.length,1)
  assert.equal(options[0].label,'SAB - PM - G2 - G1')
  assert.equal(options[0].label.split(' - ').slice(2).join(' · '),'G2 · G1')
  assert.equal(options[0].territorio,'T37')
  assert.deepEqual(options[0].coordinates,[-62,-31])
  assert.equal(groupProgramAssignments(options)[0].assignments.length,1)
})
test('agrupa salidas de igual día y hora después de ordenarlas',()=>{
  const entries=[
    {id:'a',salidaId:'a',label:'SAB - PM',horario:'17:15'},
    {id:'b',salidaId:'b',label:'SAB - PM - G2',horario:'17:15'},
    {id:'c',salidaId:'c',label:'SAB - PM',horario:'18:00'},
    {id:'d',salidaId:'d',label:'SAB - PM',horario:'17:15'},
  ]
  assert.deepEqual(groupProgramAssignments(entries).map(g=>g.assignments.map(a=>a.id)),[['a','b','d'],['c']])
})
test('las salidas por grupos se agrupan en cualquier día y horario',()=>{
  for(const [index,day] of ['LUN','MAR','MIE','JUE','VIE','SAB','DOM'].entries()){
    const options=['G1','G2'].map((group,i)=>({id:`${day}:${i}`,salidaId:day,label:`${day} - AM - ${group}`,horario:`0${index+1}:30`}))
    const grouped=groupProgramAssignments(options)
    assert.equal(grouped.length,1)
    assert.equal(grouped[0].assignments.length,2)
    assert.equal(grouped[0].horario,`0${index+1}:30`)
  }
})
test('ordena salidas antiguas por día y turno sin reordenar grupos empatados',()=>{
  assert.deepEqual(programOrderAssignments(assignments).map(a=>a.id),['s2','s3','s1','s4'])
  assert.equal(assignments[0].id,'s1')
  assert.equal(assignmentSearchTitle(assignments[0]),'Sábado · PM · G2')
})
test('conserva opciones distintas, el primer territorio y todos los asociados',()=>{
  assert.equal(programOrderAssignments(assignments).find(a=>a.id==='s1').territorio,'T13')
  assert.deepEqual(programOrderAssignments(assignments).find(a=>a.id==='s1').territorios,['T13','T14'])
  assert.deepEqual(programOrderAssignments([]),[])
  assert.equal(programOrderAssignments([...assignments,{...assignments[0],id:'other'}]).filter(a=>a.label==='SAB - PM - G2').length,2)
})
test('incluye salidas sin territorio, inválidas e inexistentes, sin navegación',()=>{
  const details=['T13','','texto','T999'].map((territorio,i)=>({id:String(i),territorio}))
  const publicOptions=buildPublicProgramAssignments([{id:'s',dia:'SÁBADO',horario:'17:00',detalles:details}])
  assert.equal(publicOptions.length,4)
  assert.equal(programOrderAssignments(publicOptions).length,4)
  const data={features:[{properties:{territorio:'T13'}}]}
  assert.deepEqual(publicOptions.map(a=>assignmentCanNavigate(a,data)),[true,false,false,false])
  assert.equal(Object.hasOwn(publicOptions[2],'direccion'),false)
  assert.deepEqual(publicOptions.map(a=>assignmentTerritoryText(a,data)),['T13','Sin territorio','texto','T999'])
})
test('la publicación mantiene el orden de filas y grupos y el texto no ubicable',()=>{
  const options=buildPublicProgramAssignments([
    {id:'a',dia:'SÁBADO',horario:'17:00',grupos:true,detalles:[{id:'g2',grupo:'G2',territorio:'Plaza central'},{id:'g1',grupo:'G1',territorio:'T13'}]},
    {id:'b',dia:'LUNES',horario:'09:00',detalles:[{id:'d',territorio:'Visitas'}]},
  ])
  assert.deepEqual(programOrderAssignments(options).map(a=>a.id),['b:d','a:g2','a:g1'])
  assert.equal(assignmentTerritoryText(options[0],{features:[]}), 'Plaza central')
  assert.equal(assignmentCanNavigate(options[0],{features:[]}),false)
  assert.equal(assignmentTerritoryText({territorio:'T999'},{features:[]}), 'T999')
})
test('publica dirección opcional junto al lugar sin depender de geocodificación',()=>{
  const details=[
    {id:'1',territorio:'T13',lugar:'Plaza central',direccion:'  Calle 3 123  ',conductor:'Nombre privado',pinStatus:'center'},
    {id:'2',territorio:'NEGOCIOS',lugar:'Punto de encuentro'},
    {id:'3',territorio:'T14'},
  ]
  const options=buildPublicProgramAssignments([{id:'s',dia:'SÁBADO',horario:'17:00',detalles:details}])
  assert.deepEqual(options.map(a=>a.lugar),['Plaza central','Punto de encuentro',''])
  assert.equal(options[0].conductor,'Nombre privado')
  assert.equal(options[0].horario,'17:00')
  assert.equal(options[0].direccion,'Calle 3 123')
  assert.equal(options[0].coordinates,null)
  for(const option of options.slice(1))assert.equal(Object.hasOwn(option,'direccion'),false)
})
test('agrupa el programa por salida conservando orden, grupos y horario',()=>{
  const options=buildPublicProgramAssignments([
    {id:'sab',dia:'SÁBADO',horario:'17:00',grupos:true,detalles:[{id:'2',grupo:'G2',territorio:'T13'},{id:'1',grupo:'G1',territorio:'NEGOCIOS'}]},
    {id:'lun',dia:'LUNES',horario:'09:30',detalles:[{id:'x',territorio:'T51'}]},
  ])
  const groups=groupProgramAssignments(options)
  assert.deepEqual(groups.map(g=>g.id),['lun','sab'])
  assert.equal(groups[1].title,'Sábado')
  assert.equal(groups[1].horario,'17:00')
  assert.deepEqual(groups[1].assignments.map(a=>a.detalleId),['2','1'])
  assert.equal(groups[1].assignments[1].territorioTexto,'NEGOCIOS')
})
