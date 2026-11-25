import {useEffect,useState} from 'react'
import {PROGRAM_WEEK_DAYS,normalizeProgramWeekStart} from './programWeeks.js'

export default function ProgramWeekSettings({value,onSave,preview=false}) {
  const [day,setDay]=useState(()=>normalizeProgramWeekStart(value))
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  useEffect(()=>{setDay(normalizeProgramWeekStart(value))},[value])
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');setMessage('')
    try {await onSave(day);setMessage(preview?'Guardado en esta prueba. Se descarta al recargar.':'Configuración guardada.')}
    catch {setError('No se pudo guardar. Volvé a intentarlo.')}
    finally {setBusy(false)}
  }
  return <form className="program-week-settings" onSubmit={save}>
    <label htmlFor="program-week-start">Comienzo de programa</label>
    <p id="program-week-hint">Día de referencia donde comienza un nuevo programa</p>
    <div><select id="program-week-start" aria-describedby="program-week-hint" value={day} disabled={busy} onChange={event=>{setDay(Number(event.target.value));setMessage('');setError('')}}>
      {PROGRAM_WEEK_DAYS.map((name,index)=><option key={name} value={index}>{name}</option>)}
    </select><button type="submit" className="admin-mini-btn primary" disabled={busy||day===normalizeProgramWeekStart(value)}>{busy?'Guardando…':'Guardar'}</button></div>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </form>
}
