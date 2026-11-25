import {useEffect,useState} from 'react'
import {Marker,useMap} from 'react-map-gl/maplibre'

export default function TerritoryBadges({labels,selected,onSelect}) {
  const {current}=useMap()
  const [visible,setVisible]=useState([])
  useEffect(()=>{
    if(!current||!labels)return
    const map=current.getMap()
    let timer,lastUpdate=0
    const update=()=>{
      clearTimeout(timer);timer=undefined
      if(!map.isStyleLoaded())return
      lastUpdate=performance.now()
      const layers=['terr-label','terr-label-near'].filter(id=>map.getLayer(id))
      if(!layers.length)return
      const ids=new Set(map.queryRenderedFeatures({layers}).map(f=>f.properties.territorio))
      setVisible(previous=>{
        const next=labels.features.filter(f=>ids.has(f.properties.territorio)||selected.includes(f.properties.territorio))
        return previous.map(f=>f.properties.territorio).join()===next.map(f=>f.properties.territorio).join()?previous:next
      })
    }
    // Máximo diez consultas por segundo durante un gesto, con actualización
    // final inmediata para no perder las etiquetas del encuadre definitivo.
    const schedule=()=>{if(timer!==undefined)return;timer=setTimeout(update,Math.max(0,100-(performance.now()-lastUpdate)))}
    map.on('move',schedule);map.on('moveend',update);map.on('idle',schedule);schedule()
    return()=>{clearTimeout(timer);map.off('move',schedule);map.off('moveend',update);map.off('idle',schedule)}
  },[current,labels,selected])
  return visible.map(f=><Marker key={f.properties.territorio} longitude={f.geometry.coordinates[0]} latitude={f.geometry.coordinates[1]} anchor="center"><button type="button" className={`territory-badge${selected.includes(f.properties.territorio)?' selected':''}`} aria-label={`Seleccionar territorio ${f.properties.territorio}`} aria-pressed={selected.includes(f.properties.territorio)} onClick={event=>{event.stopPropagation();onSelect(f.properties.territorio)}}>{f.properties.territorio}</button></Marker>)
}
