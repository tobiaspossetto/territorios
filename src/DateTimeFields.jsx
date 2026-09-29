import { I18nProvider } from '@react-aria/i18n'
import { parseDate, parseTime } from '@internationalized/date'
import { Button, DateField, DateInput, DateSegment, Label, TimeField } from 'react-aria-components'

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
  return (
    <I18nProvider locale="es-AR">
      <DateField
        className="aria-field"
        value={safeParse(value, parseDate)}
        minValue={safeParse(min, parseDate)}
        maxValue={safeParse(max, parseDate)}
        isDisabled={disabled}
        onChange={(next) => onChange(next?.toString() || '')}
      >
        <Label>{label}</Label>
        <div className="aria-field-control">
          <Segments />
          {value && <Button className="aria-clear" slot={null} onPress={() => onChange('')} aria-label={`Borrar ${label.toLowerCase()}`}>×</Button>}
        </div>
      </DateField>
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
