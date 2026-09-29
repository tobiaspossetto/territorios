import { useEffect } from 'react'
import { IconChart, IconMap, IconPath } from './icons.jsx'

function MapPreview() {
  return <div className="guide-preview guide-map-preview" aria-hidden="true">
    <span className="guide-block b1">T18</span><span className="guide-block b2 selected">T20</span><span className="guide-block b3">T22</span>
    <div className="guide-mini-card"><b>T20</b><span><i />Activo</span><small>Última visita · 12/09/26</small><small>2 veces predicado</small></div>
  </div>
}

function CampaignPreview() {
  return <div className="guide-preview guide-campaign-preview" aria-hidden="true">
    <span className="guide-block b1 active">T18</span><span className="guide-block b2 done">T20</span><span className="guide-block b3 active">T22</span>
    <div className="guide-mini-legend"><span><i className="active" />Activo</span><span><i className="done" />Hecho</span></div>
  </div>
}

function MetricPreview() {
  return <div className="guide-preview guide-metric-preview" aria-hidden="true">
    <div className="guide-bars"><i style={{ height: '40%' }} /><i style={{ height: '76%' }} /><i style={{ height: '58%' }} /><i style={{ height: '68%' }} /></div>
    <div className="guide-zones"><span>Ciudad Frontera <i><b style={{ width: '82%' }} /></i></span><span>San Francisco <i><b style={{ width: '100%' }} /></i></span><span>Josefina <i><b style={{ width: '68%' }} /></i></span></div>
  </div>
}

const GuideSection = ({ icon, title, preview, children }) => <section className="guide-section">
  <div className="guide-section-title">{icon}<h3>{title}</h3></div>
  {preview}
  <ul>{children}</ul>
</section>

export default function PublicGuide({ campaignVisible, metricsVisible, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="guide-bg" onClick={onClose}>
    <div className="guide-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}>
      <div className="guide-grip" />
      <header className="guide-head">
        <div><h2 id="guide-title">Guía rápida</h2><p>Cómo usar Territorios</p></div>
        <button onClick={onClose} aria-label="Cerrar guía">×</button>
      </header>
      <div className="guide-content">
        <GuideSection icon={<IconMap />} title="Mapa" preview={<MapPreview />}>
          <li>Buscá por número de territorio.</li>
          <li>Tocá un territorio para ver su estado.</li>
          <li>Consultá la última visita y las veces predicado.</li>
        </GuideSection>
        {campaignVisible && <GuideSection icon={<IconPath />} title="Campaña" preview={<CampaignPreview />}>
          <li>Muestra solo los territorios de la campaña.</li>
          <li><b>Naranja:</b> activo. <b>Verde:</b> completado.</li>
          <li>Solo aparece cuando hay una campaña configurada.</li>
        </GuideSection>}
        {metricsVisible && <GuideSection icon={<IconChart />} title="Métrica" preview={<MetricPreview />}>
          <li>Resume el avance y la frecuencia.</li>
          <li>Compara los resultados por zona.</li>
          <li>Puede estar oculta según la configuración.</li>
        </GuideSection>}
      </div>
    </div>
  </div>
}
