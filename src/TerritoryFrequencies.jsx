import {territoryFrequency} from './metricFrequency.js'

export default function TerritoryFrequencies({territory, historicalStart}) {
  const now = new Date()
  return <div className="territory-frequencies">
    {[['history', 'Historial Completo'], ['service', 'Año de servicio']].map(([reference, label]) => {
      const frequency = territoryFrequency(territory, reference, now, historicalStart)
      return <div className="mp-territory-average" key={reference} title="Días del período divididos por las finalizaciones de este territorio; no es un intervalo real entre visitas.">
        <small>Frecuencia Estimada - {label}</small>
        <b>{frequency.days == null ? 'Sin datos suficientes' : `${frequency.days} días`}</b>
      </div>
    })}
  </div>
}
