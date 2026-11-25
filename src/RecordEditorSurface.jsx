import {useEffect,useRef} from 'react'

export default function RecordEditorSurface({modal,title,onClose,onDone,isNew,saving,children,onDelete,preview=false}) {
  const dialog=useRef(null)
  useEffect(()=>{
    if(!modal)return
    const node=dialog.current
    node.showModal()
    return()=>node.close()
  },[modal])
  if(!modal)return children
  return <dialog ref={dialog} className="programa-edit-dialog record-edit-dialog" aria-label={title} onCancel={event=>{event.preventDefault();if(!saving)onClose()}}>
    <header className="programa-edit-heading"><div><span className="record-editor-eyebrow">REGISTROS DE TERRITORIO</span><strong>{title}</strong><small>{isNew?'Completá el territorio y las fechas.':'Editá el período y las manzanas disponibles.'}</small></div><button type="button" disabled={saving} aria-label="Cerrar editor de registro" onClick={onClose}>×</button></header>
    <div className="programa-edit-scroll">{children}</div>
    <footer className="programa-edit-footer">{onDelete&&<button type="button" className="record-delete" disabled={saving} onClick={onDelete}>Eliminar registro</button>}<div><small>{preview?'Solo en esta prueba. Se descarta al recargar.':'Los cambios se publican con «Guardar».'}</small><button type="button" disabled={saving} onClick={onDone}>{isNew?'Agregar al borrador':'Listo'}</button></div></footer>
  </dialog>
}
