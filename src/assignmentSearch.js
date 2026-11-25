const days=['LUN','MAR','MIE','JUE','VIE','SAB','DOM']
const names=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
import {programDate,formatProgramDate,sortProgramEntries} from './programDates.js'

export function assignmentSearchTitle(assignment) {
  const [day,turn]=assignment.label.split(' - ')
  const group=assignmentGroupLabel(assignment)
  return [names[days.indexOf(day)]||day,...(programDate(assignment.fecha)?[formatProgramDate(assignment.fecha)]:[]),turn,...(group?[group]:[])].filter(Boolean).join(' · ')
}

export function programOrderAssignments(assignments) {
  return sortProgramEntries(assignments)
}

export function assignmentPeriod(assignment) {
  if(!assignment)return ''
  const time=/^(\d{1,2}):(\d{2})$/.exec(assignment.horario||'')
  if(time&&Number(time[1])<24&&Number(time[2])<60)return Number(time[1])<12?'AM':'PM'
  return /(?:^| - )(AM|PM)(?: - |$)/.exec(assignment.label||'')?.[1]||''
}

export function assignmentCanNavigate(assignment,data) {
  return Boolean(assignment.territorio&&data?.features?.some(feature=>feature.properties.territorio===assignment.territorio))
}
import {assignmentTerritories,assignmentGroupLabel} from './programAssignments.js'


export function assignmentTerritoryText(assignment,data) {
  if(assignmentCanNavigate(assignment,data))return assignmentTerritories(assignment).join(' · ')
  return assignment.territorioTexto?.trim()?assignment.territorioTexto:(assignment.territorio||'Sin territorio')
}

export function groupProgramAssignments(assignments) {
  const groups=[]
  for(const assignment of programOrderAssignments(assignments)){
    const id=assignment.salidaId||assignment.id
    const title=assignmentSearchTitle(assignment).split(' · ')[0]
    const horario=assignment.horario||assignment.label.split(' - ')[1]
    const fecha=programDate(assignment.fecha)
    const previous=groups.at(-1)
    // Compartir día/fecha y hora sin alterar el orden de los grupos empatados.
    if(previous&&previous.fecha===fecha&&(previous.id===id||(previous.title===title&&previous.horario===horario&&horario?.includes(':'))))previous.assignments.push(assignment)
    else groups.push({id,title,horario,fecha,assignments:[assignment]})
  }
  return groups
}

// Calendar presentation groups a whole date, retaining each meeting's own time.
export function calendarProgramDays(assignments) {
  const result=[]
  for(const group of groupProgramAssignments(assignments)) {
    const previous=result.at(-1)
    if(previous&&previous.fecha===group.fecha&&previous.title===group.title)previous.assignments.push(...group.assignments)
    else result.push({...group,assignments:[...group.assignments]})
  }
  return result
}

export function territoryProgramSchedule(assignments,territory) {
  if(!territory)return []
  const selected=new Set(Array.isArray(territory)?territory:[territory])
  const groups=groupProgramAssignments((assignments||[]).filter(assignment=>assignmentTerritories(assignment).some(id=>selected.has(id))))
  const seen=new Set()
  return groups.filter(group=>{
    const key=JSON.stringify([group.fecha,group.title,group.horario])
    if(seen.has(key))return false
    seen.add(key)
    return true
  })
}
