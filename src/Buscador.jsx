import { useState, useRef, useEffect } from 'react'
import { IconSearch } from './icons.jsx'
import {programOrderAssignments,assignmentSearchTitle,assignmentCanNavigate,assignmentTerritoryText} from './assignmentSearch.js'

// Las opciones son las salidas públicas del programa, no todos los territorios.
export default function Buscador({ data, assignments=[], posts=[], onPick }) {
  const [open, setOpen] = useState(false)
  const sheetRef=useRef(null)

  useEffect(() => {
    if(!open)return
    const previous=document.activeElement
    sheetRef.current?.querySelector('button')?.focus()
    const keys=event=>{
      if(event.key==='Escape'){event.preventDefault();setOpen(false)}
      if(event.key==='Tab'){
        const elements=[...sheetRef.current.querySelectorAll('button')]
        const first=elements[0],last=elements[elements.length-1]
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',keys)
    return()=>{document.removeEventListener('keydown',keys);previous?.focus()}
  }, [open])

  if (!data) return null

  const close = () => { setOpen(false) }

  const results=programOrderAssignments(assignments)

  const pick = (assignment) => { if(!assignmentCanNavigate(assignment,data))return;onPick(assignment.territorio);close() }

  return (
    <>
      <button className="search-fab" onClick={() => setOpen(true)} aria-label="Buscar salida">
        <IconSearch />
        <span>Buscar salida</span>
      </button>

      {open && (
        <div className="search-sheet-bg" onClick={close}>
          <div ref={sheetRef} className="search-sheet departure-search-sheet" role="dialog" aria-modal="true" aria-labelledby="departure-search-title" onClick={(e) => e.stopPropagation()}>
            <div className="search-grip" />
            <div className="search-head">
              <span id="departure-search-title">Buscar salida</span>
              <button className="search-x" onClick={close} aria-label="Cerrar">×</button>
            </div>
            <div className="territory-search-status">Elegí una salida del programa</div>
            <div className="search-list" aria-label="Salidas del programa">
              {results.length === 0 && <div className="search-empty">No hay salidas publicadas en el programa.</div>}
              {results.map((assignment) => {
                const valid=assignmentCanNavigate(assignment,data)
                const territoryText=assignmentTerritoryText(assignment,data)
                const color=posts.find(post=>post.id===assignment.id)?.color
                return <button key={assignment.id} className="search-item" aria-disabled={!valid} aria-label={`Salida ${assignmentSearchTitle(assignment)}, ${assignment.lugar?`${assignment.lugar}, `:''}${territoryText}`} onClick={() => pick(assignment)}>
                  <i className="departure-search-dot" style={{background:valid?(color||'var(--brand-orange)'):'var(--muted)'}} aria-hidden="true"/>
                  <span className="departure-search-copy"><b>{assignmentSearchTitle(assignment)}</b>{assignment.lugar&&<span className="departure-search-place">{assignment.lugar}</span>}<small>{territoryText}</small></span>
                  {valid&&<span className="departure-search-arrow" aria-hidden="true">›</span>}
                </button>
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
