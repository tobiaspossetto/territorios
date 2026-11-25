import {useEffect} from 'react'
import {useMap} from 'react-map-gl/maplibre'

// Confirmar datos del encuadre inicial y marcadores antes de retirar la carga.
export default function InitialMapReady({enabled,posts,markers,onReady}) {
  const {current}=useMap()
  useEffect(()=>{
    if(!current||!enabled)return
    const map=current.getMap()
    let frame,secondFrame,finished=false
    const check=()=>{
      frame=undefined
      if(finished||!map.getStyle()?.layers?.length||!map.loaded())return
      const rect=map.getContainer().getBoundingClientRect()
      if(!rect.width||!rect.height)return
      map.resize()
      for(const post of posts){
        const marker=markers.current.get(post.id)
        if(!marker?.getElement().isConnected)return
        // Reproyectar después de montar el contenido del portal y medirlo.
        marker.setLngLat(post.coordinates)
      }
      map.triggerRepaint()
      secondFrame=requestAnimationFrame(()=>{finished=true;onReady()})
    }
    const schedule=()=>{if(!finished&&frame===undefined&&secondFrame===undefined)frame=requestAnimationFrame(check)}
    const events=['styledata','sourcedata','idle','load','resize']
    events.forEach(event=>map.on(event,schedule));schedule()
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(secondFrame);events.forEach(event=>map.off(event,schedule))}
  },[current,enabled,posts,markers,onReady])
  return null
}
