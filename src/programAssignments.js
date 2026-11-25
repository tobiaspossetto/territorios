import {programDate,programWeekday,isAssignmentToday} from './programDates.js'

export function assignmentDay(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Cordoba', weekday: 'short' }).format(date)
  return {Mon:'LUN',Tue:'MAR',Wed:'MIE',Thu:'JUE',Fri:'VIE',Sat:'SAB',Sun:'DOM'}[weekday]
}

export function validPinCoordinates(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}

export function firstProgramTerritory(value) {
  const first=String(value||'').split(',')[0].trim().toUpperCase()
  return /^T\d+$/.test(first)?first:null
}

export function programTerritories(value) {
  return [...new Set(String(value||'').split(',').map(item=>item.trim().toUpperCase()).filter(item=>/^T\d+$/.test(item)))]
}

export function assignmentTerritories(assignment) {
  return [...new Set([assignment.territorio,...(Array.isArray(assignment.territorios)?assignment.territorios:[])].filter(item=>/^T\d+$/.test(item)))]
}

export function visibleMapAssignments(assignments) {
  return assignments.filter(assignment => assignment.ocultarBandera !== true)
}

export function programDetailHidden(salida, detalle) {
  // El valor individual tiene prioridad; conservar el antiguo tilde general.
  return typeof detalle.ocultarBandera === 'boolean' ? detalle.ocultarBandera : salida.ocultarBandera === true
}

export function programGroups(value) {
  const groups=String(value||'').split(/[,;·/]+/).flatMap(value=>{
    const text=value.trim()
    if(!text)return []
    // Keep legacy numeric combinations; free names retain their spelling.
    if(/^G\s*\d+(?:(?:\s+-\s+|\s+Y\s+|\s+)G\s*\d+)*$/i.test(text)) {
      return [...text.matchAll(/G\s*(\d+)/gi)].map(match=>`G${Number(match[1])}`)
    }
    return [text]
  })
  return [...new Set(groups)]
}

export function assignmentGroupLabel(assignment) {
  return typeof assignment.groupLabel==='string'?assignment.groupLabel.trim():String(assignment.label||'').split(' - ').slice(2).join(' · ')
}

export function nextProgramGroup(details = []) {
  const used = new Set(details.flatMap(detail => programGroups(detail.grupo)))
  let number = 1
  while (used.has(`G${number}`)) number += 1
  return `G${number}`
}

export function applyAssignmentColors(data,posts) {
  if(!data)return null
  const colors=Object.create(null)
  for(const post of [...posts].sort((a,b)=>a.id.localeCompare(b.id))){
    for(const territory of assignmentTerritories(post))if(!colors[territory])colors[territory]=post
  }
  return {...data,features:data.features.map(feature=>({...feature,properties:{...feature.properties,
    assignmentColor:colors[feature.properties.territorio]?.color||null,
    assignmentInk:colors[feature.properties.territorio]?.ink||null,
  }}))}
}

// Un único punto de encuentro, varias etiquetas: apilar sin mover coordenadas.
export function layoutAssignmentPosts(posts,day) {
  const groups=[]
  for(const post of [...posts].sort((a,b)=>a.id.localeCompare(b.id))){
    let group=groups.find(items=>Math.abs(items[0].coordinates[0]-post.coordinates[0])<.00002&&Math.abs(items[0].coordinates[1]-post.coordinates[1])<.00002)
    if(!group){group=[];groups.push(group)}
    group.push(post)
  }
  const positions=new Map()
  for(const group of groups){
    group.sort((a,b)=>Number(isAssignmentToday(a,day))-Number(isAssignmentToday(b,day))||a.id.localeCompare(b.id))
    group.forEach((post,index)=>positions.set(post.id,{offsetX:0,stemHeight:32+index*26}))
  }
  return posts.map(post=>({...post,...positions.get(post.id)}))
}

// Distribuir los tonos disponibles entre los territorios presentes, sin verdes.
// Reordenar salidas o agregar otro pin al mismo territorio no cambia la paleta.
export function assignmentColorsByTerritory(assignments) {
  // Familias visualmente distintas, intercaladas; no una sucesión de azules/lilas.
  const palette = [
    [28, 88, 70],   // naranja
    [215, 78, 73],  // azul
    [48, 88, 66],   // amarillo
    [280, 52, 75],  // violeta
    [5, 77, 74],    // coral
    [195, 73, 70],  // celeste
    [22, 34, 64],   // marrón arena
    [328, 75, 79],  // rosa
    [225, 19, 69],  // gris azulado
  ]
  // Territorios de una misma salida comparten color, también si se cruzan con otra.
  const parents=new Map()
  const root=id=>{if(!parents.has(id))parents.set(id,id);if(parents.get(id)!==id)parents.set(id,root(parents.get(id)));return parents.get(id)}
  for(const assignment of assignments){
    const ids=assignmentTerritories(assignment)
    for(const id of ids)parents.set(root(id),root(ids[0]))
  }
  const territories = [...parents.keys()]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)) || a.localeCompare(b))
  const groups=[...new Set(territories.map(root))]
  return Object.fromEntries(territories.map((territory) => {
    const index=groups.indexOf(root(territory))
    const [hue, saturation, lightness] = palette[index % palette.length]
    const cycle = Math.floor(index / palette.length)
    return [territory, {
      color: `hsl(${hue}, ${saturation}%, ${lightness - cycle * 3}%)`,
      ink: `hsl(${hue}, ${Math.min(saturation, 65)}%, 24%)`,
    }]
  }))
}

// La dirección opcional, lugar, conductor y horario forman parte del
// programa público, junto con los territorios y la ubicación de cada salida.
export function buildPublicProgramAssignments(salidas) {
  const days = { LUNES: 'LUN', MARTES: 'MAR', MIÉRCOLES: 'MIE', JUEVES: 'JUE', VIERNES: 'VIE', SÁBADO: 'SAB', DOMINGO: 'DOM' }
  const assignments = []
  for (const [si, salida] of (salidas || []).entries()) {
    const fecha=programDate(salida.fecha)
    const dia=programWeekday(fecha)||salida.dia
    const hour = Number(String(salida.horario || '').split(':')[0])
    if (!salida.horario || !Number.isFinite(hour) || !days[dia]) continue
    for (const [di, detalle] of (salida.detalles || []).entries()) {
      const territorio = firstProgramTerritory(detalle.territorio)
      const groups = salida.grupos ? programGroups(detalle.grupo) : []
      assignments.push({
        id: `${salida.id || si}:${detalle.id || di}`,
        salidaId: salida.id || String(si), detalleId: detalle.id || String(di),
        territorio,territorios:programTerritories(detalle.territorio),territorioTexto:String(detalle.territorio||''),
        lugar:String(detalle.lugar||''),
        ...(detalle.direccion?.trim()?{direccion:detalle.direccion.trim()}:{}),
        conductor:String(detalle.conductor||''),horario:String(salida.horario),
        ...(fecha?{fecha}:{}),
        label: [days[dia], hour >= 12 ? 'PM' : 'AM', ...groups].join(' - '),
        ...(groups.length?{groupLabel:groups.join(' · ')}:{}),
        group: salida.grupos === true,
        ocultarBandera: programDetailHidden(salida, detalle),
        coordinates: validPinCoordinates(detalle.pinCoordinates) ? detalle.pinCoordinates : null,
      })
    }
  }
  return assignments
}
