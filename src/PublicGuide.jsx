import { useEffect } from 'react'
import { IconAdmin, IconChart, IconMap, IconPath } from './icons.jsx'

const GuideSection = ({ icon, title, preview, children }) => <section className="guide-section">
  <div className="guide-section-title">{icon}<h3>{title}</h3></div>
  {preview}
  <ul>{children}</ul>
</section>

export default function PublicGuide({ campaignVisible, metricsVisible, adminVisible, onClose }) {
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
          <li>Cambiá la referencia entre <b>Año de servicio</b> e <b>Historial completo</b>.</li>
        </GuideSection>}
        {adminVisible && <div className="guide-admin-block">
          <div className="guide-admin-heading"><IconAdmin /><div><h3>Administración</h3><p>Herramientas disponibles únicamente para administradores.</p></div></div>
          <GuideSection title="Registros" preview={<img className="guide-preview guide-preview-admin" src="guia-admin-registros.png" alt="Vista real de la administración de registros con datos de ejemplo" />}>
            <li>Activá o cerrá un territorio indicando las fechas de inicio y fin.</li>
            <li>Usá los filtros para encontrar territorios completados o todavía activos.</li>
            <li>En un territorio activo podés definir qué manzanas quedan disponibles.</li>
            <li>Los cambios se aplican recién al presionar <b>Guardar</b>.</li>
          </GuideSection>
          <GuideSection title="Generar programa" preview={<img className="guide-preview guide-preview-admin" src="guia-admin-programa.png" alt="Vista real del generador de programa con datos de ejemplo" />}>
            <li>Completá día, horario, lugar, territorio y conductor de cada salida.</li>
            <li>Marcá <b>Salida por grupos</b> para organizar varios grupos bajo un mismo horario.</li>
            <li>El borrador se comparte entre administradores y se descarga con <b>Descargar PNG</b>.</li>
          </GuideSection>
          <GuideSection title="Administradores" preview={<img className="guide-preview guide-preview-admin" src="guia-admin-administradores.png" alt="Vista real de la gestión de administradores con datos de ejemplo" />}>
            <li>Agregá el correo de las personas que tendrán acceso administrativo.</li>
            <li>Podés quitar accesos existentes; la cuenta principal y tu propia cuenta están protegidas.</li>
            <li><b>Cerrar sesión</b> vuelve a la experiencia pública.</li>
          </GuideSection>
        </div>}
      </div>
    </div>
  </div>
}
