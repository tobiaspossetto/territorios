import {useId, useState} from 'react'

export default function TerritoryDetails({children, defaultOpen}) {
  const [open, setOpen] = useState(() => defaultOpen ?? window.matchMedia('(min-width: 721px)').matches)
  const id = useId()
  return <div className="territory-detail-data">
    <button type="button" className="territory-detail-toggle" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
      <span>{open ? 'Ocultar estadísticas' : 'Ver estadísticas'}</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
    <div id={id} hidden={!open}>{children}</div>
  </div>
}
