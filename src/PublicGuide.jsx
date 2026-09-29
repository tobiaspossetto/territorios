import { useEffect } from 'react'
import { IconChart, IconMap, IconPath } from './icons.jsx'

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
        <GuideSection icon={<IconMap />} title="Mapa" preview={<img className="guide-preview" src="guia-mapa.png" alt="Ejemplo de un territorio seleccionado y su información" />}>
          <li>Buscá por número de territorio.</li>
          <li>Tocá un territorio para ver su estado.</li>
          <li>Consultá la última visita y las veces predicado.</li>
        </GuideSection>
        {campaignVisible && <GuideSection icon={<IconPath />} title="Campaña" preview={<img className="guide-preview" src="guia-campana.png" alt="Ejemplo de territorios activos y completados en una campaña" />}>
          <li>Muestra solo los territorios de la campaña.</li>
          <li><b>Naranja:</b> activo. <b>Verde:</b> completado.</li>
          <li>Solo aparece cuando hay una campaña configurada.</li>
        </GuideSection>}
        {metricsVisible && <GuideSection icon={<IconChart />} title="Métrica" preview={<img className="guide-preview guide-preview-metric" src="guia-metrica.png" alt="Ejemplo del resumen de métricas y avance por zona" />}>
          <li>Resume el avance y la frecuencia.</li>
          <li>Compara los resultados por zona.</li>
          <li>Puede estar oculta según la configuración.</li>
        </GuideSection>}
      </div>
    </div>
  </div>
}
