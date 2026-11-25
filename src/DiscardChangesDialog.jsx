import {useEffect,useRef} from 'react'
import './discard-changes.css'

export default function DiscardChangesDialog({message,confirmLabel,onConfirm,onCancel}) {
  const dialog=useRef(null)
  useEffect(()=>{
    const node=dialog.current
    node.showModal()
    return()=>node.close()
  },[])
  return <dialog ref={dialog} className="discard-changes-dialog" aria-labelledby="discard-changes-title" aria-describedby="discard-changes-description" onClick={event=>event.stopPropagation()} onCancel={event=>{event.preventDefault();onCancel()}}>
    <div className="discard-changes-icon" aria-hidden="true">!</div>
    <h2 id="discard-changes-title">Cambios sin guardar</h2>
    <p id="discard-changes-description">{message}</p>
    <div className="discard-changes-actions">
      <button type="button" autoFocus onClick={onCancel}>Seguir editando</button>
      <button type="button" className="discard-changes-confirm" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </dialog>
}
