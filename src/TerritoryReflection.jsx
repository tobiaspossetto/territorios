import {useEffect,useMemo,useRef} from 'react'
import {useMap,Source,Layer} from 'react-map-gl/maplibre'
import {assignmentTerritories} from './programAssignments.js'
import {isAssignmentToday} from './programDates.js'

// Brillo recortado al polígono: no modifica colores, selección ni geometría.
export default function TerritoryReflection({data,assignments,day,active,dark=false}) {
  const {current}=useMap()
  const canvasRef=useRef(null)
  const raised=useMemo(()=>{
    const today=new Set(assignments.filter(item=>isAssignmentToday(item,day)).flatMap(assignmentTerritories))
    return {type:'FeatureCollection',features:data?.features.filter(item=>today.has(item.properties.territorio))||[]}
  },[data,assignments,day])
  useEffect(()=>{
    if(!current||!canvasRef.current||!active)return
    const map=current.getMap(),canvas=canvasRef.current,ctx=canvas.getContext('2d')
    const today=new Set(assignments.filter(item=>isAssignmentToday(item,day)).flatMap(assignmentTerritories))
    const features=data?.features.filter(item=>today.has(item.properties.territorio))||[]
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame,timer,start=0,progress=null
    const elevation=value=>{
      if(!map.getStyle())return
      if(!map.getLayer('today-territory-elevation'))return
      map.setPaintProperty('today-territory-elevation','fill-extrusion-height',value*3)
      map.setPaintProperty('today-territory-elevation','fill-extrusion-opacity',value*(dark ? .22 : .4))
    }
    const clear=()=>ctx.clearRect(0,0,canvas.width,canvas.height)
    const draw=()=>{
      const {width,height}=map.getContainer().getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2)
      if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){
        canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio)
      }
      ctx.setTransform(ratio,0,0,ratio,0,0);clear()
      if(progress===null)return
      for(const feature of features){
        const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[]
        for(const polygon of polygons){
          const rings=polygon.map(ring=>ring.map(point=>map.project(point)))
          const points=rings.flat(),xs=points.map(p=>p.x),ys=points.map(p=>p.y)
          const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys)
          if(right<0||left>width||bottom<0||top>height)continue
          const band=Math.max(30,(right-left)*.35),x=left-band+(right-left+band*2)*progress
          ctx.save();ctx.beginPath()
          for(const ring of rings){ring.forEach((p,index)=>index?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath()}
          ctx.clip('evenodd')
          const gradient=ctx.createLinearGradient(x-band,top,x+band,bottom)
          gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.5,`rgba(255,255,255,${dark ? .18 : .4})`);gradient.addColorStop(1,'rgba(255,255,255,0)')
          ctx.fillStyle=gradient;ctx.fillRect(left,top,right-left,bottom-top);ctx.restore()
        }
      }
    }
    const stop=()=>{cancelAnimationFrame(frame);clearTimeout(timer);progress=null;clear();elevation(0)}
    const tick=now=>{
      progress=Math.max(0,Math.min(1,(now-start)/1600));elevation(Math.sin(progress*Math.PI));draw()
      if(progress<1)frame=requestAnimationFrame(tick)
      else{progress=null;clear();elevation(0);timer=setTimeout(begin,3400)}
    }
    const begin=()=>{if(document.hidden||motion.matches||!features.length)return;start=performance.now();frame=requestAnimationFrame(tick)}
    const restart=()=>{stop();begin()}
    map.on('move',draw);map.on('resize',draw)
    document.addEventListener('visibilitychange',restart);motion.addEventListener('change',restart);begin()
    return()=>{stop();map.off('move',draw);map.off('resize',draw);document.removeEventListener('visibilitychange',restart);motion.removeEventListener('change',restart)}
  },[current,data,assignments,day,active,dark])
  return <>
    <Source id="today-territory-elevation-src" type="geojson" data={raised}>
      <Layer id="today-territory-elevation" type="fill-extrusion" paint={{'fill-extrusion-color':['coalesce',['get','assignmentColor'],'#dfd5bb'],'fill-extrusion-height':0,'fill-extrusion-opacity':0,'fill-extrusion-vertical-gradient':true,'fill-extrusion-opacity-transition':{duration:0}}}/>
    </Source>
    <canvas ref={canvasRef} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} />
  </>
}
