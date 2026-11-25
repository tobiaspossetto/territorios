import {programDate} from './programDates.js'

export const PROGRAM_WEEK_DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
export const normalizeProgramWeekStart = value => Number.isInteger(value) && value >= 0 && value <= 6 ? value : 0

export function programWeekStartDate(value, weekStart = 0) {
  const valid = programDate(value)
  if (!valid) return ''
  const date = new Date(`${valid}T12:00:00Z`)
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - (weekday - normalizeProgramWeekStart(weekStart) + 7) % 7)
  return date.toISOString().slice(0,10)
}

// Keep chronological order; mark boundaries even when the reference day has no outings.
export function programWeekBreaks(groups, weekStart = 0) {
  const start = normalizeProgramWeekStart(weekStart)
  let previousDate = '', previousDay = null
  return groups.map((group,index) => {
    const date = programWeekStartDate(group.fecha,start)
    const day = PROGRAM_WEEK_DAYS.findIndex(name => name.toLocaleLowerCase('es') === group.title?.toLocaleLowerCase('es'))
    const offset = day < 0 ? null : (day-start+7)%7
    const boundary = index > 0 && (date && previousDate ? date !== previousDate : !date && !previousDate && offset !== null && previousDay !== null && offset < previousDay)
    previousDate=date
    previousDay=offset
    return boundary ? {start:date} : null
  })
}
