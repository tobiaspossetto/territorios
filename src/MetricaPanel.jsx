import { useState, useRef } from 'react'
import { metricColor, METRIC_LEGEND } from './theme.js'
import { IconInfo } from './icons.jsx'

function fmtFecha(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export default function MetricaPanel({ data, meta, selected, reference, onReferenceChange, onClearSelected }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('metricaOpen') !== '0' } catch (e) { return true }
  })
  const [infoOpen, setInfoOpen] = useState(false)
  const setOpenP = (v) => { try { localStorage.setItem('metricaOpen', v ? '1' : '0') } catch (e) {}; setOpen(v) }
  const dragY = useRef(null)

  const onDown = (e) => {
    dragY.current = e.clientY
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (er) {}
  }
  const onUp = (e) => {
    if (dragY.current == null) return
    const dy = e.clientY - dragY.current
    dragY.current = null
    if (dy > 24) setOpenP(false)        // arrastrar/deslizar abajo -> minimizar
    else if (dy < -24) setOpenP(true)   // arriba -> expandir
    else setOpenP(!open)                // tap -> alternar
  }

  if (!data) return null
  const feats = data.features.map((f) => f.properties)
  const total = feats.length
  const completados = feats.filter((f) => f.veces > 0).length

  // promedio dinámico: cada cuánto se hace un territorio dentro de la referencia elegida.
  const now = new Date()
  const serviceYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const firstHistorical = feats.map((f) => f.primera).filter(Boolean).sort()[0]
  const referenceStart = reference === 'service' ? `${serviceYear}-09-01` : firstHistorical
  const inicio = referenceStart ? new Date(`${referenceStart}T00:00:00`) : now
  const dias = Math.max(1, Math.round((Date.now() - inicio.getTime()) / 86400000))
  const pasadas = feats.reduce((s, f) => s + (f.veces || 0), 0)
  const promDias = pasadas > 0 ? Math.round((total * dias) / pasadas) : null

  const buckets = [
    { key: '0', label: 'Sin hacer', n: feats.filter((f) => f.veces === 0).length, color: metricColor(0) },
    { key: '1', label: '1 vez', n: feats.filter((f) => f.veces === 1).length, color: metricColor(1) },
    { key: '2', label: '2 veces', n: feats.filter((f) => f.veces === 2).length, color: metricColor(2) },
    { key: '3-4', label: '3-4 veces', n: feats.filter((f) => f.veces >= 3 && f.veces <= 4).length, color: metricColor(3) },
    { key: '5+', label: '+5 veces', n: feats.filter((f) => f.veces >= 5).length, color: metricColor(5) },
  ]
  const maxN = Math.max(1, ...buckets.map((b) => b.n))

  const zonas = {}
  for (const f of feats) {
    const z = f.zona || '—'
    if (!zonas[z]) zonas[z] = { total: 0, comp: 0 }
    zonas[z].total++
    if (f.veces > 0) zonas[z].comp++
  }
  const zonaRows = Object.entries(zonas).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="metrica-panel">
      {selected && (
        <div className="mp-selected" aria-label={`Resumen de ${selected.territorio}`}>
          <div className="mp-selected-main">
            <div className="mp-selected-title">
              <b>{selected.territorio}</b>
              <span>{selected.zona}</span>
            </div>
            <span className={'mp-selected-status' + (selected.activo ? ' active' : '')}>
              <i />Activo
            </span>
          </div>
          <div className="mp-selected-stats">
            <span><small>Año de servicio</small><b>{selected.veces_servicio || 0}</b></span>
            <span><small>Total histórico</small><b>{selected.veces || 0}</b></span>
            <span><small>Última visita</small><b>{selected.ultima_fmt || 'Sin registro'}</b></span>
          </div>
          <button className="mp-selected-close" onClick={onClearSelected} aria-label="Cerrar resumen">×</button>
        </div>
      )}
      <div className="mp-reference" aria-label="Referencia de métricas">
        <span>Referencia</span>
        <div>
          <button className={reference === 'service' ? 'on' : ''} onClick={() => onReferenceChange('service')} aria-pressed={reference === 'service'}>Año de servicio</button>
          <button className={reference === 'history' ? 'on' : ''} onClick={() => onReferenceChange('history')} aria-pressed={reference === 'history'}>Historial completo</button>
        </div>
        <small>Total histórico desde {fmtFecha(firstHistorical) || 'el primer registro'}.</small>
      </div>
      <div className="mp-header" onPointerDown={onDown} onPointerUp={onUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpenP(!open)
          }
        }}
        role="button" tabIndex={0} aria-expanded={open} aria-label={open ? 'Minimizar gráficos' : 'Expandir gráficos'}>
        <div className="mp-grip" />
        <div className="mp-hrow">
          <span className="mp-hstat"><b>{completados}</b> / {total} <span className="mp-hsub">completados</span></span>
          <span className="mp-chev-btn">
            <svg className={'mp-chev' + (open ? ' open' : '')} viewBox="0 0 24 24" width="24" height="24"
              fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      <div className={'mp-content' + (open ? '' : ' closed')}>
        <div className="mp-section">Distribución</div>
        <div className="mp-bars">
          {buckets.map((b) => (
            <div className="mp-bar" key={b.key}>
              <div className="mp-bar-track">
                <div className="mp-bar-fill" style={{ height: (b.n / maxN * 100) + '%', background: b.color }} />
              </div>
              <div className="mp-bar-n">{b.n}</div>
              <div className="mp-bar-lbl">{b.label}</div>
            </div>
          ))}
        </div>

        <div className="mp-section">Por zona</div>
        <div className="mp-barrios">
          {zonaRows.map(([name, v]) => (
            <div className="mp-brow" key={name}>
              <span className="mp-bname">{name}</span>
              <span className="mp-btrack"><span style={{ width: (v.comp / v.total * 100) + '%' }} /></span>
              <span className="mp-bval">{v.comp}/{v.total}</span>
            </div>
          ))}
        </div>

        <div className="mp-legend">
          {METRIC_LEGEND.map((l) => (
            <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
          ))}
        </div>

        {meta && meta.actualizado && (
          <div className="mp-updated">Datos actualizados: <b>{fmtFecha(meta.actualizado)}</b></div>
        )}

        {promDias != null && (
          <div className="mp-avg">
            <button className="mp-avg-row" onClick={() => setInfoOpen((o) => !o)} aria-expanded={infoOpen}>
              <span>En promedio un territorio se hace cada: <b>{promDias} días</b></span>
              <IconInfo className="mp-i" />
            </button>
            {infoOpen && (
              <div className="mp-avg-info">
                Estimación de cada cuánto se vuelve a predicar un territorio.
                Se calcula: (territorios × días desde la referencia elegida) ÷ total de veces predicadas.
                Cuenta también los territorios que todavía no se hicieron.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
