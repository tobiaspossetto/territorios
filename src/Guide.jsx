import { IconTap, IconZoom, IconChart, IconPin, IconSun } from './icons.jsx'

const STEPS = [
  { Icon: IconTap, text: 'Tocá un territorio para ver su info y sus manzanas.' },
  { Icon: IconZoom, text: 'Acercá el mapa y aparecen los números de manzana.' },
  { Icon: IconChart, text: '"Métrica": mapa de calor por veces predicado + gráfico.' },
  { Icon: IconPin, text: 'Botón de ubicación: mostrá dónde estás parado.' },
  { Icon: IconSun, text: 'Cambiá entre tema claro y oscuro cuando quieras.' },
]

export default function Guide({ dontShow, setDontShow, onClose }) {
  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <h2>¿Cómo usar el mapa?</h2>
        <ul className="guide-steps">
          {STEPS.map((s, i) => (
            <li key={i}><span className="gi"><s.Icon /></span><span>{s.text}</span></li>
          ))}
        </ul>
        <label className="guide-chk">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          No volver a mostrar
        </label>
        <button className="guide-btn" onClick={onClose}>Entendido</button>
      </div>
    </div>
  )
}
