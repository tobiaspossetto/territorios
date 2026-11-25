import {useEffect,useState} from 'react'
import './collage-splash.css'
import {shuffleCollageScenes} from './collageScenes.js'
import SplashProgress from './SplashProgress.jsx'

export default function CollageSplash({out,slow,onContinue,onPlaybackComplete}) {
  const [frames]=useState(()=>shuffleCollageScenes())
  const [index,setIndex]=useState(0)
  const gallery=import.meta.env.DEV && new URLSearchParams(window.location.search).has('collageGallery')
  const [loaded,setLoaded]=useState(false)
  const [failed,setFailed]=useState(false)
  const [readyId,setReadyId]=useState(null)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const current=frames[reduced?0:index]
  const currentReady=readyId===current.id
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>setReduced(media.matches)
    media.addEventListener('change',change)
    return()=>media.removeEventListener('change',change)
  },[])
  useEffect(()=>{
    if(failed||reduced){onPlaybackComplete?.();return}
    if(!loaded)return
    onPlaybackComplete?.()
  },[loaded,failed,reduced,onPlaybackComplete])
  useEffect(()=>{
    if(loaded||failed)return
    const timer=setTimeout(()=>setFailed(true),8000)
    return()=>clearTimeout(timer)
  },[loaded,failed])
  useEffect(()=>{
    if(gallery||reduced||out||!currentReady)return
    const timer=setTimeout(()=>setIndex(value=>(value+1)%frames.length),800)
    return()=>clearTimeout(timer)
  },[gallery,reduced,out,currentReady,index,frames.length])
  useEffect(()=>{
    if(gallery||reduced||out||!loaded)return
    // Fetch only the next illustration; never download all fifteen on startup.
    const next=new Image()
    next.decoding='async'
    next.src=frames[(index+1)%frames.length].src
  },[gallery,reduced,out,loaded,index,frames])
  const shown=gallery?frames:[current]
  return <div className={`splash collage-splash${gallery?' collage-gallery':''}${out?' out splash-complete':''}`} role="status" aria-label="Cargando Territorios">
    <div className="collage-center">
      <div className={`collage-sequence${(gallery?loaded:currentReady)?' is-ready':''}${reduced?' is-reduced':''}${out?' is-paused':''}`} aria-hidden="true">
        {shown.map(scene=><div key={scene.id} data-scene={scene.name} className="collage-frame">
          <img className="collage-art" src={scene.src} alt="" decoding="async" fetchpriority={gallery?'auto':'high'} loading={gallery?'lazy':'eager'} onLoad={()=>{setReadyId(scene.id);setLoaded(true)}} onError={()=>setFailed(true)}/>
          {gallery&&<small>{scene.name}</small>}
        </div>)}
      </div>
      <div className="collage-brand"><div className="splash-title">TERRITORIOS</div><div className="splash-sub">Cong Este SF</div></div>
      <SplashProgress complete={out}/>
      {slow&&<div className="collage-slow"><p>La conexión está tardando. El mapa sigue cargando.</p><button type="button" className="admin-mini-btn" onClick={onContinue}>Continuar con carga parcial</button></div>}
    </div>
  </div>
}
