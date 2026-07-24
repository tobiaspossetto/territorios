import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Map, { Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STYLES, COLORS, MAPTILER_KEY, metricFillExpr, offlineStyle } from './theme.js'
import MetricaPanel from './MetricaPanel.jsx'
import Splash from './Splash.jsx'
import Guide from './Guide.jsx'
import Buscador from './Buscador.jsx'
import { IconMap, IconChart, IconSun, IconMoon, IconLogo, IconWhatsapp } from './icons.jsx'

// protocolo pmtiles (para el mapa base offline). Se registra una sola vez.
if (typeof window !== 'undefined' && !window.__pmtilesReg) {
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  window.__pmtilesReg = true
}

function getInitialTheme() {
  try {
    return localStorage.getItem('theme') || 'light'
  } catch (e) { return 'light' }
}

// bbox de una geometría GeoJSON (Polygon o MultiPolygon)
function bboxOf(geom) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  const walk = (a) => {
    if (typeof a[0] === 'number') {
      if (a[0] < minX) minX = a[0]; if (a[0] > maxX) maxX = a[0]
      if (a[1] < minY) minY = a[1]; if (a[1] > maxY) maxY = a[1]
    } else a.forEach(walk)
  }
  walk(geom.coordinates)
  return [[minX, minY], [maxX, maxY]]
}

// área (sin signo) de un anillo
function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(a / 2)
}
// centroide de un anillo
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i]
    const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
  }
  if (a === 0) {
    let sx = 0, sy = 0; ring.forEach(p => { sx += p[0]; sy += p[1] })
    return [sx / ring.length, sy / ring.length]
  }
  a *= 0.5
  return [cx / (6 * a), cy / (6 * a)]
}
// 1 punto por feature: centroide de la parte poligonal más grande (evita labels
// duplicados en MultiPolygon)
function labelPoint(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates : []
  let best = null, bestA = -1
  for (const poly of polys) {
    const ar = ringArea(poly[0])
    if (ar > bestA) { bestA = ar; best = poly[0] }
  }
  return best ? ringCentroid(best) : null
}
function toLabelFC(fc) {
  return {
    type: 'FeatureCollection',
    features: fc.features.map(f => {
      const c = labelPoint(f.geometry)
      return c ? { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: c } } : null
    }).filter(Boolean),
  }
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [mode, setMode] = useState('mapa') // 'mapa' | 'metrica'
  const [terr, setTerr] = useState(null)
  const [manz, setManz] = useState(null)
  const [meta, setMeta] = useState(null)
  const [popup, setPopup] = useState(null)
  const [selected, setSelected] = useState(null)     // territorio id
  const [geoError, setGeoError] = useState(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [splash, setSplash] = useState(true)
  const [splashOut, setSplashOut] = useState(false)
  const [showGuide, setShowGuide] = useState(() => { try { return !localStorage.getItem('guideSeen') } catch (e) { return true } })
  const [dontShow, setDontShow] = useState(false)
  const mapRef = useRef(null)
  const geoRef = useRef(null)
  const terrLabels = useMemo(() => (terr ? toLabelFC(terr) : null), [terr])
  const manzLabels = useMemo(() => (manz ? toLabelFC(manz) : null), [manz])
  const ready = useRef({ data: false, map: false, time: false, done: false })
  const deepLinkDone = useRef(false)

  const hideSplash = useCallback(() => {
    const r = ready.current
    if (r.done) return
    if (r.data && r.map && r.time) { r.done = true; setSplashOut(true); setTimeout(() => setSplash(false), 550) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { ready.current.time = true; hideSplash() }, 1300)
    const fb = setTimeout(() => {
      if (!ready.current.done) { ready.current.done = true; setSplashOut(true); setTimeout(() => setSplash(false), 550) }
    }, 5000)
    return () => { clearTimeout(t); clearTimeout(fb) }
  }, [hideSplash])

  useEffect(() => {
    Promise.all([
      fetch('territorios.geojson').then(r => r.json()),
      fetch('manzanas.geojson').then(r => r.json()),
    ]).then(([t, m]) => { setTerr(t); setManz(m); ready.current.data = true; hideSplash() })
      .catch(console.error)
    fetch('meta.json').then(r => r.json()).then(setMeta).catch(() => {})
  }, [hideSplash])

  useEffect(() => {
    const r = () => mapRef.current && mapRef.current.resize()
    window.addEventListener('resize', r)
    const t = setTimeout(r, 300)
    return () => { window.removeEventListener('resize', r); clearTimeout(t) }
  }, [])
  useEffect(() => { if (!splash && mapRef.current) mapRef.current.resize() }, [splash])
  useEffect(() => { if (import.meta.env.DEV && mapRef.current) window.__map = mapRef.current.getMap() })
  useEffect(() => { try { localStorage.setItem('theme', theme) } catch (e) {} }, [theme])

  // online -> MapTiler (igual que siempre); offline -> base local PMTiles (fallback)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const fitAll = useCallback(() => {
    if (!terr || !mapRef.current) return
    let minX = 180, minY = 90, maxX = -180, maxY = -90
    for (const f of terr.features) {
      const b = bboxOf(f.geometry)
      if (b[0][0] < minX) minX = b[0][0]; if (b[1][0] > maxX) maxX = b[1][0]
      if (b[0][1] < minY) minY = b[0][1]; if (b[1][1] > maxY) maxY = b[1][1]
    }
    mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 24, duration: 0 })
    mapRef.current.zoomTo(mapRef.current.getZoom() + 0.35, { duration: 0 })
  }, [terr])

  useEffect(() => { fitAll() }, [terr, fitAll])

  // refleja el territorio activo en la URL (?t=T52) sin recargar -> permite compartir
  const setUrlTerr = (id) => {
    try {
      const u = new URL(window.location.href)
      if (id) u.searchParams.set('t', id); else u.searchParams.delete('t')
      window.history.replaceState(null, '', u)
    } catch (e) {}
  }

  // selecciona un territorio (usado por click en mapa, buscador y deep-link)
  const selectTerr = useCallback((id, opts = {}) => {
    const feat = terr && terr.features.find(x => x.properties.territorio === id)
    if (!feat) return
    setSelected(id)
    setPopup({ ...feat.properties })
    setUrlTerr(id)
    const cam = { padding: { top: 140, bottom: 70, left: 40, right: 40 }, maxZoom: 16.5, duration: 650 }
    if (opts.tilt) { cam.pitch = 50; cam.bearing = -16; cam.duration = 950 }  // vista 3D leve (deep-link)
    if (mapRef.current) mapRef.current.fitBounds(bboxOf(feat.geometry), cam)
  }, [terr])

  const clearTerr = useCallback(() => { setSelected(null); setPopup(null); setUrlTerr(null) }, [])

  const onClick = useCallback((e) => {
    const f = e.features && e.features[0]
    if (!f) { clearTerr(); return }
    selectTerr(f.properties.territorio)
  }, [selectTerr, clearTerr])

  // deep-link: cuando mapa Y datos están listos, si la URL trae ?t=T52 abrir ese
  // territorio (después del fitAll inicial, para que el zoom no se pise)
  useEffect(() => {
    if (!terr || !mapLoaded || deepLinkDone.current) return
    deepLinkDone.current = true
    try {
      const id = new URL(window.location.href).searchParams.get('t')
      if (id && terr.features.some(f => f.properties.territorio === id)) selectTerr(id, { tilt: true })
    } catch (e) {}
  }, [terr, mapLoaded, selectTerr])

  // compartir el territorio activo por WhatsApp con link directo
  const shareTerr = useCallback(() => {
    if (!popup) return
    const url = `${location.origin}${location.pathname}?t=${popup.territorio}`
    const text = `Territorio ${popup.territorio} (${popup.zona}) — Congregación Este, SF\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [popup])

  const closeGuide = useCallback(() => {
    if (dontShow) { try { localStorage.setItem('guideSeen', '1') } catch (e) {} }
    setShowGuide(false)
  }, [dontShow])

  const onGeoError = useCallback((e) => {
    const msg = e && e.code === 1 ? 'Permiso de ubicación denegado. En Mac: Ajustes ▸ Privacidad ▸ Localización → activá el navegador.'
      : e && e.code === 2 ? 'Ubicación no disponible (revisá Localización del sistema/GPS).'
      : e && e.code === 3 ? 'La ubicación tardó demasiado. Reintentá.'
      : 'No se pudo obtener la ubicación.'
    setGeoError(msg); setTimeout(() => setGeoError(null), 7000)
  }, [])

  if (!MAPTILER_KEY) {
    return (
      <div className="nokey">
        <h2>Falta la API key de MapTiler</h2>
        <p>Creá <code>.env</code> en <code>territorios-react/</code> con <code>VITE_MAPTILER_KEY=tu_key</code> y reiniciá.</p>
      </div>
    )
  }

  const c = COLORS[theme]
  const isMet = mode === 'metrica'
  const sel = selected || '__none__'
  const manzBorder = theme === 'dark' ? 'rgba(182,163,230,.5)' : 'rgba(78,59,143,.4)'
  const highlight = theme === 'dark' ? '#d9c8ff' : '#4e3b8f'
  const lblTxt = theme === 'dark' ? '#ffffff' : '#0f1520'
  const lblHalo = theme === 'dark' ? 'rgba(10,8,18,.95)' : 'rgba(255,255,255,.95)'
  const terrLblColor = theme === 'dark' ? '#b6a3e6' : '#6a4fb0'  // nro de territorio en color del trazo

  // --- capa TERRITORIO (unión) ---
  const terrFill = {
    id: 'terr-fill', type: 'fill',
    paint: { 'fill-color': isMet ? metricFillExpr(theme) : c.fill, 'fill-opacity': isMet ? 0.7 : c.fillOpacity },
  }
  const glowBase = (!isMet && c.neon) ? 0.6 : 0
  const terrGlow = {
    id: 'terr-glow', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': c.glow,
      'line-width': (!isMet && c.neon) ? c.glowWidth : 0,
      'line-blur': (!isMet && c.neon) ? c.glowBlur : 0,
      // al seleccionar: solo el elegido conserva glow, el resto se apaga
      'line-opacity': selected ? ['case', ['==', ['get', 'territorio'], selected], glowBase, 0] : glowBase,
    },
  }
  const terrLine = {
    id: 'terr-line', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': isMet ? (theme === 'dark' ? 'rgba(255,255,255,.4)' : 'rgba(20,30,60,.5)') : c.stroke,
      'line-width': isMet ? 1.2 : c.coreWidth,
      // al seleccionar: atenuar el resto para que destaque el elegido
      'line-opacity': selected ? ['case', ['==', ['get', 'territorio'], selected], 1, 0.15] : 1,
    },
  }
  const terrSel = {
    id: 'terr-sel', type: 'line', filter: ['==', ['get', 'territorio'], sel],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': highlight, 'line-width': 3.2 },
  }
  // lejos (overview): declutter para no amontonar los 64
  const terrLabelFar = {
    id: 'terr-label', type: 'symbol', maxzoom: 15,
    layout: { 'text-field': ['get', 'territorio'], 'text-font': ['Noto Sans Bold'], 'text-size': 15 },
    paint: { 'text-color': terrLblColor, 'text-halo-color': lblHalo, 'text-halo-width': 2.4 },
  }
  // cerca (zoom manzanas): SIEMPRE visible + no bloquea los nros de manzana
  const terrLabelNear = {
    id: 'terr-label-near', type: 'symbol', minzoom: 15,
    layout: {
      'text-field': ['get', 'territorio'], 'text-font': ['Noto Sans Bold'], 'text-size': 18,
      'text-allow-overlap': true, 'text-ignore-placement': true,
    },
    paint: { 'text-color': terrLblColor, 'text-halo-color': lblHalo, 'text-halo-width': 3.8, 'text-halo-blur': 0.4 },
  }

  // --- capa MANZANAS ---
  const manzFillSel = {
    id: 'manz-fill-sel', type: 'fill', filter: ['==', ['get', 'territorio'], sel],
    paint: { 'fill-color': theme === 'dark' ? '#8a6fd0' : '#6a4fb0', 'fill-opacity': 0.16 },
  }
  const manzLine = {
    id: 'manz-line', type: 'line',
    paint: {
      'line-color': manzBorder,
      'line-width': 0.8,
      // aparecen al acercar (~nivel calles)
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.9],
    },
  }
  const manzLineSel = {
    id: 'manz-line-sel', type: 'line', filter: ['==', ['get', 'territorio'], sel],
    paint: { 'line-color': theme === 'dark' ? '#c9b6f0' : '#4e3b8f', 'line-width': 1.4, 'line-opacity': 1 },
  }
  const manzLabel = {
    id: 'manz-label', type: 'symbol', minzoom: 15,
    // con un territorio seleccionado, ocultar los números de manzana del resto (solo se ve el seleccionado)
    filter: selected ? ['==', ['get', 'territorio'], ' __none__'] : ['has', 'territorio'],
    layout: { 'text-field': ['get', 'manzana'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-allow-overlap': false },
    paint: { 'text-color': lblTxt, 'text-halo-color': lblHalo, 'text-halo-width': 2.4 },
  }
  const manzLabelSel = {
    id: 'manz-label-sel', type: 'symbol', filter: ['==', ['get', 'territorio'], sel],
    layout: { 'text-field': ['get', 'manzana'], 'text-font': ['Noto Sans Bold'], 'text-size': 16, 'text-allow-overlap': true },
    paint: { 'text-color': lblTxt, 'text-halo-color': lblHalo, 'text-halo-width': 2.6 },
  }

  return (
    <div className="app" data-theme={theme}>
      <Map
        ref={mapRef}
        mapStyle={online ? STYLES[theme] : offlineStyle()}
        initialViewState={{ longitude: -62.03, latitude: -31.43, zoom: 12, pitch: 0, bearing: 0 }}
        interactiveLayerIds={['terr-fill']}
        onClick={onClick}
        onLoad={() => { if (mapRef.current) { mapRef.current.resize(); if (import.meta.env.DEV) window.__map = mapRef.current.getMap() } fitAll(); ready.current.map = true; setMapLoaded(true); hideSplash() }}
        maxPitch={70}
        dragRotate
        pitchWithRotate
        touchZoomRotate
        style={{ position: 'absolute', inset: 0 }}
      >
        <NavigationControl position="top-right" showCompass visualizePitch />
        <GeolocateControl
          ref={geoRef} position="top-right"
          trackUserLocation showUserLocation showUserHeading
          positionOptions={{ enableHighAccuracy: true }} onError={onGeoError}
        />
        {terr && (
          <Source id="terr" type="geojson" data={terr}>
            <Layer {...terrFill} />
            <Layer {...terrGlow} />
            <Layer {...terrLine} />
            <Layer {...terrSel} />
          </Source>
        )}
        {manz && (
          <Source id="manz" type="geojson" data={manz}>
            <Layer {...manzFillSel} />
            <Layer {...manzLine} />
            <Layer {...manzLineSel} />
          </Source>
        )}
        {/* labels arriba de todo */}
        {/* manzanas primero, territorio DESPUÉS -> el nro de territorio queda arriba */}
        {manzLabels && (
          <Source id="manz-lbl" type="geojson" data={manzLabels}>
            <Layer {...manzLabel} />
            <Layer {...manzLabelSel} />
          </Source>
        )}
        {terrLabels && (
          <Source id="terr-lbl" type="geojson" data={terrLabels}>
            <Layer {...terrLabelFar} />
            <Layer {...terrLabelNear} />
          </Source>
        )}
      </Map>

      <div className="topbar">
        <IconLogo className="logo" />
        <h1>Congregación Este, SF</h1>
      </div>
      <button className="themeBtn" aria-label="Cambiar tema"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>

      {geoError && <div className="toast">{geoError}</div>}

      {popup && (
        <div className="info-card">
          <button className="info-share" onClick={shareTerr} aria-label="Compartir por WhatsApp"><IconWhatsapp /></button>
          <button className="info-close" onClick={clearTerr} aria-label="Cerrar">×</button>
          <div className="info-t"><b>{popup.territorio}</b> · {popup.zona}</div>
          {popup.veces > 0 ? (
            <div className="info-body">
              Completado <b>{popup.veces}</b> {popup.veces === 1 ? 'vez' : 'veces'} · última {popup.ultima_fmt}
              {popup.dias_desde != null && ` · hace ${popup.dias_desde} días`}
            </div>
          ) : (<div className="info-body">Sin registro</div>)}
        </div>
      )}

      {!isMet && <Buscador data={terr} onPick={selectTerr} />}

      {isMet && <MetricaPanel data={terr} theme={theme} meta={meta} />}

      <nav className="footer">
        <button className={mode === 'mapa' ? 'on' : ''} onClick={() => setMode('mapa')}>
          <IconMap /><span>Mapa</span>
        </button>
        <button className={mode === 'metrica' ? 'on' : ''} onClick={() => setMode('metrica')}>
          <IconChart /><span>Métrica</span>
        </button>
      </nav>

      {!splash && showGuide && (
        <Guide dontShow={dontShow} setDontShow={setDontShow} onClose={closeGuide} />
      )}

      {splash && <Splash out={splashOut} />}
    </div>
  )
}
