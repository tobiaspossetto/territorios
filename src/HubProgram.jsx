import {Fragment,useEffect,useState} from 'react'
import {calendarProgramDays,assignmentCanNavigate,assignmentTerritoryText,assignmentPeriod,assignmentSearchTitle} from './assignmentSearch.js'
import {assignmentColorsByTerritory,assignmentGroupLabel,assignmentDay} from './programAssignments.js'
import {currentProgramAssignments,formatProgramDate,programWeekday,isAssignmentToday} from './programDates.js'
import {nextProgramAssignments} from './nextProgramAssignments.js'
import {programWeekBreaks} from './programWeeks.js'
import './hub-program.css'

function ProgramIcon({name='arrow'}) {
  const paths={arrow:'M5 12h14m-5-5 5 5-5 5',calendar:'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'}
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.arrow}/></svg>
}

export default function HubProgram({assignments,data,ready,onPick,day=assignmentDay(),weekStart=0}) {
  const [now,setNow]=useState(()=>new Date())
  useEffect(()=>{
    let timer
    const refresh=()=>{clearTimeout(timer);setNow(new Date());timer=setTimeout(refresh,60000-Date.now()%60000+50)}
    const resume=()=>{if(!document.hidden)refresh()}
    refresh()
    document.addEventListener('visibilitychange',resume)
    window.addEventListener('focus',resume)
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume)}
  },[])
  const groups=calendarProgramDays(currentProgramAssignments(assignments,now))
  const breaks=programWeekBreaks(groups,weekStart)
  const upcoming=nextProgramAssignments(assignments,now)
  const colors=assignmentColorsByTerritory(assignments.filter(a=>assignmentCanNavigate(a,data)))
  const outing=(a,compact=false)=>{
    const valid=assignmentCanNavigate(a,data),Tag=valid?'button':'div',label=assignmentGroupLabel(a),period=assignmentPeriod(a)
    return <Tag key={a.id} type={valid?'button':undefined} className={`hub-outing${compact?' hub-outing-next':''}`} style={{'--hub-outing':colors[a.territorio]?.color||'var(--dp-muted)','--hub-outing-ink':colors[a.territorio]?.ink||'var(--dp-text)'}} onClick={valid?()=>onPick(a):undefined} aria-label={valid?`Salida ${assignmentSearchTitle(a)}, ${a.lugar||'sin lugar'}, ${assignmentTerritoryText(a,data)}, ver en mapa`:undefined}>
      {!compact&&<span className="hub-time">{a.horario||a.label.split(' - ')[1]}{period&&<small>{period==='AM'?'Mañana':'Tarde'}</small>}</span>}
      <span className="hub-outing-body">{label&&<span className="hub-group">{label}</span>}<strong>{a.lugar||'Encuentro sin definir'}</strong>{a.direccion&&<small>{a.direccion}</small>}{!compact&&a.conductor&&<small>Conduce {a.conductor}</small>}<span className="hub-territories">{assignmentTerritoryText(a,data)}</span></span>
      {valid&&<span className="hub-map-action"><ProgramIcon/><span>Ver mapa</span></span>}
    </Tag>
  }
  return <section className="dp-program program-hub" aria-labelledby="hub-program-title">
    <div className="hub-content">
      <header className="hub-page-head"><h2 id="hub-program-title">Programa de salidas</h2></header>
      {!ready?<p role="status">Cargando programa…</p>:<div className="hub-layout">
        <section className="hub-upcoming" aria-labelledby="hub-next-title"><h3 id="hub-next-title"><ProgramIcon name="clock"/>Próxima salida</h3>{upcoming?<div className="hub-next-surface"><div className="hub-next-date">{programWeekday(upcoming.fecha)} · {formatProgramDate(upcoming.fecha)}<strong>{upcoming.horario}<small> hs</small></strong></div>{upcoming.assignments.map(a=>outing(a,true))}</div>:<p className="hub-empty">No hay próximas salidas con fecha y horario disponibles.</p>}</section>
        <section className="hub-week" aria-label="Salidas por día">
          {!groups.length?<p className="hub-empty">No hay salidas próximas publicadas.</p>:groups.map((group,index)=><Fragment key={`${group.id}:${group.fecha}`}>
            {breaks[index]&&<div className="program-week-divider" role="separator" aria-label="Próxima Semana"><span>Próxima Semana{breaks[index].start?` · desde el ${formatProgramDate(breaks[index].start)}`:''}</span></div>}
            <section className="hub-day" data-today={isAssignmentToday(group.assignments[0],day)} aria-label={`${group.title}, ${formatProgramDate(group.fecha)}`}><header><div><h3>{group.title}</h3>{isAssignmentToday(group.assignments[0],day)&&<span className="hub-today">Hoy</span>}</div>{group.fecha&&<time dateTime={group.fecha}>{formatProgramDate(group.fecha)}</time>}</header><div>{group.assignments.map(a=>outing(a))}</div></section>
          </Fragment>)}
        </section>
      </div>}
    </div>
  </section>
}
