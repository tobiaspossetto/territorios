import { useState } from 'react'

const DIAS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const detalleVacio = () => ({ id: uid(), lugar: '', territorio: '', conductor: '' })
const salidaVacia = () => ({ id: uid(), dia: 'SÁBADO', horario: '17:00', grupos: false, detalles: [detalleVacio()] })

function descargarPrograma(salidas) {
  const rows = salidas.flatMap((salida) => salida.detalles.map((detalle, index) => ({
    ...detalle,
    dia: salida.dia,
    horario: salida.horario,
    grupo: salida.grupos ? `G${index + 1}` : '',
  })))
  if (!rows.length) return

  const width = 1080
  const margin = 46
  const titleH = 190
  const headH = 76
  const rowH = 132
  const height = titleH + headH + rows.length * rowH + 48
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
  rows.forEach((row, index) => {
    const y = y0 + headH + index * rowH
    ctx.fillStyle = index % 2 ? '#f7f7f7' : '#fff'; ctx.fillRect(margin, y, width - margin * 2, rowH)
    ctx.strokeStyle = '#d7d7d9'; ctx.lineWidth = 1
    for (const xx of x) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + rowH); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(margin, y + rowH); ctx.lineTo(width - margin, y + rowH); ctx.stroke()

    ctx.textAlign = 'left'; ctx.fillStyle = '#17171b'; ctx.font = '800 28px Arial, sans-serif'
    ctx.fillText(row.dia, x[0] + 22, y + 43)
    ctx.font = '400 25px Arial, sans-serif'
    ctx.fillText(`${row.horario || '—'} hs${row.grupo ? ` · ${row.grupo}` : ''}`, x[0] + 22, y + 84)

    const values = [row.lugar, row.territorio, row.conductor]
    values.forEach((value, i) => {
      const left = x[i + 1], right = x[i + 2]
      ctx.textAlign = 'center'; ctx.fillStyle = '#17171b'
      ctx.font = `500 ${fit(value, right - left - 28)}px Arial, sans-serif`
      ctx.fillText(value || '—', (left + right) / 2, y + rowH / 2)
    })
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
  const patchSalida = (id, patch) => setSalidas((all) => all.map((s) => s.id === id ? { ...s, ...patch } : s))
  const patchDetalle = (salidaId, detalleId, patch) => setSalidas((all) => all.map((s) => s.id !== salidaId ? s : {
    ...s, detalles: s.detalles.map((d) => d.id === detalleId ? { ...d, ...patch } : d),
  }))
  const addGrupo = (id) => setSalidas((all) => all.map((s) => s.id === id ? { ...s, detalles: [...s.detalles, detalleVacio()] } : s))
  const removeDetalle = (salidaId, detalleId) => setSalidas((all) => all.map((s) => s.id !== salidaId ? s : {
    ...s, detalles: s.detalles.filter((d) => d.id !== detalleId),
  }))

  return (
    <div className="programa">
      <div className="programa-intro">
        <b>Generar programa</b>
        <span>Completá las salidas y descargá una imagen vertical. Estos datos no se guardan.</span>
      </div>
      <div className="programa-list">
        {salidas.map((salida, sIndex) => (
          <section className="programa-card" key={salida.id}>
            <div className="programa-card-head">
              <strong>Salida {sIndex + 1}</strong>
              <button className="admin-mini-btn ghost danger" onClick={() => setSalidas((all) => all.filter((s) => s.id !== salida.id))}>Quitar</button>
            </div>
            <div className="programa-main-fields">
              <label>Día<select value={salida.dia} onChange={(e) => patchSalida(salida.id, { dia: e.target.value })}>{DIAS.map((d) => <option key={d}>{d}</option>)}</select></label>
              <label>Horario<input type="time" value={salida.horario} onChange={(e) => patchSalida(salida.id, { horario: e.target.value })} /></label>
              <label className="programa-check"><input type="checkbox" checked={salida.grupos} onChange={(e) => patchSalida(salida.id, {
                grupos: e.target.checked,
                detalles: e.target.checked ? salida.detalles : salida.detalles.slice(0, 1),
              })} />Salida por grupos</label>
            </div>
            {salida.detalles.map((detalle, index) => (
              <div className="programa-detail" key={detalle.id}>
                <b>{salida.grupos ? `G${index + 1}` : 'Datos'}</b>
                <input placeholder="Lugar" value={detalle.lugar} onChange={(e) => patchDetalle(salida.id, detalle.id, { lugar: e.target.value })} />
                <input placeholder="Territorio" value={detalle.territorio} onChange={(e) => patchDetalle(salida.id, detalle.id, { territorio: e.target.value.toUpperCase() })} />
                <input placeholder="Conductor" value={detalle.conductor} onChange={(e) => patchDetalle(salida.id, detalle.id, { conductor: e.target.value })} />
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
