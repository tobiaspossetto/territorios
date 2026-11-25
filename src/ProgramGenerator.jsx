import { useEffect, useRef, useState } from 'react'
import { saveProgramDraft, subscribeProgramDraft } from './firebaseData.js'
import { AppDateField, AppTimeField } from './DateTimeFields.jsx'
import {programDate,programWeekday,formatProgramDate,sortProgramEntries} from './programDates.js'
import { geocodeAddress } from './geocodeAddress.js'
import { mergeProgramDraft } from './programDraftMerge.js'
import { firstProgramTerritory, programDetailHidden, nextProgramGroup } from './programAssignments.js'
import {guideDemoProgram} from './guideDemo.js'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const detalleVacio = (grupo = '') => ({ id: uid(), grupo, lugar: '', territorio: '', conductor: '', direccion: '' })
const salidaVacia = () => ({ id: uid(), dia: '', fecha:'', horario: '', grupos: false, detalles: [detalleVacio()] })

function descargarPrograma(salidas) {
  const normalRowH = 132
  const groupRowH = 70
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const addressLines = (value) => {
    ctx.font = '400 22px Arial, sans-serif'
    const lines=[]
    let line=''
    for(const word of String(value||'').trim().split(/\s+/).filter(Boolean)){
      if(line&&ctx.measureText(`${line} ${word}`).width>292){lines.push(line);line=''}
      for(const char of (line?' ':'')+word){
        if(ctx.measureText(line+char).width>292){lines.push(line);line=''}
        line+=char
      }
    }
    if(line)lines.push(line)
    return lines
  }
  const blocks = sortProgramEntries(salidas).map((salida) => {
    const detalles = salida.detalles.length ? salida.detalles : [detalleVacio()]
    const visible = salida.grupos ? detalles : detalles.slice(0, 1)
    const addresses = visible.map(detalle=>addressLines(detalle.direccion))
    const rowH = Math.max(salida.grupos?groupRowH:normalRowH,...addresses.map(lines=>lines.length?62+lines.length*27:0))
    return {
      ...salida,
      detalles: visible, addresses,
      height: Math.max(normalRowH,visible.length*rowH),
    }
  })
  if (!blocks.length) return

  const width = 1080
  const margin = 46
  const titleH = 190
  const headH = 76
  const height = titleH + headH + blocks.reduce((total, block) => total + block.height, 0) + 48
  canvas.width = width; canvas.height = height
  ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#b00035'; ctx.fillRect(margin, 52, 12, 82)
  ctx.fillStyle = '#24242c'; ctx.font = '800 52px Arial, sans-serif'; ctx.textBaseline = 'middle'
  ctx.fillText('SALIDAS A LA PREDICACIÓN', margin + 36, 94)
  ctx.strokeStyle = '#24242c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(margin, 158); ctx.lineTo(width - margin, 158); ctx.stroke()

  const x = [margin, 270, 590, 820, width - margin]
  const headers = ['DÍA Y HORARIO', 'LUGAR', 'TERRITORIO', 'CONDUCTOR']
  const colors = ['#404149', '#d49a00', '#b00035', '#404149']
  const y0 = titleH
  headers.forEach((header, i) => {
    ctx.fillStyle = colors[i]; ctx.fillRect(x[i], y0, x[i + 1] - x[i], headH)
    ctx.fillStyle = '#fff'; ctx.font = '700 25px Arial, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(header, (x[i] + x[i + 1]) / 2, y0 + headH / 2)
  })

  const fit = (text, maxWidth, initial = 30) => {
    let size = initial
    do { ctx.font = `500 ${size}px Arial, sans-serif`; size -= 1 } while (size > 18 && ctx.measureText(text || '—').width > maxWidth)
    return size + 1
  }
  let y = y0 + headH
  blocks.forEach((block, index) => {
    const blockH = block.height
    ctx.fillStyle = index % 2 ? '#f7f7f7' : '#fff'; ctx.fillRect(margin, y, width - margin * 2, blockH)
    ctx.strokeStyle = '#d7d7d9'; ctx.lineWidth = 1
    for (const xx of x) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + blockH); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(margin, y + blockH); ctx.lineTo(width - margin, y + blockH); ctx.stroke()

    ctx.textAlign = 'left'; ctx.fillStyle = '#17171b'; ctx.font = '800 28px Arial, sans-serif'
    const centerY = y + blockH / 2
    ctx.fillText(programWeekday(block.fecha) || block.dia || '', x[0] + 22, centerY - (programDate(block.fecha)?32:18))
    if(programDate(block.fecha)){
      ctx.font='400 23px Arial, sans-serif'
      ctx.fillText(formatProgramDate(block.fecha),x[0]+22,centerY)
    }
    ctx.font = '400 25px Arial, sans-serif'
    ctx.fillText(block.horario ? `${block.horario} hs` : '', x[0] + 22, centerY + (programDate(block.fecha)?32:22))

    block.detalles.forEach((detalle, detailIndex) => {
      const detailTop = y + detailIndex * (blockH / block.detalles.length)
      const detailH = blockH / block.detalles.length
      const detailCenterY = detailTop + detailH / 2

      if (block.grupos && detailIndex > 0) {
        ctx.strokeStyle = '#d7d7d9'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x[1], detailTop); ctx.lineTo(x[4], detailTop); ctx.stroke()
      }

      const lugar = block.grupos
        ? [detalle.grupo, detalle.lugar].filter(Boolean).join(': ')
        : detalle.lugar
      const values = [lugar, detalle.territorio, detalle.conductor]
      const address=block.addresses[detailIndex]
      values.forEach((value, i) => {
        const left = x[i + 1], right = x[i + 2]
        ctx.textAlign = 'center'; ctx.fillStyle = '#17171b'
        ctx.font = `500 ${fit(value, right - left - 28, block.grupos ? 25 : 30)}px Arial, sans-serif`
        const textY=i===0&&address.length?detailCenterY-address.length*27/2:detailCenterY
        ctx.fillText(value || '', (left + right) / 2, textY, right-left-28)
        if(i===0&&address.length){
          ctx.font='400 22px Arial, sans-serif';ctx.fillStyle='#62626b'
          address.forEach((line,index)=>ctx.fillText(line,(left+right)/2,textY+32+index*27))
        }
      })
    })

    y += blockH
  })

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'programa-salidas.png'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

function ProgramTextField({designPreview, label, className, ...props}) {
  const input=<input className={className} aria-label={label} {...props}/>
  return designPreview ? <label className={`programa-field ${className}-field`}><span>{label}</span>{input}</label> : input
}

function ProgramEditorSurface({modal, minimized, onMinimize, onClose, children}) {
  const dialog=useRef(null)
  const backdropPointer=useRef(false)
  useEffect(()=>{
    if(!modal)return undefined
    const node=dialog.current
    if(!minimized)node.showModal()
    return ()=>node.close()
  },[modal,minimized])
  if(!modal)return children
  return <dialog ref={dialog} className="programa programa-edit-dialog" aria-label="Editar salida del programa" onCancel={event=>{event.preventDefault();onClose()}} onPointerDown={event=>{
    const rect=event.currentTarget.getBoundingClientRect()
    backdropPointer.current=event.target===event.currentTarget&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)
  }} onClick={event=>{
    if(!backdropPointer.current||event.target!==event.currentTarget)return
    backdropPointer.current=false
    const rect=event.currentTarget.getBoundingClientRect()
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose()
  }}>
    <header className="programa-edit-heading"><div><strong>Editar salida</strong><small>Los cambios se conservan al cerrar.</small></div><div className="programa-editor-actions"><button type="button" onClick={onMinimize} aria-label="Minimizar editor de salida" title="Minimizar y ver el mapa"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 18h14"/></svg></button><button type="button" onClick={onClose} aria-label="Cerrar editor de salida">×</button></div></header>
    <div className="programa-edit-scroll">{children}</div>
    <footer className="programa-edit-footer"><button type="button" onClick={onClose}>Listo</button></footer>
  </dialog>
}

export default function ProgramGenerator({ preview = false, designPreview = false, territories, minimized=false, onMinimize }) {
  const [salidas, setSalidas] = useState(() => preview ? guideDemoProgram() : [salidaVacia()])
  const [editingId,setEditingId]=useState(null)
  const [collapseGroupsId,setCollapseGroupsId]=useState(null)
  const [syncState, setSyncState] = useState('cargando')
  const loaded = useRef(false)
  const applyingRemote = useRef(false)
  const locating = useRef(new Set())
  const baseSalidas = useRef([])

  useEffect(() => {
    if (preview) { loaded.current = true; setSyncState('guardado'); return undefined }
    return subscribeProgramDraft((remote) => {
    const firstLoad = !loaded.current
    loaded.current = true
    if (firstLoad && remote !== null) saveProgramDraft(remote).catch((error) => console.error('Publicación de asignaciones:', error))
    if (remote !== null) {
      const previousBase=baseSalidas.current
      baseSalidas.current=remote
      setSalidas((current) => {
        const merged=firstLoad?remote:mergeProgramDraft(remote,current,previousBase)
        if (JSON.stringify(merged) === JSON.stringify(current)) return current
        applyingRemote.current=JSON.stringify(merged)===JSON.stringify(remote)
        return merged
      })
    }
    setSyncState('guardado')
  }, (error) => {
    console.error('Sincronización del programa:', error)
    loaded.current = true
    setSyncState('error')
    })
  }, [preview]) // cargar una vez; los cambios posteriores llegan por el listener

  useEffect(() => {
    if (!loaded.current || preview) return
    if (salidas.some(s => s.detalles.some(d => d.pinStatus === 'locating'))) return
    if (applyingRemote.current) { applyingRemote.current = false; return }
    setSyncState('guardando')
    const base=baseSalidas.current
    const timer = setTimeout(() => {
      saveProgramDraft(salidas,base)
        .then(() => setSyncState('guardado'))
        .catch((error) => { console.error('Guardado del programa:', error); setSyncState('error') })
    }, 650)
    return () => clearTimeout(timer)
  }, [salidas, preview])

  const patchSalida = (id, patch) => setSalidas((all) => all.map((s) => s.id === id ? { ...s, ...patch } : s))
  const patchDetalle = (salidaId, detalleId, patch) => setSalidas((all) => all.map((s) => s.id !== salidaId ? s : {
    ...s, detalles: s.detalles.map((d) => d.id === detalleId ? { ...d, ...patch } : d),
  }))
  const locateAddress = async (salidaId, detalle) => {
    if (!detalle.direccion?.trim() || locating.current.has(detalle.id)) return
    const address = detalle.direccion
    locating.current.add(detalle.id)
    patchDetalle(salidaId, detalle.id, { pinStatus: 'locating' })
    let coordinates = null
    try {
      const territory = territories?.features?.find(f => f.properties.territorio === firstProgramTerritory(detalle.territorio))
      coordinates = await geocodeAddress(address, territory?.properties.zona)
    } catch { /* conservar el centro cuando no se pueda resolver */ }
    locating.current.delete(detalle.id)
    setSalidas(all => all.map(s => s.id !== salidaId ? s : { ...s, detalles: s.detalles.map(d => d.id !== detalle.id || d.direccion !== address || d.territorio !== detalle.territorio ? d : { ...d, pinCoordinates: coordinates, pinStatus: coordinates ? 'located' : 'center' }) }))
  }
  const addGrupo = (id) => setSalidas((all) => all.map((s) => s.id === id ? { ...s, detalles: [...s.detalles, detalleVacio(nextProgramGroup(s.detalles))] } : s))
  const changeGroupMode = (salida, enabled) => {
    if (designPreview && !enabled && salida.detalles.length > 1) { setCollapseGroupsId(salida.id); return }
    setCollapseGroupsId(null)
    patchSalida(salida.id, {
      grupos:enabled,
      detalles:enabled ? salida.detalles.map((d,i)=>({...d,grupo:d.grupo||`G${i+1}`})) : salida.detalles.slice(0,1),
    })
  }
  const removeDetalle = (salidaId, detalleId) => setSalidas((all) => all.map((s) => s.id !== salidaId ? s : {
    ...s, detalles: s.detalles.filter((d) => d.id !== detalleId),
  }))
  const resetPrograma = () => {
    if (!window.confirm('¿Resetear todo el programa? Se borrarán todas las salidas guardadas para los administradores.')) return
    setSalidas([salidaVacia()])
  }

  return (
    <div className="programa">
      <div className="programa-intro">
        <div className="programa-intro-head"><b>Generar programa</b><button className="programa-reset" onClick={resetPrograma}>Resetear</button></div>
        <span>{designPreview ? 'Organizá las salidas de la semana.' : 'Completá las salidas y descargá una imagen vertical. Se ordenan por fecha y hora; las que no tienen fecha quedan al final. El borrador queda compartido.'}</span>
        <small className={'programa-sync ' + syncState}>{preview && designPreview ? 'Vista de prueba · sin cambios en los datos reales' : syncState === 'cargando' ? 'Cargando…' : syncState === 'guardando' ? 'Guardando…' : syncState === 'error' ? 'No se pudo guardar' : '✓ Guardado en Firebase'}</small>
      </div>
      {designPreview&&<div className="programa-list programa-summary-list">{sortProgramEntries(salidas).map((salida,index)=><button type="button" className="programa-summary" key={salida.id} onClick={()=>setEditingId(salida.id)} aria-label={`Editar salida ${index+1}: ${programWeekday(salida.fecha)||salida.dia||'Sin día'}, ${salida.horario||'sin horario'}`}>
        <span className="programa-summary-date"><strong>{programWeekday(salida.fecha)||salida.dia||'Sin día'}</strong><small>{formatProgramDate(salida.fecha)||'Sin fecha'}</small></span>
        <span className="programa-summary-time">{salida.horario||'—'}<small>hs</small></span>
        <span className="programa-summary-place"><strong>{salida.grupos?`${salida.detalles.length} lugares de encuentro`:salida.detalles[0]?.lugar||'Sin lugar'}</strong><small>{salida.grupos?salida.detalles.map(d=>d.grupo).filter(Boolean).join(' · '):salida.detalles[0]?.conductor||'Sin conductor'}</small></span>
        <span className="programa-summary-territory">{salida.detalles.map(d=>d.territorio).filter(Boolean).join(' · ')||'Sin territorio'}</span>
        <span className="programa-summary-edit" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg></span>
      </button>)}</div>}
      {designPreview&&!salidas.length&&<p className="programa-empty" role="status">No hay salidas. Tocá “Agregar salida” para empezar.</p>}
      <div className={designPreview?'programa-dialog-host':'programa-list'}>
        {sortProgramEntries(salidas).map((salida, sIndex) => !designPreview||editingId===salida.id ? (
          <ProgramEditorSurface key={salida.id} modal={designPreview} minimized={minimized} onMinimize={onMinimize} onClose={()=>{setEditingId(null);setCollapseGroupsId(null)}}>
          <section className="programa-card" key={salida.id}>
            <div className="programa-card-head">
              <strong>Salida {sIndex + 1}</strong>
              <button className="admin-mini-btn ghost danger" onClick={() => setSalidas((all) => all.filter((s) => s.id !== salida.id))}>Quitar</button>
            </div>
            <div className="programa-main-fields">
              <AppDateField label="Fecha" value={salida.fecha || ''} onChange={fecha=>patchSalida(salida.id,{fecha,dia:programWeekday(fecha)})}/>
              <div className="programa-derived-day"><span>Día</span><output aria-label="Día de la salida">{programWeekday(salida.fecha)||salida.dia||'Elegí una fecha'}</output></div>
              <AppTimeField label="Horario" value={salida.horario} onChange={(value) => patchSalida(salida.id, { horario: value })} />
              <label className="programa-check"><input type="checkbox" checked={salida.grupos} onChange={e=>changeGroupMode(salida,e.target.checked)} />Salida por grupos</label>
            </div>
            {collapseGroupsId===salida.id&&<div className="programa-group-warning" role="alert">
              <p>Hay {salida.detalles.length} lugares de encuentro. Si desactivás los grupos, solo se conservará el primero.</p>
              <div><button type="button" onClick={()=>setCollapseGroupsId(null)}>Conservar grupos</button><button type="button" onClick={()=>{patchSalida(salida.id,{grupos:false,detalles:salida.detalles.slice(0,1)});setCollapseGroupsId(null)}}>Usar solo el primer lugar</button></div>
            </div>}
            {salida.detalles.map((detalle, index) => (
              <div className={'programa-detail' + (salida.grupos ? ' con-grupo' : '')} key={detalle.id}>
                {salida.grupos
                  ? <ProgramTextField designPreview={designPreview} label="Grupos" className="programa-grupo" placeholder="G4 o Congre" title="Nombre libre o grupos separados por coma. Ejemplos: G4, G4,G3, Congre" value={detalle.grupo} onChange={(e) => patchDetalle(salida.id, detalle.id, { grupo: e.target.value })} />
                  : <b>Datos</b>}
                <ProgramTextField designPreview={designPreview} label="Lugar" className="programa-lugar" placeholder="Lugar" value={detalle.lugar} onChange={(e) => patchDetalle(salida.id, detalle.id, { lugar: e.target.value })} />
                <ProgramTextField designPreview={designPreview} label="Territorio" className="programa-territorio" placeholder="Territorio" value={detalle.territorio} onChange={(e) => patchDetalle(salida.id, detalle.id, { territorio: e.target.value.toUpperCase(), pinCoordinates: null, pinStatus: '' })} />
                <ProgramTextField designPreview={designPreview} label="Conductor" className="programa-conductor" placeholder="Conductor" value={detalle.conductor} onChange={(e) => patchDetalle(salida.id, detalle.id, { conductor: e.target.value })} />
                {salida.grupos && salida.detalles.length > 1 && <button className="programa-remove" onClick={() => removeDetalle(salida.id, detalle.id)} aria-label="Quitar grupo">×</button>}
                <div className="programa-pin-visibility">
                  <label className="programa-check"><input type="checkbox" checked={programDetailHidden(salida, detalle)} onChange={e => patchDetalle(salida.id, detalle.id, { ocultarBandera: e.target.checked })} />Ocultar bandera</label>
                  {programDetailHidden(salida, detalle) && <small>Este lugar permanece en el programa, sin bandera ni resaltado en el mapa.</small>}
                </div>
                <div className="programa-address">
                  <label>Dirección (opcional · pública)<input placeholder="Calle y número" value={detalle.direccion || ''} onChange={e => patchDetalle(salida.id, detalle.id, { direccion: e.target.value, pinCoordinates: null, pinStatus: '' })} onBlur={() => { if (!detalle.pinStatus) locateAddress(salida.id, detalle) }} /></label>
                  <button type="button" className="admin-mini-btn" disabled={!detalle.direccion?.trim() || detalle.pinStatus === 'locating'} onClick={() => locateAddress(salida.id, detalle)}>Ubicar</button>
                  <small role="status">{detalle.pinStatus === 'locating' ? 'Buscando dirección…' : detalle.pinStatus === 'located' ? 'Dirección localizada' : detalle.pinStatus === 'manual' ? 'Posición ajustada en el mapa' : detalle.pinStatus === 'center' ? 'No se encontró: se usa el centro. Podés arrastrar el pin en el mapa.' : 'Sin dirección localizada: se usa el centro del territorio.'}</small>
                </div>
              </div>
            ))}
            {salida.grupos && <button className="admin-mini-btn programa-add-group" onClick={() => addGrupo(salida.id)}>+ Agregar grupo</button>}
          </section>
          </ProgramEditorSurface>
        ):null)}
      </div>
      <div className="programa-actions">
        <button className="admin-foot-btn" onClick={() => {const next=salidaVacia();setSalidas(all=>[...all,next]);if(designPreview)setEditingId(next.id)}}>+ Agregar salida</button>
        <button className="admin-foot-btn primary" disabled={!salidas.length} onClick={() => descargarPrograma(salidas)}>Descargar PNG</button>
      </div>
    </div>
  )
}
