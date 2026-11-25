import {Fragment,useEffect,useState} from 'react'
import {programWeekBreaks} from './programWeeks.js'
import {formatProgramDate, isAssignmentToday,programWeekday,currentProgramAssignments} from './programDates.js'
import {nextProgramAssignments} from './nextProgramAssignments.js'
import {assignmentColorsByTerritory, assignmentDay,assignmentGroupLabel} from './programAssignments.js'
import {calendarProgramDays, assignmentCanNavigate, assignmentTerritoryText, assignmentSearchTitle, assignmentPeriod} from './assignmentSearch.js'

export default function DesignProgram({assignments, data, ready, onPick, preview=false, day=assignmentDay(), weekStart=0}) {
  const [now,setNow]=useState(()=>new Date())
  useEffect(()=>{
    let timer
    const refresh=()=>{
      clearTimeout(timer)
      setNow(new Date())
      timer=setTimeout(refresh,60000-Date.now()%60000+50)
    }
    const resume=()=>{if(!document.hidden)refresh()}
    refresh()
    document.addEventListener('visibilitychange',resume)
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',resume)}
  },[])
  const groups = calendarProgramDays(currentProgramAssignments(assignments,now))
  const weekBreaks = programWeekBreaks(groups,weekStart)
  const next=nextProgramAssignments(assignments,now)
  const palette = assignmentColorsByTerritory(assignments.filter(a=>assignmentCanNavigate(a,data)))
  return <section className="dp-program dp-program-minimal" aria-labelledby="dp-program-title">
    <div className="dp-program-inner">
      <header className="dp-program-heading">
        <h2 id="dp-program-title">Programa de salidas</h2>
        <p className="dp-program-hint">Tocá una salida para verla en el mapa.</p>
      </header>
      {ready&&<aside className="dp-next" data-has-next={!!next} aria-labelledby="dp-next-title">
        <div className="dp-next-heading"><h3 id="dp-next-title">PRÓXIMA SALIDA</h3>{next&&<span>{programWeekday(next.fecha).toLocaleLowerCase('es-AR')} · {formatProgramDate(next.fecha)} <b>{next.horario} hs</b></span>}</div>
        {next?<div className="dp-next-list">{next.assignments.map(assignment=>{
          const valid=assignmentCanNavigate(assignment,data)
          const colors=valid?palette[assignment.territorio]:null
          const label=assignmentGroupLabel(assignment)
          const Tag=valid?'button':'div'
          return <Tag key={assignment.id} type={valid?'button':undefined} className="dp-next-item" style={{'--outing-color':colors?.color||'#151515','--outing-ink':colors?.ink||'#fff'}} onClick={valid?()=>onPick(assignment):undefined}>
            <span><strong>{assignment.lugar||'Sin lugar indicado'}</strong>{(label||assignment.direccion)&&<span className="dp-next-meta">{label&&<b className="dp-group-label">{label}</b>}{assignment.direccion&&<small>{assignment.direccion}</small>}</span>}</span>
            <b>{assignmentTerritoryText(assignment,data)}</b>{valid&&<svg className="dp-next-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg>}
          </Tag>
        })}</div>:<p>No hay próximas salidas con fecha y horario disponibles.</p>}
      </aside>}
      {!ready ? <p role="status">Cargando programa…</p> : !groups.length ? <p className="dp-empty">No hay salidas próximas publicadas.</p> :
      <div className="dp-schedule">{groups.map((group,index)=>{
        const isToday=isAssignmentToday(group.assignments[0],day)
        return <Fragment key={`${group.id}:${group.fecha}`}>
        {weekBreaks[index]&&<div className="program-week-divider" role="separator" aria-label="Próxima Semana"><span>Próxima Semana{weekBreaks[index].start?` · desde el ${formatProgramDate(weekBreaks[index].start)}`:''}</span></div>}
        <section className="dp-day" data-today={isToday} aria-label={`${group.title}, ${formatProgramDate(group.fecha)}`}>
          <div className="dp-day-heading"><div><h3>{group.title}</h3>{isToday&&<span className="dp-today">HOY</span>}</div>{group.fecha&&<time dateTime={group.fecha||undefined}>{formatProgramDate(group.fecha)}</time>}</div>
          <div className="dp-day-outings">{group.assignments.map((assignment,assignmentIndex)=>{
            const valid=assignmentCanNavigate(assignment,data)
            const colors=valid?palette[assignment.territorio]:null
            const label=assignmentGroupLabel(assignment)
            const Tag=valid?'button':'div'
            const period=assignmentPeriod(assignment)
            const showPeriod=period&&period!==assignmentPeriod(group.assignments[assignmentIndex-1])
            return <Fragment key={assignment.id}>
              {showPeriod&&<h4 className="dp-period-heading" data-period={period}><b>{period}</b><span>{period==='AM'?'Mañana':'Tarde'}</span></h4>}
              <Tag type={valid?'button':undefined} className="dp-outing" data-navigable={valid} style={{'--outing-color':valid?(colors?.color||'var(--dp-accent)'):'#151515','--outing-ink':valid?(colors?.ink||'var(--dp-text)'):'#fff'}} aria-label={valid?`Salida ${assignmentSearchTitle(assignment)}, ${assignment.lugar||'sin lugar'}, ${assignmentTerritoryText(assignment,data)}, ver en mapa`:undefined} onClick={valid?()=>onPick(assignment):undefined}>
              <span className="dp-outing-time">{assignment.horario||assignment.label.split(' - ')[1]}</span>
              <span className="dp-outing-place"><span>{label&&<b className="dp-group-label">{label}</b>}<strong>{assignment.lugar||'Sin lugar indicado'}</strong></span>{assignment.direccion&&<small>{assignment.direccion}</small>}{assignment.conductor&&<span className="dp-outing-person">Conduce {assignment.conductor}</span>}</span>
              <span className="dp-outing-territory" aria-label="Territorios"><b>{assignmentTerritoryText(assignment,data)}</b></span>
              <span className="dp-outing-arrow" aria-hidden="true">{valid?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 18 18 6M6 6h12v12"/></svg>:'—'}</span>
            </Tag></Fragment>
          })}</div>
        </section></Fragment>
      })}</div>}
      {preview&&<p className="dp-program-note"><span aria-hidden="true"/> Vista de prueba · programa de ejemplo, sin cambios en los datos reales.</p>}
    </div>
  </section>
}
