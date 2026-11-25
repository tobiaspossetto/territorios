import { useCallback, useMemo, useState } from 'react'
import {createPortal} from 'react-dom'
import { I18nProvider } from '@react-aria/i18n'
import { parseDate, parseTime } from '@internationalized/date'
import { Button, Calendar, CalendarCell, CalendarGrid, DatePicker, DateInput, DateSegment, Dialog, Group, Heading, Label, Popover, Text, TimeField } from 'react-aria-components'
import { IconCalendar } from './icons'
import './date-picker.css'
import {dateFieldRange} from './dateFieldRange.js'

const safeParse = (value, parser) => {
  if (!value) return null
  try { return parser(value) } catch { return null }
}

function Segments() {
  return <DateInput className="aria-date-input">{(segment) => (
    <DateSegment segment={segment} className="aria-date-segment">
      {({ text, type, isPlaceholder }) => !isPlaceholder && ['day', 'month', 'hour', 'minute'].includes(type) ? text.padStart(2, '0') : text}
    </DateSegment>
  )}</DateInput>
}

export function AppDateField({ label, value, onChange, min, max, disabled = false }) {
  const parsedValue=useMemo(()=>safeParse(value,parseDate),[value])
  const range=useMemo(()=>dateFieldRange(min,max),[min,max])
  const [portalContainer, setPortalContainer] = useState(undefined)
  const [portalHost,setPortalHost]=useState(null)
  // A fixed layer gives the positioner viewport coordinates while remaining
  // inside the native dialog's focus scope and top layer.
  const pickerRef = useCallback(node => {
    if (node) setPortalHost(node.closest('dialog') || node.closest('.app-v2') || document.body)
  }, [])
  return (
    <I18nProvider locale="es-AR">
      {portalHost&&createPortal(<div className="date-calendar-layer" ref={setPortalContainer}/>,portalHost)}
      <DatePicker
        ref={pickerRef}
        className="aria-field"
        value={parsedValue}
        minValue={range.minValue}
        maxValue={range.maxValue}
        isReadOnly={range.conflict}
        isInvalid={range.conflict||undefined}
        isDisabled={disabled}
        onChange={(next) => onChange(next?.toString() || '')}
      >
        <Label>{label}</Label>
        <Group className="aria-field-control">
          <Segments />
          {value && <Button className="aria-clear" slot={null} onPress={() => onChange('')} aria-label={`Borrar ${label.toLowerCase()}`}>×</Button>}
          <Button className="date-calendar-trigger" aria-label={`Abrir calendario: ${label.toLowerCase()}`}><IconCalendar aria-hidden="true" /></Button>
        </Group>
        {range.conflict&&<Text slot="description" className="date-calendar-hint">Revisá la fecha de inicio: es posterior al límite permitido para este campo.</Text>}
        <Popover className="date-calendar-popover" placement="bottom start" offset={6} containerPadding={8} UNSTABLE_portalContainer={portalContainer}>
          <Dialog className="date-calendar-dialog" aria-label={`Seleccionar ${label.toLowerCase()}`}>
            <Calendar className="date-calendar">
              <header className="date-calendar-heading">
                <Button slot="previous" className="date-calendar-nav" aria-label="Mes anterior">‹</Button>
                <Heading />
                <Button slot="next" className="date-calendar-nav" aria-label="Mes siguiente">›</Button>
              </header>
              <CalendarGrid weekdayStyle="short">
                {date => <CalendarCell date={date} className="date-calendar-cell" />}
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  )
}

export function AppTimeField({ label, value, onChange, disabled = false }) {
  return (
    <I18nProvider locale="es-AR">
      <TimeField
        className="aria-field"
        value={safeParse(value, parseTime)}
        granularity="minute"
        hourCycle={24}
        isDisabled={disabled}
        onChange={(next) => onChange(next ? `${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}` : '')}
      >
        <Label>{label}</Label>
        <div className="aria-field-control">
          <Segments />
          {value && <Button className="aria-clear" slot={null} onPress={() => onChange('')} aria-label={`Borrar ${label.toLowerCase()}`}>×</Button>}
        </div>
      </TimeField>
    </I18nProvider>
  )
}
