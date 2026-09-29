import { useEffect, useRef, useState } from 'react'
import { saveProgramDraft, subscribeProgramDraft } from './firebaseData.js'
import { AppTimeField } from './DateTimeFields.jsx'

const DIAS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const detalleVacio = (grupo = '') => ({ id: uid(), grupo, lugar: '', territorio: '', conductor: '' })
const salidaVacia = () => ({ id: uid(), dia: '', horario: '', grupos: false, detalles: [detalleVacio()] })

function descargarPrograma(salidas) {
  const normalRowH = 132
  const groupRowH = 70
  const blocks = salidas.map((salida) => {
    const detalles = salida.detalles.length ? salida.detalles : [detalleVacio()]
    const rowCount = salida.grupos ? detalles.length : 1
    return {
      ...salida,
      detalles: salida.grupos ? detalles : detalles.slice(0, 1),
      height: salida.grupos ? Math.max(normalRowH, rowCount * groupRowH) : normalRowH,
    }
  })
  if (!blocks.length) return

  const width = 1080
  const margin = 46
  const titleH = 190
  const headH = 76
  const height = titleH + headH + blocks.reduce((total, block) => total + block.height, 0) + 48
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
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
    ctx.fillText(block.dia || '', x[0] + 22, centerY - 18)
    ctx.font = '400 25px Arial, sans-serif'
    ctx.fillText(block.horario ? `${block.horario} hs` : '', x[0] + 22, centerY + 22)

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
      values.forEach((value, i) => {
        const left = x[i + 1], right = x[i + 2]
        ctx.textAlign = 'center'; ctx.fillStyle = '#17171b'
        ctx.font = `500 ${fit(value, right - left - 28, block.grupos ? 25 : 30)}px Arial, sans-serif`
        ctx.fillText(value || '', (left + right) / 2, detailCenterY)
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

export default function ProgramGenerator() {
  const [salidas, setSalidas] = useState([salidaVacia()])
  const [syncState, setSyncState] = useState('cargando')
  const loaded = useRef(false)
  const applyingRemote = useRef(false)

  useEffect(() => subscribeProgramDraft((remote) => {
    loaded.current = true
    if (remote !== null) setSalidas((current) => {
      if (JSON.stringify(remote) === JSON.stringify(current)) return current
      applyingRemote.current = true
      return remote
    })
    setSyncState('guardado')
  }, (error) => {
    console.error('Sincronización del programa:', error)
    loaded.current = true
    setSyncState('error')
  }), []) // cargar una vez; los cambios posteriores llegan por el listener

  useEffect(() => {
    if (!loaded.current) return
    if (applyingRemote.current) { applyingRemote.current = false; return }
    setSyncState('guardando')
    const timer = setTimeout(() => {
      saveProgramDraft(salidas)
        .then(() => setSyncState('guardado'))
        .catch((error) => { console.error('Guardado del programa:', error); setSyncState('error') })
    }, 650)
    return () => clearTimeout(timer)
  }, [salidas])

  const patchSalida = (id, patch) => setSalidas((all) => all.map((s) => s.id === id ? { ...s, ...patch } : s))
  const patchDetalle = (salidaId, detalleId, patch) => setSalidas((all) => all.map((s) => s.id !== salidaId ? s : {
    ...s, detalles: s.detalles.map((d) => d.id === detalleId ? { ...d, ...patch } : d),
  }))
  const addGrupo = (id) => setSalidas((all) => all.map((s) => s.id === id ? { ...s, detalles: [...s.detalles, detalleVacio(`G${s.detalles.length + 1}`)] } : s))
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
        <span>Completá las salidas y descargá una imagen vertical. El borrador queda compartido.</span>
        <small className={'programa-sync ' + syncState}>{syncState === 'cargando' ? 'Cargando…' : syncState === 'guardando' ? 'Guardando…' : syncState === 'error' ? 'No se pudo guardar' : '✓ Guardado en Firebase'}</small>
      </div>
      <div className="programa-list">
        {salidas.map((salida, sIndex) => (
          <section className="programa-card" key={salida.id}>
            <div className="programa-card-head">
              <strong>Salida {sIndex + 1}</strong>
              <button className="admin-mini-btn ghost danger" onClick={() => setSalidas((all) => all.filter((s) => s.id !== salida.id))}>Quitar</button>
            </div>
            <div className="programa-main-fields">
              <label>Día<select value={salida.dia} onChange={(e) => patchSalida(salida.id, { dia: e.target.value })}><option value="">Sin especificar</option>{DIAS.map((d) => <option key={d}>{d}</option>)}</select></label>
              <AppTimeField label="Horario" value={salida.horario} onChange={(value) => patchSalida(salida.id, { horario: value })} />
              <label className="programa-check"><input type="checkbox" checked={salida.grupos} onChange={(e) => patchSalida(salida.id, {
                grupos: e.target.checked,
                detalles: e.target.checked
                  ? salida.detalles.map((d, i) => ({ ...d, grupo: d.grupo || `G${i + 1}` }))
                  : salida.detalles.slice(0, 1),
              })} />Salida por grupos</label>
            </div>
            {salida.detalles.map((detalle, index) => (
              <div className={'programa-detail' + (salida.grupos ? ' con-grupo' : '')} key={detalle.id}>
                {salida.grupos
                  ? <input className="programa-grupo" placeholder="Grupo" value={detalle.grupo} onChange={(e) => patchDetalle(salida.id, detalle.id, { grupo: e.target.value })} />
                  : <b>Datos</b>}
                <input className="programa-lugar" placeholder="Lugar" value={detalle.lugar} onChange={(e) => patchDetalle(salida.id, detalle.id, { lugar: e.target.value })} />
                <input className="programa-territorio" placeholder="Territorio" value={detalle.territorio} onChange={(e) => patchDetalle(salida.id, detalle.id, { territorio: e.target.value.toUpperCase() })} />
                <input className="programa-conductor" placeholder="Conductor" value={detalle.conductor} onChange={(e) => patchDetalle(salida.id, detalle.id, { conductor: e.target.value })} />
                {salida.grupos && salida.detalles.length > 1 && <button className="programa-remove" onClick={() => removeDetalle(salida.id, detalle.id)} aria-label="Quitar grupo">×</button>}
              </div>
            ))}
            {salida.grupos && <button className="admin-mini-btn programa-add-group" onClick={() => addGrupo(salida.id)}>+ Agregar grupo</button>}
          </section>
        ))}
      </div>
      <div className="programa-actions">
        <button className="admin-foot-btn" onClick={() => setSalidas((all) => [...all, salidaVacia()])}>+ Agregar salida</button>
        <button className="admin-foot-btn primary" disabled={!salidas.length} onClick={() => descargarPrograma(salidas)}>Descargar PNG</button>
      </div>
    </div>
  )
}
