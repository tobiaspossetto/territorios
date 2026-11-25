import { useState, useRef, useId } from 'react'
import { metricColor, METRIC_LEGEND } from './theme.js'
import { IconInfo } from './icons.jsx'
import {metricFrequency, metricHistoryStart} from './metricFrequency.js'
import TerritoryDetails from './TerritoryDetails.jsx'
import TerritoryStats from './TerritoryStats.jsx'

function fmtFecha(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export default function MetricaPanel({ data, meta, selected, reference, onReferenceChange, onClearSelected }) {
  const [open, setOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [chart, setChart] = useState('distribution')
  const drawerId = useId()
  const dragX = useRef(null)

  const onDown = (e) => {
    if (e.target.closest('button')) return
    dragX.current = e.clientX
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (er) {}
  }
  const onUp = (e) => {
    if (dragX.current == null) return
    const dx = e.clientX - dragX.current
    dragX.current = null
    if (dx < -24) setOpen(false)
    else if (dx > 24) setOpen(true)
  }

  if (!data) return null
  const feats = data.features.map((f) => f.properties)
  const total = feats.length
  const completados = feats.filter((f) => f.veces > 0).length
  const firstHistorical = metricHistoryStart(feats, meta?.historialDesde)

  const frequency = metricFrequency(feats, reference, new Date(), meta?.historialDesde)
  const promDias = frequency.days

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
    <>
      {selected && <section className="mp-selected mp-selection-card" aria-label={`Detalle de ${selected.territorio}`}>
        <div className="mp-selected-main">
          <div className="mp-selected-title"><b>{selected.territorio}</b><span>{selected.zona}</span></div>
          {selected.activo && <span className="mp-selected-status active"><i />Empezado</span>}
        </div>
        <TerritoryDetails key={selected.territorio} defaultOpen>
        <TerritoryStats territory={selected} historicalStart={firstHistorical} />
        </TerritoryDetails>
        <button className="mp-selected-close" onClick={onClearSelected} aria-label="Cerrar detalle del territorio">×</button>
      </section>}
    <div className={`metrica-panel mp-side-panel${selected ? ' has-selection' : ''}${open ? ' is-open' : ' is-collapsed'}`}>
      <div className="mp-side-header" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { dragX.current = null }}>
        <div className="mp-side-summary"><strong>Métrica</strong><span><b>{completados}</b> / {total} <small>completados</small></span><small className="mp-side-reference">{reference === 'service' ? 'Año de servicio' : 'Historial completo'}</small></div>
        <button type="button" className="mp-side-toggle" onClick={() => setOpen(value => !value)} aria-controls={drawerId} aria-expanded={open} aria-label={open ? 'Minimizar gráficos' : 'Expandir gráficos'}>
          <span>{open ? 'Ocultar' : 'Ver gráficos'}</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} /></svg>
        </button>
      </div>
      <div id={drawerId} className="mp-drawer-body" hidden={!open}>
      <div className="mp-reference" aria-label="Referencia de métricas">
        <span>Referencia</span>
        <div>
          <button className={reference === 'service' ? 'on' : ''} onClick={() => onReferenceChange('service')} aria-pressed={reference === 'service'}>Año de servicio</button>
          <button className={reference === 'history' ? 'on' : ''} onClick={() => onReferenceChange('history')} aria-pressed={reference === 'history'}>Historial completo</button>
        </div>
        {reference === 'history' && <small>Historial registrado desde {fmtFecha(firstHistorical) || 'el primer registro'}.</small>}
      </div>
      <div className="mp-content">
        <div className="mp-chart-switch" role="group" aria-label="Gráfica a mostrar">
          <button type="button" aria-pressed={chart==='distribution'} onClick={()=>setChart('distribution')}>Distribución</button>
          <button type="button" aria-pressed={chart==='zones'} onClick={()=>setChart('zones')}>Por zona</button>
        </div>
        <section className="mp-chart-section" data-active={chart==='distribution'} aria-label="Distribución">
        <div className="mp-section">Distribución</div>
        <div className="mp-distribution" role="list" aria-label="Distribución de territorios por veces realizadas">
          {buckets.map((b) => (
            <div className="mp-distribution-row" key={b.key} role="listitem" aria-label={`${b.label}: ${b.n} territorios`}>
              <span>{b.label}</span>
              <div className="mp-distribution-track" aria-hidden="true"><i style={{ width: (b.n / maxN * 100) + '%', background: b.color }} /></div>
              <strong>{b.n}</strong>
            </div>
          ))}
        </div>

        <div className="mp-legend" aria-label="Colores de la distribución">
          {METRIC_LEGEND.map((l) => (
            <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
          ))}
        </div>

        </section>
        <section className="mp-chart-section" data-active={chart==='zones'} aria-label="Por zona">
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
        </section>

        {meta && meta.actualizado && (
          <div className="mp-updated">Datos actualizados: <b>{fmtFecha(meta.actualizado)}</b></div>
        )}

        {(
          <div className="mp-avg">
            <button className="mp-avg-row" onClick={() => setInfoOpen((o) => !o)} aria-expanded={infoOpen}>
              <span>Recorrido estimado: <b>{promDias == null ? 'Sin datos suficientes' : `${promDias} días`}</b></span>
              <IconInfo className="mp-i" />
            </button>
            {infoOpen && (
              <div className="mp-avg-info">
                {frequency.reason || `Tiempo estimado para recorrer todos los territorios al ritmo registrado. Se calcula: territorios × días del período ÷ finalizaciones. Incluye los territorios sin hacer; no es el intervalo real entre visitas. Período desde ${fmtFecha(frequency.start)} hasta hoy, inclusive.`}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  )
}
