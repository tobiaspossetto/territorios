import {useEffect,useState} from 'react'
import {Source,Layer,Marker,useMap} from 'react-map-gl/maplibre'
import {BUILDING_PLACES,BUILDING_TARGETS,locateBuildingPlaces,placeCenter} from './buildingPlaces.js'

export function PlaceIcon({type}) {
  if(type==='jw')return <b>JW</b>
  const shapes={
    cart:<><path d="M3 4h3l3 12h10l2-8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    bank:<><path d="m3 8 9-5 9 5H3ZM3 21h18M5 18V10m7 8V10m7 8V10"/></>,
    municipality:<><path d="m3 9 9-5 9 5H3Z" fill="#e5c65c"/><path d="M5 10v9m7-9v9m7-9v9M3 21h18M12 4V1h5v3h-5"/><path d="M7 19h10"/></>,
    pill:<><path d="m8 5-3 3a6 6 0 0 0 8 9l4-4a6 6 0 0 0-9-8Z" fill="#f4b2a8" stroke="#ba514c"/><path d="m8 6 10 10" stroke="#ba514c"/><path d="m13 5 4 4" stroke="#fffaf5" strokeWidth="2.5"/></>,
    shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m12 7 1.3 3 3.2.3-2.4 2.2.7 3.2-2.8-1.6-2.8 1.6.7-3.2-2.4-2.2 3.2-.3L12 7Z"/></>,
    ball:<><circle cx="12" cy="12" r="9"/><path d="m12 8 4 3-1.5 4h-5L8 11l4-3ZM12 3v5m9 4-5-1m-1.5 4 3 4m-8-4-3 4M3 12l5-1"/></>,
    hospital:<><rect x="3" y="3" width="18" height="18" rx="5" fill="#e76b64" stroke="#b54943"/><path d="M9 6h6v3h3v6h-3v3H9v-3H6V9h3Z" fill="#fffaf5" stroke="none"/></>,
    school:<><path d="M4 21V9l8-5 8 5v12Z" fill="#d1d6db"/><path d="M12 4V1h6l-2 2 2 2h-6" fill="#e6b752"/><path d="M10 21v-6h4v6M7 11h2m6 0h2"/><circle cx="12" cy="10" r="2" fill="#fff8e8"/></>,
    electricity:<><path d="m14 2-10 12h7l-1 8 10-13h-7l1-7Z" fill="#f8cb64" stroke="#6b8650"/></>,
    park:<><path d="m12 2-7 8h3l-4 6h16l-4-6h3l-7-8Z" fill="#83b67b" stroke="#4d7e50"/><path d="M10 16v6h4v-6" fill="#9c7955" stroke="#806449"/></>,
    meadow:<><path d="M3 20h18M5 20l-2-7m4 7 2-10m3 10-1-6m5 6 3-11m-1 11 3-5" stroke="#55895d"/><circle cx="6" cy="6" r="3" fill="#f3ce78" stroke="none"/></>,
    fuel:<><path d="M4 21V4h10v17M3 21h12M6 6h6v5H6zM14 13h2v5a2 2 0 0 0 4 0V9l-3-4M18 7h2v4h-2"/></>,
    factory:<><path d="M3 21V10l6 4v-4l6 4V4h4l2 17H3ZM7 18h1m4 0h1m4 0h1"/></>,
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[type]}</svg>
}

export default function BuildingPlaces({showIcons=true,mapReady=false}) {
  const {current}=useMap()
  const [features,setFeatures]=useState([])
  const [closeZoom,setCloseZoom]=useState(false)
  useEffect(()=>{
    if(!current)return
    const map=current.getMap()
    const update=()=>setCloseZoom(map.getZoom()>=14)
    const events=['zoom','load','resize','moveend']
    events.forEach(event=>map.on(event,update));update()
    return()=>events.forEach(event=>map.off(event,update))
  },[current,mapReady])
  const iconsVisible=showIcons&&mapReady&&closeZoom
  useEffect(()=>{
    if(!current)return
    const map=current.getMap(),cache=new Map()
    let timer,lastUpdate=0,sourceIds=new Set()
    const update=()=>{
      clearTimeout(timer);timer=undefined
      if(!map.isStyleLoaded())return
      if(map.getZoom()<14)return
      lastUpdate=performance.now()
      if(cache.size===BUILDING_TARGETS.length)return
      const styleLayers=map.getStyle().layers
      sourceIds=new Set(styleLayers.filter(l=>l.source&&/building/.test(l['source-layer']||'')).map(l=>l.source))
      const layers=styleLayers.filter(l=>l.source&&/building/i.test(l['source-layer']||'')&&['fill','fill-extrusion'].includes(l.type))
      const sources=new Map(layers.map(l=>[`${l.source}:${l['source-layer']}`,l]))
      const raw=[...sources.values()].flatMap(l=>map.querySourceFeatures(l.source,{sourceLayer:l['source-layer']}))
      const matches=locateBuildingPlaces(raw)
      let changed=false
      for(const f of matches)if(!cache.has(f.id)){cache.set(f.id,f);changed=true}
      if(changed)setFeatures([...cache.values()])
    }
    const schedule=event=>{
      if(event?.type==='sourcedata'&&sourceIds.size&&!sourceIds.has(event.sourceId))return
      if(timer!==undefined)return
      timer=setTimeout(update,Math.max(0,250-(performance.now()-lastUpdate)))
    }
    const events=['idle','moveend','load','styledata','sourcedata']
    events.forEach(event=>map.on(event,schedule));update()
    return()=>{clearTimeout(timer);events.forEach(event=>map.off(event,schedule))}
  },[current,mapReady])
  return <>
    <Source id="building-places" type="geojson" data={{type:'FeatureCollection',features}}>
      <Layer id="building-places-color" type="fill-extrusion" minzoom={14} paint={{'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}} />
    </Source>
    {iconsVisible&&BUILDING_PLACES.filter(place=>place.icon==='jw').map(place=>{const [longitude,latitude]=placeCenter(place);const matches=features.filter(f=>f.properties.placeId===place.id);return <Marker key={place.id} longitude={longitude} latitude={latitude} anchor="bottom" offset={[0,-7]}><div className="building-place-icon jw" style={{'--place-color':place.color}} role="img" aria-label={place.name} title={place.name} data-place={place.id} data-matched={matches.length} data-expected={place.bounds.length} data-heights={matches.map(f=>f.properties.height).join(',')}><PlaceIcon type={place.icon}/></div></Marker>})}
  </>
}
