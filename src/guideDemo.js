// Datos ficticios compartidos por las capturas públicas y el editor en preview.
export const guideDemoProgram = (reference=new Date()) => {
  const monday=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate())
  monday.setDate(monday.getDate()-(monday.getDay()+6)%7)
  const dateFor=index=>{
    const date=new Date(monday)
    date.setDate(date.getDate()+index)
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  }
  return [
  { id:'demo-lun', dia:'LUNES', horario:'17:15', grupos:false, detalles:[{id:'lun',lugar:'Plaza del barrio',territorio:'T28',conductor:'Ana M.'}] },
  { id:'demo-mar', dia:'MARTES', horario:'09:45', grupos:false, detalles:[{id:'mar',lugar:'Punto de encuentro',territorio:'T25',conductor:'Luis D.',pinCoordinates:[-62.0659,-31.4333],pinStatus:'manual'}] },
  { id:'demo-mie', dia:'MIÉRCOLES', horario:'17:15', grupos:false, detalles:[{id:'mie',lugar:'Centro de salud',territorio:'T31',conductor:'Jorge P.'}] },
  { id:'demo-jue', dia:'JUEVES', horario:'09:45', grupos:false, detalles:[{id:'jue',lugar:'Recorrido comercial',territorio:'NEGOCIOS',conductor:'Ana M.'}] },
  { id:'demo-vie', dia:'VIERNES', horario:'17:15', grupos:false, detalles:[{id:'vie',lugar:'Esquina del club',territorio:'T36, T35',conductor:'Luis D.'}] },
  { id:'demo-sab', dia:'SÁBADO', horario:'17:15', grupos:true, detalles:[
    {id:'sab12',grupo:'G1, G2',lugar:'Plaza del barrio',territorio:'T28',conductor:'Ana M.'},
    {id:'sab3',grupo:'G3',lugar:'Centro de salud',territorio:'T31',conductor:'Jorge P.',ocultarBandera:true},
    {id:'sab4',grupo:'G4',lugar:'Esquina del club',territorio:'T36',conductor:'Luis D.'},
  ] },
  { id:'demo-dom', dia:'DOMINGO', horario:'09:30', grupos:false, detalles:[{id:'dom',lugar:'Parque',territorio:'T18',conductor:'Jorge P.'}] },
].map((salida,index)=>({...salida,fecha:dateFor(index),detalles:salida.detalles.map((detalle,i)=>({...detalle,...(index===0?{direccion:'Calle 3 120',pinStatus:'center'}:index===5&&i===0?{direccion:'Calle 100 y Calle 3'}:{})}))}))
}

export const guideDemoSummaries = () => Object.fromEntries(Array.from({length:65},(_,index)=>{
  const n=index+1, done=[18,20,22,30,35,42].includes(n)
  return [`T${n}`,{veces:done?2:0,vecesServicio:done?1:0,vecesPorAnoServicio:{2025:done?1:0,2026:done?1:0},primeraInicio:done?'2025-09-01':null,campania:done||n===25,campaniaHecho:done,activo:n===25,
    primera:'2026-09-01',ultima:done?'2026-10-17':null,ultimaVisita:n===25?'2026-10-20':done?'2026-10-17':null,manzanasActivas:n===25?['1','3','4']:null}]
}))
