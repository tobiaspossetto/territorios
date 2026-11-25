import {localProgramDate,programDate} from './programDates.js'

const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Cordoba',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
const days=['DOM','LUN','MAR','MIE','JUE','VIE','SAB']

// Explicit dates never recur. Legacy weekday-only entries use their next occurrence.
// Unknown dates/times remain in the calendar, but cannot be guessed as "next".
export function nextProgramAssignments(assignments,now=new Date()) {
  if(!Number.isFinite(now.getTime()))return null
  const today=localProgramDate(now)
  // Keep the current outing for two hours, then advance to the next one.
  const cutoff=new Date(now.getTime()-2*60*60*1000)
  const cutoffMinute=`${localProgramDate(cutoff)}T${clock.format(cutoff)}`
  const weekday=new Date(`${today}T12:00:00Z`).getUTCDay()
  let next=null
  for(const assignment of assignments||[]) {
    const time=/^(\d{1,2}):(\d{2})$/.exec(assignment.horario||'')
    if(!time||+time[1]>23||+time[2]>59)continue
    const horario=`${time[1].padStart(2,'0')}:${time[2]}`
    let fecha=programDate(assignment.fecha)
    if(assignment.fecha&&!fecha)continue
    if(!fecha) {
      const day=String(assignment.label||'').split(' - ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,3).toUpperCase()
      const index=days.indexOf(day)
      if(index<0)continue
      const offset=(index-weekday+7)%7
      const date=new Date(`${today}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate()+offset)
      const previous=new Date(date)
      previous.setUTCDate(previous.getUTCDate()-7)
      // The grace period can extend a late outing into the following day.
      if(`${previous.toISOString().slice(0,10)}T${horario}`>cutoffMinute)date.setTime(previous.getTime())
      else if(`${date.toISOString().slice(0,10)}T${horario}`<=cutoffMinute)date.setUTCDate(date.getUTCDate()+7)
      fecha=date.toISOString().slice(0,10)
    }
    const key=`${fecha}T${horario}`
    if(key<=cutoffMinute)continue
    if(!next||key<next.key)next={key,fecha,horario,assignments:[assignment]}
    else if(key===next.key)next.assignments.push(assignment)
  }
  return next
}
