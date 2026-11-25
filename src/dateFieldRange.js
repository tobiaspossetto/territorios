import {parseDate} from '@internationalized/date'

export function optionalCalendarDate(value) {
  if(!value)return undefined
  try{return parseDate(value)}catch{return undefined}
}

export function dateFieldRange(min,max) {
  const minValue=optionalCalendarDate(min)
  const maxValue=optionalCalendarDate(max)
  const conflict=Boolean(minValue&&maxValue&&minValue.compare(maxValue)>0)
  // Calendar's focus correction cannot converge when the interval is empty.
  // Preserve the upper limit; the field stays read-only until its source is fixed.
  return {minValue:conflict?undefined:minValue,maxValue,conflict}
}
