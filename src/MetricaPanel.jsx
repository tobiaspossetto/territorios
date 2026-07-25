import { useState, useRef } from 'react'
import { metricColor, METRIC_LEGEND } from './theme.js'
import { IconInfo } from './icons.jsx'

function fmtFecha(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export default function MetricaPanel({ data, theme, meta }) {
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

  // promedio dinámico: cada cuánto se hace un territorio.
  // (territorios × días desde 01/06/2026) ÷ total de pasadas completas
  const INICIO = new Date(2026, 5, 1)
  const dias = Math.max(1, Math.round((Date.now() - INICIO.getTime()) / 86400000))
  const pasadas = feats.reduce((s, f) => s + (f.veces || 0), 0)
  const promDias = pasadas > 0 ? Math.round((total * dias) / pasadas) : null

  const buckets = [
    { key: '0', label: 'Sin hacer', n: feats.filter((f) => f.veces === 0).length, color: metricColor(0, theme) },
    { key: '1', label: '1 vez', n: feats.filter((f) => f.veces === 1).length, color: metricColor(1, theme) },
    { key: '2', label: '2 veces', n: feats.filter((f) => f.veces === 2).length, color: metricColor(2, theme) },
    { key: '3-4', label: '3-4 veces', n: feats.filter((f) => f.veces >= 3 && f.veces <= 4).length, color: metricColor(3, theme) },
    { key: '5+', label: '+5 veces', n: feats.filter((f) => f.veces >= 5).length, color: metricColor(5, theme) },
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
      <div className="mp-header" onPointerDown={onDown} onPointerUp={onUp}
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
                Se calcula: (territorios × días desde que arrancó el registro) ÷ total de veces predicadas.
                Cuenta también los territorios que todavía no se hicieron.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
