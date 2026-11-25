import {useEffect} from 'react'
import {useMap} from 'react-map-gl/maplibre'

export default function MarkerAnimationControl({items,active,day}) {
  const {current}=useMap()
  useEffect(()=>{
    if(!current)return
    const map=current.getMap(),container=map.getContainer()
    const update=()=>container.style.setProperty('--assignment-label-scale',String(.82+.18*Math.max(0,Math.min(1,(map.getZoom()-14)/2))))
    map.on('zoom',update);update()
    return()=>{map.off('zoom',update);container.style.removeProperty('--assignment-label-scale')}
  },[current])
  useEffect(()=>{
    if(!current)return
    const labels=[...current.getMap().getContainer().querySelectorAll('.assignment-post-labels span')]
    const visible=new Set()
    const update=()=>labels.forEach(label=>label.classList.toggle('animation-paused',!active||document.hidden||!visible.has(label)))
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
      for(const entry of entries){if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target)}
      update()
    })
    labels.forEach(label=>observer?observer.observe(label):visible.add(label))
    document.addEventListener('visibilitychange',update);update()
    return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);labels.forEach(label=>label.classList.remove('animation-paused'))}
  },[current,items,active,day])
  return null
}
