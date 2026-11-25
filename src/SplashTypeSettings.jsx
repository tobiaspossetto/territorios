import {useState} from 'react'
import {normalizeSplashType} from './splashType.js'

export default function SplashTypeSettings({value,onSave,preview=false}) {
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const selected=normalizeSplashType(value)
  const choose=async type=>{
    if(busy||type===selected)return
    setBusy(true);setMessage('');setError('')
    try {await onSave(type);setMessage(preview?'Guardado en esta prueba. Se descarta al recargar.':'Guardado. Se usará al volver a abrir la app.')}
    catch {setError('No se pudo guardar. Volvé a intentarlo.')}
    finally {setBusy(false)}
  }
  return <section className="splash-type-settings" aria-labelledby="splash-type-title">
    <h3 id="splash-type-title">Tipo de carga</h3>
    <p>Elegí la pantalla que se muestra al abrir la app.</p>
    <div className="splash-type-options" role="group" aria-label="Tipo de carga">
      {[['auto','Auto'],['collage','Collage']].map(([type,label])=><button type="button" key={type} className="admin-mini-btn" aria-pressed={selected===type} disabled={busy} onClick={()=>choose(type)}>{label}</button>)}
    </div>
    <p>{selected==='auto'?'Auto: video de la camioneta, según el tema.':'Collage: ilustraciones aleatorias y barra de carga.'}</p>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </section>
}
