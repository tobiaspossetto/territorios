const weekdays=['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO']
const localDateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'})

export function programDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return ''
  const date=new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:''
}
export function programWeekday(value) {
  const valid=programDate(value)
  return valid?weekdays[new Date(`${valid}T12:00:00Z`).getUTCDay()]:''
}
export function formatProgramDate(value) {
  return programDate(value)?value.split('-').reverse().join('/'):''
}
export function localProgramDate(date=new Date()) {
  const parts=Object.fromEntries(localDateFormatter.formatToParts(date).map(part=>[part.type,part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
// Only the public calendar expires dated entries. Admin retains the full draft.
// A legacy entry without a valid date cannot be assumed to have expired.
export function currentProgramAssignments(assignments,now=new Date()) {
  const today=localProgramDate(now)
  return (assignments||[]).filter(assignment=>{
    const date=programDate(assignment.fecha)
    return !date||date>=today
  })
}
export function isAssignmentToday(assignment,day,today) {
  const date=programDate(assignment.fecha)
  return date?date===(today||localProgramDate()):assignment.label.split(' - ')[0]===day
}

// Orden de presentación compartido por Programa, buscador y PNG.
// No modifica el borrador ni el orden de los grupos que comparten horario.
export function sortProgramEntries(entries) {
  const dayOrder=['LUN','MAR','MIE','JUE','VIE','SAB','DOM']
  const dayIndex=entry=>{
    const day=String(entry.dia||entry.label?.split(' - ')[0]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().slice(0,3)
    const index=dayOrder.indexOf(day)
    return index<0?7:index
  }
  const minutes=entry=>{
    const match=/^(\d{1,2}):(\d{2})$/.exec(String(entry.horario||''))
    if(match&&Number(match[1])<24&&Number(match[2])<60)return Number(match[1])*60+Number(match[2])
    const turn=entry.label?.split(' - ')[1]
    return turn==='AM'?0:turn==='PM'?720:1440
  }
  return [...(entries||[])].sort((a,b)=>{
    const dateA=programDate(a.fecha),dateB=programDate(b.fecha)
    if(dateA&&dateB)return dateA.localeCompare(dateB)||minutes(a)-minutes(b)
    if(dateA||dateB)return dateA?-1:1
    return dayIndex(a)-dayIndex(b)||minutes(a)-minutes(b)
  })
}
