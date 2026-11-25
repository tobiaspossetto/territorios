import {useEffect,useRef,useState} from 'react'
import {chapters} from './guideContent.js'
import './guide.css'

function GuideImage({src,caption}) {
  const ref=useRef(null)
  const [near,setNear]=useState(false)
  useEffect(()=>{
    if(typeof IntersectionObserver==='undefined'){setNear(true);return}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting&&entry.target.getClientRects().length)){setNear(true);observer.disconnect()}
    },{root:ref.current.closest('.guide-content'),rootMargin:'160px 0px'})
    observer.observe(ref.current)
    return()=>observer.disconnect()
  },[src])
  return <img ref={ref} src={near?src:undefined} data-guide-src={src} alt={caption} width="390" height="844" loading="lazy" decoding="async"/>
}

export default function PublicGuide({campaignVisible,adminVisible,onClose}) {
  const [image,setImage]=useState(null)
  const [imageZoomed,setImageZoomed]=useState(false)
  const sheet=useRef(null)
  const imageOpener=useRef(null)
  const publicChapters=chapters.filter(c=>!c.admin&&(c.id!=='campana'||campaignVisible))
  const adminChapters=chapters.filter(c=>c.admin)
  useEffect(()=>{
    const opener=document.activeElement
    sheet.current?.querySelector('button')?.focus()
    return()=>opener?.focus?.()
  },[])
  const closeImage=()=>{setImage(null);setImageZoomed(false);requestAnimationFrame(()=>imageOpener.current?.focus())}
  useEffect(()=>{
    const keyboard=event=>{
      if(event.key==='Escape'){event.stopPropagation();image?closeImage():onClose()}
      if(event.key!=='Tab')return
      const root=image?sheet.current.querySelector('.guide-image-view'):sheet.current
      const items=[...root.querySelectorAll('button, summary, [tabindex="0"]')].filter(el=>el.getClientRects().length)
      const first=items[0],last=items.at(-1)
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
    window.addEventListener('keydown',keyboard)
    return()=>window.removeEventListener('keydown',keyboard)
  },[image,onClose])
  const figure=([src,caption])=><figure key={src}><button className="guide-shot" aria-label={`Ampliar captura: ${caption}`} onClick={event=>{imageOpener.current=event.currentTarget;setImage({src,caption})}}><GuideImage src={src} caption={caption}/><span>Ampliar ↗</span></button><figcaption>{caption}</figcaption></figure>
  const chapter=(c,index)=><details className="guide-chapter" key={c.id} id={`guia-${c.id}`} open={index===0&&!c.admin}>
    <summary><c.icon/><span>{String(index+1).padStart(2,'0')} · {c.title}</span><span className="guide-chevron" aria-hidden="true">⌄</span></summary>
    <div className="guide-chapter-body">{c.intro&&<p className="guide-intro">{c.intro}</p>}
      {c.points?<ul className="guide-quick-points">{c.points.map(text=><li key={text}>{text}</li>)}</ul>:<dl className="guide-steps">{c.steps.map(([title,text])=><div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>}
      {c.note&&<aside className="guide-note"><b>Tené en cuenta</b><p>{c.note}</p></aside>}
      <div className="guide-example-head"><span>Ejemplo en el celular</span><small>{c.images.length>1?'Deslizá y tocá para ampliar':'Tocá para ampliar'}</small></div>
      <div className="guide-shots" role="region" aria-label={`Capturas: ${c.title}`} tabIndex={c.images.length>1?0:undefined}>{c.images.map(figure)}</div>
    </div>
  </details>
  return <div className="guide-bg" onClick={onClose}>
    <div ref={sheet} className="guide-sheet guide-handbook" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={event=>event.stopPropagation()}>
      <div className="guide-main" inert={image?'':undefined}>
        <header className="guide-head"><div><span className="guide-eyebrow">Aprendé a usar la app</span><h2 id="guide-title">Guía de usuario</h2></div><button onClick={onClose} aria-label="Cerrar guía">×</button></header>
        <div className="guide-content">
          <section className="guide-category guide-daily" aria-labelledby="guide-daily-title"><header className="guide-category-head"><h3 id="guide-daily-title">Uso diario</h3></header>{publicChapters.map(chapter)}</section>
          {adminVisible&&<section className="guide-category guide-management" aria-labelledby="guide-management-title"><header className="guide-category-head"><h3 id="guide-management-title">Administración</h3><span>Solo admin</span><p>Registros, programa y herramientas de gestión. Ejemplos con datos ficticios.</p></header>{adminChapters.map(chapter)}</section>}
          <footer className="guide-footnote">Versión {__APP_VERSION__}{__APP_LOCAL__?' · Local':''}</footer>
        </div>
      </div>
      {image&&<div className="guide-image-view" role="region" aria-label="Captura ampliada"><div className="guide-image-tools"><button autoFocus className="guide-image-close" onClick={closeImage}>← Volver a la guía</button><button className="guide-image-close" aria-pressed={imageZoomed} onClick={()=>setImageZoomed(value=>!value)}>{imageZoomed?'Ajustar a pantalla':'Ver tamaño real'}</button></div><div className={`guide-image-canvas${imageZoomed?' zoomed':''}`}><img src={image.src} alt={image.caption}/></div><p>{image.caption}{imageZoomed&&' Deslizá la imagen para explorar el detalle.'}</p></div>}
    </div>
  </div>
}
