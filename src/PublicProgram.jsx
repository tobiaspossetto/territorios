import {IconCalendar} from './icons.jsx'
import {formatProgramDate,isAssignmentToday,currentProgramAssignments} from './programDates.js'
import {assignmentColorsByTerritory,assignmentDay,assignmentGroupLabel} from './programAssignments.js'
import {groupProgramAssignments,assignmentCanNavigate,assignmentTerritoryText,assignmentSearchTitle} from './assignmentSearch.js'

export default function PublicProgram({assignments,data,ready,onPick,day=assignmentDay()}) {
  const groups=groupProgramAssignments(currentProgramAssignments(assignments))
  const palette=assignmentColorsByTerritory(assignments.filter(assignment=>assignmentCanNavigate(assignment,data)))
  return <section className="public-program" aria-labelledby="public-program-title">
    <div className="public-program-content">
      <header className="public-program-heading"><span className="public-program-mark"><IconCalendar/></span><div><h2 id="public-program-title">Programa</h2><p>Salidas de predicación</p><p className="public-program-hint">Toque una fila para verlo en el mapa</p></div></header>
      {!ready?<p role="status" className="public-program-empty">Cargando programa…</p>:!groups.length?<p className="public-program-empty">Todavía no hay salidas publicadas.</p>:<div className="public-program-table-wrap"><table className="public-program-table" aria-label="Salidas a la predicación">
        <colgroup><col/><col/><col/><col/></colgroup>
        <thead><tr><th scope="col">Día</th><th scope="col">Lugar</th><th scope="col">Territorio</th><th scope="col">Conductor</th></tr></thead>
        {groups.map(group=><tbody key={`${group.id}:${group.fecha}`} data-grouped={group.assignments.length>1} aria-label={`${group.title}, ${formatProgramDate(group.fecha)}, ${group.horario}`}>
        {group.assignments.map((assignment,index)=>{
          const today=isAssignmentToday(assignment,day)
          const valid=assignmentCanNavigate(assignment,data)
          const groupLabel=assignmentGroupLabel(assignment)
          const territory=assignmentTerritoryText(assignment,data)
          const colors=!valid?{color:'#000',ink:'#fff'}:!assignment.ocultarBandera?palette[assignment.territorio]:null
          const address=assignment.direccion?.trim()
          const content=<>{groupLabel&&<span className="public-program-group">{groupLabel}</span>}<span className="public-program-place-name">{assignment.lugar||'Sin lugar indicado'}</span>{address&&<span className="public-program-address">{address}</span>}</>
          return <tr key={assignment.id} data-today={today} data-navigable={valid} data-map-color={Boolean(colors)} style={colors?{'--outing-color':colors.color,'--outing-ink':colors.ink}:undefined} onClick={()=>{if(valid)onPick(assignment)}}>
            {index===0&&<th scope={group.assignments.length>1?'rowgroup':'row'} rowSpan={group.assignments.length} className="public-program-day-cell" onClick={event=>{if(group.assignments.length>1)event.stopPropagation()}}><div className="public-program-day-heading"><strong>{group.title}</strong>{today&&<span className="public-program-today">Hoy</span>}</div>{group.fecha&&<time className="public-program-date" dateTime={group.fecha}>{formatProgramDate(group.fecha)}</time>}<span>{group.horario}{group.horario?.includes(':')?' hs':''}</span></th>}
            <td>{valid?<button type="button" className="public-program-place-button" aria-label={`Salida ${assignmentSearchTitle(assignment)}, ${assignment.lugar||'sin lugar'}${address?`, ${address}`:''}, ${territory}${assignment.conductor?`, ${assignment.conductor}`:''}, ver en mapa`}>{content}</button>:<span className="public-program-place-text">{content}</span>}</td>
            <td className="public-program-territory"><span className="public-program-territory-pill">{territory}</span></td>
            <td className="public-program-conductor">{assignment.conductor||'—'}</td>
          </tr>
        })}
        </tbody>)}
      </table></div>}
    </div>
  </section>
}
