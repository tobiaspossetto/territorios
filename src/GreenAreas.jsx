import {useEffect,useMemo,useState} from 'react'
import {Source,Layer,Marker,useMap} from 'react-map-gl/maplibre'
import {PlaceIcon} from './BuildingPlaces.jsx'
import {localGreenAreas,findCentennialPark} from './greenAreas.js'

export default function GreenAreas({blocks}) {
  const {current}=useMap()
  const [park,setPark]=useState(null)
  const areas=useMemo(()=>[...localGreenAreas(blocks),...(park?.feature?[park.feature]:[])],[blocks,park])
  useEffect(()=>{
    if(!current)return
    const map=current.getMap()
    let timer,resolved=false,lastSignature=''
    const update=()=>{
      if(!map.isStyleLoaded()||resolved)return
      const specs=new Map(map.getStyle().layers.filter(l=>l.source&&/poi|landuse|landcover/.test(l['source-layer']||'')).map(l=>[`${l.source}:${l['source-layer']}`,l]))
      const pois=[],land=[]
      for(const l of specs.values()) {
        const list=map.querySourceFeatures(l.source,{sourceLayer:l['source-layer']})
        if(/poi/.test(l['source-layer']))pois.push(...list)
        else land.push(...list)
      }
      const result=findCentennialPark(pois,land)
      if(result){const signature=JSON.stringify(result);if(signature!==lastSignature){lastSignature=signature;setPark(result)}resolved=Boolean(result.feature)}
    }
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(update,200)}
    map.on('idle',schedule);map.on('moveend',schedule);schedule()
    return()=>{clearTimeout(timer);map.off('idle',schedule);map.off('moveend',schedule)}
  },[current])
  return <>
    {areas.length>0&&<Source id="local-green-areas" type="geojson" data={{type:'FeatureCollection',features:areas}}>
      <Layer id="local-green-fill" type="fill" beforeId="terr-glow" paint={{'fill-color':'#afc6a0','fill-opacity':.65}}/>
      <Layer id="local-green-edge" type="line" beforeId="terr-glow" paint={{'line-color':'#91a77f','line-width':1,'line-opacity':.6}}/>
      <Layer id="local-green-label" type="symbol" minzoom={14} layout={{'text-field':['get','name'],'text-font':['Noto Sans Bold'],'text-size':11,'text-max-width':12}} paint={{'text-color':'#526c46','text-halo-color':'#f8faef','text-halo-width':1.5}}/>
    </Source>}
    {park&&<Marker longitude={park.center[0]} latitude={park.center[1]} anchor="bottom" offset={[0,-7]}><div className="building-place-icon" role="img" aria-label={park.name} title={park.name} style={{'--place-color':'#83b67b'}} data-green-boundary={park.feature?'provider':'pending'}><PlaceIcon type="park"/></div></Marker>}
  </>
}
