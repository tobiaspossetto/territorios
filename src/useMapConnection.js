import {useEffect,useState} from 'react'
import {confirmMapConnection} from './mapConnectivity.js'

export function useMapConnection(url) {
  const offlinePreview=import.meta.env.DEV && new URLSearchParams(window.location.search).has('offlinePreview')
  const [online,setOnline]=useState(()=>offlinePreview?false:navigator.onLine)
  useEffect(()=>{
    if(offlinePreview)return
    let stopped=false,checking=false,controller,timer,retry,generation=0
    let reachable=navigator.onLine
    const check=async()=>{
      if(stopped||checking||document.hidden)return
      clearTimeout(retry)
      checking=true
      const version=++generation
      controller=new AbortController()
      timer=setTimeout(()=>controller.abort(),4000)
      const result=await confirmMapConnection(url,{signal:controller.signal})
      clearTimeout(timer)
      checking=false
      if(stopped||version!==generation)return
      reachable=result
      setOnline(result)
      if(!result)retry=setTimeout(check,30000)
    }
    const on=()=>{
      generation++
      controller?.abort()
      clearTimeout(timer)
      clearTimeout(retry)
      reachable=true
      setOnline(true)
      void check()
    }
    const resume=()=>{if(!navigator.onLine||!reachable)void check()}
    window.addEventListener('online',on)
    window.addEventListener('offline',check)
    window.addEventListener('focus',resume)
    document.addEventListener('visibilitychange',resume)
    // Wi-Fi can remain "online" while there is no usable internet connection.
    void check()
    return()=>{
      stopped=true
      controller?.abort()
      clearTimeout(timer)
      clearTimeout(retry)
      window.removeEventListener('online',on)
      window.removeEventListener('offline',check)
      window.removeEventListener('focus',resume)
      document.removeEventListener('visibilitychange',resume)
    }
  },[url,offlinePreview])
  return online
}
