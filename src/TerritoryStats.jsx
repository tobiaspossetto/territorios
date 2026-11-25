import TerritoryFrequencies from './TerritoryFrequencies.jsx'

export default function TerritoryStats({territory, historicalStart}) {
  return <div className="territory-stats">
    <div className="territory-stats-row"><span>Última visita</span><b>{territory.ultima_visita_fmt || territory.ultima_fmt || 'Sin registro'}</b></div>
    <TerritoryFrequencies territory={territory} historicalStart={historicalStart} />
    <div className="territory-stats-row territory-counts"><span>Veces realizadas</span><b>{territory.veces || 0} histórico · {territory.veces_servicio || 0} año de servicio</b></div>
  </div>
}
