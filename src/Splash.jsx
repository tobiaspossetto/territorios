import {useEffect,useRef,useState} from 'react'
import CollageSplash from './CollageSplash.jsx'
import {normalizeSplashType} from './splashType.js'
import SplashProgress from './SplashProgress.jsx'

export default function Splash({type='collage',pending=false,...props}) {
  // Load artwork immediately; public configuration still gates entry into the app.
  return normalizeSplashType(type)==='auto'?<VideoSplash {...props}/>:<CollageSplash {...props}/>
}

// The original welcome remains available as the Auto option.
// Completar la primera reproducción sin bloquear si falla o se reduce movimiento.
function VideoSplash({ out,slow,onContinue,onPlaybackComplete,theme='light' }) {
  const videoSource=theme==='dark'?'camioneta-inicio-oscuro.mp4?v=af4ecc8f':'camioneta-inicio-claro.mp4'
  const videoRef=useRef(null)
  const [failed,setFailed]=useState(false)
  const [played,setPlayed]=useState(false)
  const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)')
    const update=()=>setReducedMotion(preference.matches)
    preference.addEventListener('change',update)
    return()=>preference.removeEventListener('change',update)
  },[])
  useEffect(()=>{
    const video=videoRef.current
    if(!video)return
    let active=true
    if(out)video.pause()
    else video.play()?.catch(()=>{if(active)setFailed(true)})
    return()=>{active=false;video.pause()}
  },[out,reducedMotion,failed,played,videoSource])
  useEffect(()=>{
    if(failed||reducedMotion)onPlaybackComplete?.()
  },[failed,reducedMotion,onPlaybackComplete])
  useEffect(()=>{
    if(played||failed||reducedMotion)return
    // Una descarga bloqueada no debe dejar la app atrapada en la bienvenida.
    const timer=setTimeout(()=>setFailed(true),15000)
    return()=>clearTimeout(timer)
  },[played,failed,reducedMotion])
  return (
    <div className={'splash' + (out ? ' out splash-complete' : '')} role="status" aria-label="Cargando Territorios">
      <div className="splash-inner">
        {reducedMotion||failed?<img className="splash-mark" src="logo-furgon.png" alt="" />:
          <video key={videoSource} ref={videoRef} className="splash-mark splash-video" src={videoSource} poster="logo-furgon.png" autoPlay muted loop={played} playsInline preload="auto" aria-hidden="true" disablePictureInPicture onEnded={()=>{setPlayed(true);onPlaybackComplete?.()}} onError={()=>setFailed(true)}/>}
        <div className="splash-title">TERRITORIOS</div>
        <div className="splash-sub">Cong Este SF</div>
        <SplashProgress complete={out}/>
        {slow&&<div role="status" style={{marginTop:20,fontSize:13}}><p>La conexión está tardando. El mapa sigue cargando.</p><button type="button" className="admin-mini-btn" onClick={onContinue}>Continuar con carga parcial</button></div>}
      </div>
    </div>
  )
}
