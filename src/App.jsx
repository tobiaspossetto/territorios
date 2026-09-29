import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Map, { Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE, COLORS, COLORS_HECHO, MAPTILER_KEY, metricFillExpr, offlineStyle } from './theme.js'
import MetricaPanel from './MetricaPanel.jsx'
import PublicGuide from './PublicGuide.jsx'
import Splash from './Splash.jsx'
import Buscador from './Buscador.jsx'
import { bordeConCalles } from './calles.js'
import { IconMap, IconChart, IconPath, IconGuide, IconAdmin, IconWhatsapp, IconList } from './icons.jsx'
import AdminLogin from './AdminLogin.jsx'
import AdminPanel from './AdminPanelV2.jsx'
import {
  applyPublicSummaries, ensurePublicMapSummary, isAuthorizedAdmin, logoutFirebase, observeAuth,
  saveRecordChanges, setCampaignMode, setMetricsVisible, subscribePublicState, subscribeRecords,
} from './firebaseData.js'

// protocolo pmtiles (para el mapa base offline). Se registra una sola vez.
if (typeof window !== 'undefined' && !window.__pmtilesReg) {
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  window.__pmtilesReg = true
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
// Diagonales de la manzana usando un bounding box ORIENTADO (alineado a su lado
// más largo), así la X queda contenida y prolija aunque el polígono esté rotado.
// Devuelve [[p,p],[p,p]] en lng/lat, o null.
function obbDiagonals(ring, scale = 0.86) {
  const pts = ring.slice(0, -1)
  if (pts.length < 3) return null
  const lat0 = pts[0][1]
  const kx = Math.cos((lat0 * Math.PI) / 180)          // corrige la escala de lng
  const P = pts.map(([lng, lat]) => [lng * kx, lat])

  // dirección del lado más largo
  let ang = 0, best = -1
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length]
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (d > best) { best = d; ang = Math.atan2(b[1] - a[1], b[0] - a[0]) }
  }
  const cos = Math.cos(-ang), sin = Math.sin(-ang)
  const rot = (p) => [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos]
  const unrot = (p) => {
    const c2 = Math.cos(ang), s2 = Math.sin(ang)
    return [p[0] * c2 - p[1] * s2, p[0] * s2 + p[1] * c2]
  }

  // bbox en el espacio rotado
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of P) {
    const r = rot(p)
    if (r[0] < minX) minX = r[0]; if (r[0] > maxX) maxX = r[0]
    if (r[1] < minY) minY = r[1]; if (r[1] > maxY) maxY = r[1]
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const hw = ((maxX - minX) / 2) * scale, hh = ((maxY - minY) / 2) * scale

  // esquinas -> volver al plano original -> a lng/lat
  const corner = (sx, sy) => {
    const p = unrot([cx + sx * hw, cy + sy * hh])
    return [p[0] / kx, p[1]]
  }
  return [
    [corner(-1, -1), corner(1, 1)],
    [corner(-1, 1), corner(1, -1)],
  ]
}

// bbox (para el zoom) + centro real (para la cámara) del cluster principal.
// Dos problemas con solo hacer fitBounds de todo: (1) hay un grupo aislado
// (Villa Josefina, ~7 de 64) lejos del grueso (Frontera/SF) que si se incluye
// arranca la cámara centrada en el hueco vacío entre ambos; (2) incluso solo
// el cluster principal es una tira angosta pegada al borde oeste con algún
// territorio suelto que estira el borde este, así que el CENTRO del bbox
// tampoco coincide con donde está realmente la mayoría -> se usa el promedio
// de centroides en vez del centro geométrico del bbox.
function mainClusterFocus(features) {
  const cents = features.map(f => {
    const b = bboxOf(f.geometry)
    return { f, cx: (b[0][0] + b[1][0]) / 2, cy: (b[0][1] + b[1][1]) / 2 }
  })
  const xs = cents.map(c => c.cx).slice().sort((a, b) => a - b)
  let gapIdx = -1, gapSize = 0
  for (let i = 0; i < xs.length - 1; i++) {
    const g = xs[i + 1] - xs[i]
    if (g > gapSize) { gapSize = g; gapIdx = i }
  }
  let main = cents
  if (gapIdx >= 0 && gapSize >= 0.01) {
    const cut = (xs[gapIdx] + xs[gapIdx + 1]) / 2
    const left = cents.filter(c => c.cx <= cut)
    const right = cents.filter(c => c.cx > cut)
    const bigger = left.length >= right.length ? left : right
    if (bigger.length >= cents.length * 0.5) main = bigger   // sino, ningún lado es mayoría clara -> usar todos
  }
  let minX = 180, minY = 90, maxX = -180, maxY = -90, sx = 0, sy = 0
  for (const c of main) {
    const b = bboxOf(c.f.geometry)
    if (b[0][0] < minX) minX = b[0][0]; if (b[1][0] > maxX) maxX = b[1][0]
    if (b[0][1] < minY) minY = b[0][1]; if (b[1][1] > maxY) maxY = b[1][1]
    sx += c.cx; sy += c.cy
  }
  return { bounds: [[minX, minY], [maxX, maxY]], center: [sx / main.length, sy / main.length] }
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
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('app-v2-theme')
      return saved === 'dark' ? 'dark' : 'light'
    } catch { return 'light' }
  })
  const [campModoOn, setCampModoOn] = useState(false)
  const [metricsVisible, setMetricsVisibleState] = useState(true)
  const [metricReference, setMetricReference] = useState(() => {
    try { return localStorage.getItem('metric-reference') === 'history' ? 'history' : 'service' } catch { return 'service' }
  })
  const [mode, setMode] = useState('mapa') // 'mapa' | 'metrica' | 'campana'
  const [terr, setTerr] = useState(null)
  const [manz, setManz] = useState(null)
  const [meta, setMeta] = useState(null)
  const [popup, setPopup] = useState(null)
  const [selected, setSelected] = useState(null)     // territorio id
  const [tachadas, setTachadas] = useState(null)     // manzanas tachadas por URL o por configuración del registro activo
  const [geoError, setGeoError] = useState(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [bordeCalles, setBordeCalles] = useState(null)
  const [splash, setSplash] = useState(true)
  const [splashOut, setSplashOut] = useState(false)
  const adminPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('adminPreview')
  const previewRecords = adminPreview ? [
    { id: 'preview-1', territorio: 'T18', inicio: '2026-09-18', fin: '2026-09-22', campania: true, manzanasActivas: null },
    { id: 'preview-2', territorio: 'T25', inicio: '2026-09-24', fin: null, campania: true, manzanasActivas: ['1', '3', '4'] },
    { id: 'preview-3', territorio: 'T31', inicio: '2026-09-15', fin: '2026-09-19', campania: false, manzanasActivas: null },
  ] : []
  const [adminUser, setAdminUser] = useState(() => adminPreview ? { email: 'preview@local.test' } : null)
  const [showLogin, setShowLogin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(adminPreview)
  const [showGuide, setShowGuide] = useState(false)
  const [adminInitialQuery, setAdminInitialQuery] = useState('')
  const [registroBase, setRegistroBase] = useState(previewRecords)
  const [publicSummaries, setPublicSummaries] = useState({})
  const [publicConfigReady, setPublicConfigReady] = useState(false)
  const [adminSyncError, setAdminSyncError] = useState('')
  const mapRef = useRef(null)
  const geoRef = useRef(null)
  const adminOn = !!adminUser
  const terrView = useMemo(() => applyPublicSummaries(terr, publicSummaries), [terr, publicSummaries])
  const manzView = useMemo(() => applyPublicSummaries(manz, publicSummaries), [manz, publicSummaries])
  const metricTerrView = useMemo(() => !terrView ? null : ({
    ...terrView,
    features: terrView.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        veces: metricReference === 'service' ? (feature.properties.veces_servicio || 0) : (feature.properties.veces || 0),
      },
    })),
  }), [terrView, metricReference])
  const terrLabels = useMemo(() => (terrView ? toLabelFC(terrView) : null), [terrView])
  const manzLabels = useMemo(() => (manzView ? toLabelFC(manzView) : null), [manzView])

  // Manzanas desactivadas de todos los territorios. Si el link trae ?m=,
  // esa vista explícita reemplaza la configuración guardada solo para el
  // territorio seleccionado.
  const tachadasFC = useMemo(() => {
    if (!manzView || mode === 'metrica') return null
    let tachadoExplicito = false
    try { tachadoExplicito = new URL(window.location.href).searchParams.has('m') } catch { /* usar configuración */ }
    const features = manzView.features.filter((feature) => {
      const p = feature.properties
      if (mode === 'campana' && p.campania !== true) return false
      const numero = String(p.manzana)
      if (tachadoExplicito && p.territorio === selected) return (tachadas || []).includes(numero)
      if (!Array.isArray(p.manzanas_activas)) return false
      return !p.manzanas_activas.map(String).includes(numero)
    })
    return features.length ? { type: 'FeatureCollection', features } : null
  }, [manzView, mode, selected, tachadas])

  // diagonales (la "X") de las manzanas tachadas: ocupan la manzana completa
  const tachXFC = useMemo(() => {
    if (!tachadasFC) return null
    const feats = []
    for (const f of tachadasFC.features) {
      // diagonales usando los vértices reales de la manzana (respeta la rotación)
      const g = f.geometry
      const rings = g.type === 'Polygon' ? [g.coordinates[0]]
        : g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : []
      for (const ring of rings) {
        const x = obbDiagonals(ring, 0.86)
        if (x) feats.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: x } })
      }
    }
    return { type: 'FeatureCollection', features: feats }
  }, [tachadasFC])
  const ready = useRef({ data: false, map: false, time: false, done: false })
  const deepLinkDone = useRef(false)
  const publicConfigLoaded = useRef(false)

  const tachadasDeConfig = useCallback((territorio, activas) => {
    if (!manz || !Array.isArray(activas)) return null
    const activasSet = new Set(activas.map(String))
    return [...new Set(manz.features
      .filter((feature) => feature.properties.territorio === territorio)
      .map((feature) => String(feature.properties.manzana)))]
      .filter((numero) => !activasSet.has(numero))
  }, [manz])

  useEffect(() => {
    try {
      localStorage.setItem('app-v2-theme', theme)
      document.documentElement.dataset.appTheme = theme
    } catch { /* preferencia opcional */ }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('metric-reference', metricReference) } catch { /* preferencia opcional */ }
  }, [metricReference])

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
    if (adminPreview) return undefined
    let revision = 0
    return observeAuth(async (user) => {
      const current = ++revision
      const allowed = user ? await isAuthorizedAdmin(user) : false
      if (current === revision) setAdminUser(allowed ? user : null)
    })
  }, [adminPreview])

  useEffect(() => subscribePublicState(({ summaries, campaignMode, metricsVisible: showMetrics }) => {
    setPublicSummaries(summaries)
    setCampModoOn(campaignMode)
    setMetricsVisibleState(showMetrics)
    setPublicConfigReady(true)
    if (!publicConfigLoaded.current) {
      publicConfigLoaded.current = true
      setMode(campaignMode ? 'campana' : 'mapa')
    } else {
      setMode((m) => (m === 'campana' && !campaignMode ? 'mapa' : m))
    }
  }, (error) => console.error('Firebase público:', error)), [])

  useEffect(() => {
    if (!adminUser) { setRegistroBase([]); return undefined }
    if (adminPreview) return undefined
    return subscribeRecords((records) => {
      setRegistroBase(records)
      ensurePublicMapSummary(records).catch((error) => console.error('Actualización de resúmenes públicos:', error))
    }, (error) => {
      console.error(error)
      setAdminSyncError('No se pudieron sincronizar los registros privados.')
    })
  }, [adminUser, adminPreview])

  useEffect(() => {
    if (!adminOn && !metricsVisible && mode === 'metrica') setMode('mapa')
  }, [adminOn, metricsVisible, mode])

  useEffect(() => {
    const r = () => mapRef.current && mapRef.current.resize()
    window.addEventListener('resize', r)
    const t = setTimeout(r, 300)
    return () => { window.removeEventListener('resize', r); clearTimeout(t) }
  }, [])
  useEffect(() => { if (!splash && mapRef.current) mapRef.current.resize() }, [splash])
  useEffect(() => { if (import.meta.env.DEV && mapRef.current) window.__map = mapRef.current.getMap() })

  // online -> MapTiler (igual que siempre); offline -> base local PMTiles (fallback)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const fitAll = useCallback(() => {
    if (!terr || !mapRef.current) return
    const { bounds, center } = mainClusterFocus(terr.features)
    mapRef.current.fitBounds(bounds, { padding: 24, duration: 0 })
    mapRef.current.jumpTo({ center })   // el bbox no queda parejo -> recentrar en el promedio real
    mapRef.current.zoomTo(mapRef.current.getZoom() + 0.35, { duration: 0 })
  }, [terr])

  useEffect(() => { fitAll() }, [terr, fitAll])

  // refleja el territorio activo en la URL (?t=T52) sin recargar -> permite compartir
  const setUrlTerr = (id, manzanas) => {
    try {
      const u = new URL(window.location.href)
      if (id) u.searchParams.set('t', id); else u.searchParams.delete('t')
      // ?m solo sobrevive si sigue vigente el tachado que vino por URL
      if (manzanas && manzanas.length) u.searchParams.set('m', manzanas.join(','))
      else u.searchParams.delete('m')
      window.history.replaceState(null, '', u)
    } catch (e) {}
  }

  // selecciona un territorio (usado por click en mapa, buscador y deep-link)
  const selectTerr = useCallback((id, opts = {}) => {
    const feat = terrView && terrView.features.find(x => x.properties.territorio === id)
    if (!feat) return
    setSelected(id)
    setPopup({ ...feat.properties })
    const hasExplicitTachado = Object.prototype.hasOwnProperty.call(opts, 'tachadas')
    const tach = hasExplicitTachado
      ? (opts.tachadas && opts.tachadas.length ? opts.tachadas : null)
      : tachadasDeConfig(id, feat.properties.manzanas_activas)
    setTachadas(tach)
    // ?m se conserva únicamente para links explícitos; la configuración normal vive en Firebase.
    setUrlTerr(id, hasExplicitTachado ? tach : null)
    const cam = { padding: { top: 140, bottom: 70, left: 40, right: 40 }, maxZoom: 16.5, duration: 650 }
    if (opts.tilt) { cam.pitch = 38; cam.bearing = -16; cam.duration = 950 }  // vista 3D leve (deep-link)
    if (mapRef.current) mapRef.current.fitBounds(bboxOf(feat.geometry), cam)
  }, [terrView, tachadasDeConfig])

  // Si un administrador guarda la configuración del territorio que está abierto,
  // reflejarla en el mapa sin obligar a cerrar y volver a seleccionar. Un ?m=
  // explícito sigue teniendo prioridad porque representa una vista compartida.
  useEffect(() => {
    if (!selected || !terrView) return
    try {
      if (new URL(window.location.href).searchParams.has('m')) return
    } catch { /* continuar con la configuración persistida */ }
    const feat = terrView.features.find((item) => item.properties.territorio === selected)
    if (!feat) return
    setPopup({ ...feat.properties })
    setTachadas(tachadasDeConfig(selected, feat.properties.manzanas_activas))
  }, [selected, terrView, tachadasDeConfig])

  const clearTerr = useCallback(() => {
    setSelected(null); setPopup(null); setTachadas(null); setUrlTerr(null)
  }, [])

  const onClick = useCallback((e) => {
    const f = e.features && e.features[0]
    if (!f) { clearTerr(); return }
    selectTerr(f.properties.territorio)
  }, [selectTerr, clearTerr])

  // deep-link: cuando mapa Y datos están listos, si la URL trae ?t=T52 abrir ese
  // territorio (después del fitAll inicial, para que el zoom no se pise)
  useEffect(() => {
    if (!terr || !publicConfigReady || deepLinkDone.current) return
    let id, tachadas, feat
    try {
      const q = new URL(window.location.href).searchParams
      id = q.get('t')
      feat = terr.features.find(f => f.properties.territorio === id)
      if (!id || !feat) return
      // ?m=1,3,4 -> tachar esas manzanas del territorio (solo al entrar por URL)
      const m = q.get('m')
      tachadas = m == null ? undefined : m.split(',').map(s => s.trim()).filter(Boolean)
    } catch (e) { return }
    // esperar a que el mapa exista y esté listo, para que el fitAll inicial no pise el zoom.
    // La marca se pone al disparar (no antes), si no StrictMode aborta el reintento.
    let ticks = 0
    const iv = setInterval(() => {
      if (deepLinkDone.current) { clearInterval(iv); return }
      ticks++
      const map = mapRef.current && mapRef.current.getMap()
      if (!map) return
      // esperar a que cargue de verdad (~3s de margen para redes lentas); si no,
      // algún pane raro nunca resuelve isStyleLoaded() y hay que igual disparar
      if (!mapLoaded && !map.isStyleLoaded() && ticks < 25) return
      clearInterval(iv)
      deepLinkDone.current = true
      // Resolver la vista después de recibir la configuración pública evita
      // que un link directo quede en Mapa por una carrera con Firebase.
      setMode(campModoOn ? 'campana' : 'mapa')
      selectTerr(id, tachadas === undefined ? { tilt: true } : { tilt: true, tachadas })
    }, 120)
    const stop = setTimeout(() => clearInterval(iv), 15000)
    return () => { clearInterval(iv); clearTimeout(stop) }
  }, [terr, mapLoaded, publicConfigReady, campModoOn, selectTerr])

  // compartir el territorio activo por WhatsApp con link directo
  const shareTerr = useCallback(() => {
    if (!popup) return
    const url = `${location.origin}${location.pathname}?t=${popup.territorio}`
    const text = `Territorio ${popup.territorio} (${popup.zona}) — Congregación Este, SF\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [popup])

  // acceso directo al registro de ESTE territorio desde su ficha -> si no
  // hay sesión admin, pide login primero (el filtro queda listo para cuando entre)
  const abrirRegistroDe = useCallback((territorio) => {
    setAdminInitialQuery(territorio.replace(/\D/g, ''))
    if (adminOn) setShowAdminPanel(true)
    else setShowLogin(true)
  }, [adminOn])

  // calles limítrofes: al seleccionar (y cuando el mapa quedó quieto), leer las
  // etiquetas de calle ya renderizadas y rotular cada lado del territorio
  useEffect(() => {
    const map = mapRef.current && mapRef.current.getMap ? mapRef.current.getMap() : null
    if (!map || !selected || !terr || !online) { setBordeCalles(null); return }
    const feat = terr.features.find((f) => f.properties.territorio === selected)
    if (!feat) { setBordeCalles(null); return }
    let cancelled = false
    const compute = () => {
      if (cancelled) return
      // fuente vector del mapa base (MapTiler); leemos la geometría de calles con
      // nombre directo del tile (no depende de que el label esté dibujado)
      let srcId = 'maptiler_planet'
      try {
        const nl = map.getStyle().layers.find((l) => l['source-layer'] === 'transportation_name')
        if (nl && nl.source) srcId = nl.source
      } catch (e) {}
      let roads = []
      try { roads = map.querySourceFeatures(srcId, { sourceLayer: 'transportation_name' }) } catch (e) {}
      const fc = bordeConCalles(feat.geometry, roads)
      if (!cancelled) setBordeCalles(fc)
    }
    map.once('idle', compute)
    return () => { cancelled = true; map.off('idle', compute) }
  }, [selected, terr, mapLoaded, online])

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

  const isMet = mode === 'metrica'
  const isCamp = mode === 'campana'
  // Paleta dorada para Mapa, Métrica y Campaña. "hecho" (verde) es un
  // matiz exclusivo de Campaña: un territorio marcado C cuya pasada ya se
  // completó esta semana, para distinguirlo de lo recién asignado ("activo").
  // El territorio SELECCIONADO es un solo feature -> alcanza con mirar su
  // estado en JS; los territorios sin seleccionar se pintan todos juntos ->
  // esos necesitan una expresión de MapLibre que lea la propiedad por feature.
  const c = COLORS
  const ch = COLORS_HECHO
  const selFeat = isCamp && selected && terrView ? terrView.features.find(f => f.properties.territorio === selected) : null
  const selHecho = !!(selFeat && selFeat.properties.campania_hecho)
  const sel = selected || '__none__'
  const manzBorder = 'rgba(138,106,18,.45)'
  const highlight = isCamp && selHecho ? ch.stroke : c.stroke
  const lblTxt = '#0f1520'
  const lblHalo = 'rgba(255,255,255,.95)'
  // nro de territorio: un solo tono (calle-borde-label, solo el seleccionado) y
  // una expresión por feature (terr-label/-near, se ven todos los marcados juntos)
  const terrLblColorPlain = isCamp && selHecho ? ch.label : c.label
  const terrLblColorExpr = isCamp
    ? ['case', ['==', ['get', 'campania_hecho'], true], ch.label, c.label]
    : c.label

  // --- capa TERRITORIO (unión) ---
  // MODO CAMPAÑA: solo se dibujan los territorios marcados (property campania)
  const campFilter = ['==', ['get', 'campania'], true]
  // dorado (activo) o verde (hecho) por feature -> se ven varios territorios
  // marcados a la vez, cada uno con su propio estado
  const campFillExpr = ['case', ['==', ['get', 'campania_hecho'], true], ch.fill, c.fill]
  const campStrokeExpr = ['case', ['==', ['get', 'campania_hecho'], true], ch.stroke, c.stroke]
  const normalFillExpr = ['case', ['==', ['get', 'activo'], true], '#e6b52f', c.fill]
  const normalFillOpacityExpr = ['case', ['==', ['get', 'activo'], true], 0.32, c.fillOpacity]
  const normalStrokeExpr = ['case', ['==', ['get', 'activo'], true], '#ed7100', c.stroke]
  const normalStrokeWidthExpr = ['case', ['==', ['get', 'activo'], true], 3, c.coreWidth]
  const terrFill = {
    id: 'terr-fill', type: 'fill',
    ...(isCamp ? { filter: campFilter } : {}),
    paint: {
      'fill-color': isMet ? metricFillExpr() : (isCamp ? campFillExpr : normalFillExpr),
      'fill-opacity': isMet ? 0.7 : (isCamp ? c.fillOpacity : normalFillOpacityExpr),
    },
  }
  const glowBase = (!isMet && c.neon) ? 0.6 : 0
  const terrGlow = {
    id: 'terr-glow', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' },
    ...(isCamp ? { filter: campFilter } : {}),
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
    ...(isCamp ? { filter: campFilter } : {}),
    paint: {
      'line-color': isMet ? 'rgba(20,30,60,.5)' : (isCamp ? campStrokeExpr : normalStrokeExpr),
      'line-width': isMet ? 1.2 : (isCamp ? c.coreWidth : normalStrokeWidthExpr),
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
    ...(isCamp ? { filter: campFilter } : {}),
    layout: { 'text-field': ['get', 'territorio'], 'text-font': ['Noto Sans Bold'], 'text-size': 15 },
    paint: { 'text-color': terrLblColorExpr, 'text-halo-color': lblHalo, 'text-halo-width': 2.4 },
  }
  // cerca (zoom manzanas): SIEMPRE visible + no bloquea los nros de manzana
  const terrLabelNear = {
    id: 'terr-label-near', type: 'symbol', minzoom: 15,
    ...(isCamp ? { filter: campFilter } : {}),
    layout: {
      'text-field': ['get', 'territorio'], 'text-font': ['Noto Sans Bold'], 'text-size': 18,
      'text-allow-overlap': true,          // el nro de territorio siempre se ve
      'text-ignore-placement': false,      // pero reserva su lugar -> las manzanas lo esquivan
      'text-padding': 6,
    },
    paint: { 'text-color': terrLblColorExpr, 'text-halo-color': lblHalo, 'text-halo-width': 4.6, 'text-halo-blur': 0.2 },
  }
  // --- calles limítrofes (label sobre cada lado del contorno; solo el seleccionado) ---
  const calleLabel = {
    id: 'calle-borde-label', type: 'symbol',
    layout: {
      'symbol-placement': 'line-center',    // una sola etiqueta, centrada en el lado
      'text-field': ['get', 'calle'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 14,
      'text-allow-overlap': true, 'text-ignore-placement': true,
      'text-letter-spacing': 0.02,
    },
    paint: { 'text-color': terrLblColorPlain, 'text-halo-color': lblHalo, 'text-halo-width': 3 },
  }

  // --- capa MANZANAS ---
  const manzFillSel = {
    id: 'manz-fill-sel', type: 'fill', filter: ['==', ['get', 'territorio'], sel],
    paint: { 'fill-color': isCamp && selHecho ? ch.fill : c.fill, 'fill-opacity': 0.16 },
  }
  const manzLine = {
    id: 'manz-line', type: 'line',
    // en Campaña, las manzanas de territorios no marcados tampoco se dibujan
    ...(isCamp ? { filter: campFilter } : {}),
    paint: {
      'line-color': manzBorder,
      'line-width': 0.8,
      // aparecen al acercar (~nivel calles)
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.9],
    },
  }
  const manzLineSel = {
    id: 'manz-line-sel', type: 'line', filter: ['==', ['get', 'territorio'], sel],
    paint: { 'line-color': isCamp && selHecho ? ch.stroke : c.stroke, 'line-width': 1.4, 'line-opacity': 1 },
  }
  const tachFill = {
    id: 'manz-tach-fill', type: 'fill',
    paint: { 'fill-color': '#d32f2f', 'fill-opacity': 0.34 },
  }
  const tachLine = {
    id: 'manz-tach-line', type: 'line',
    paint: { 'line-color': '#b71c1c', 'line-width': 1.6, 'line-opacity': 0.9 },
  }
  // la X ocupa la manzana entera (diagonales dibujadas como líneas)
  const tachXHalo = {
    id: 'manz-tach-x-halo', type: 'line',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': 'rgba(255,255,255,.8)',
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 8],
    },
  }
  const tachXLine = {
    id: 'manz-tach-x', type: 'line',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': '#e02020',
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.2, 17, 5],
    },
  }

  const manzLabel = {
    id: 'manz-label', type: 'symbol', minzoom: 15,
    // con un territorio seleccionado, ocultar los números de manzana del resto (solo se ve el seleccionado);
    // en Campaña, sin selección, solo se numeran las manzanas de territorios marcados
    filter: selected ? ['==', ['get', 'territorio'], ' __none__']
      : (isCamp ? ['all', ['has', 'territorio'], campFilter] : ['has', 'territorio']),
    layout: {
      'text-field': ['get', 'manzana'], 'text-font': ['Noto Sans Bold'], 'text-size': 15,
      'text-allow-overlap': false,
      // si choca (ej. con el nro de territorio) se corre a un costado en vez de ocultarse
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      'text-radial-offset': 1.2, 'text-justify': 'auto',
    },
    paint: { 'text-color': lblTxt, 'text-halo-color': lblHalo, 'text-halo-width': 2.4 },
  }
  const manzLabelSel = {
    id: 'manz-label-sel', type: 'symbol', filter: ['==', ['get', 'territorio'], sel],
    layout: {
      'text-field': ['get', 'manzana'], 'text-font': ['Noto Sans Bold'], 'text-size': 16,
      'text-allow-overlap': false,
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      'text-radial-offset': 1.2, 'text-justify': 'auto',
    },
    paint: { 'text-color': lblTxt, 'text-halo-color': lblHalo, 'text-halo-width': 2.6 },
  }

  return (
    <div className={`app app-v2 theme-${theme}` + (popup ? ' has-popup' : '') + (isMet ? ' mode-metric' : '')}>
      <Map
        ref={mapRef}
        mapStyle={online ? MAP_STYLE : offlineStyle()}
        initialViewState={{ longitude: -62.03, latitude: -31.43, zoom: 12, pitch: 0, bearing: 0 }}
        interactiveLayerIds={['terr-fill']}
        onClick={onClick}
        onLoad={() => {
          if (mapRef.current) { mapRef.current.resize(); if (import.meta.env.DEV) window.__map = mapRef.current.getMap() }
          // si la URL trae ?t=... el encuadre lo hace el deep-link: si este fitAll
          // corre después (mapa lento), le pisaba la cámara ya posicionada
          let hasDeepLink = false
          try { hasDeepLink = !!new URL(window.location.href).searchParams.get('t') } catch (e) {}
          if (!hasDeepLink) fitAll()
          ready.current.map = true; setMapLoaded(true); hideSplash()
        }}
        minZoom={12}
        maxZoom={20}
        maxPitch={40}
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
        {terrView && (
          <Source id="terr" type="geojson" data={isMet ? metricTerrView : terrView}>
            <Layer {...terrFill} />
            <Layer {...terrGlow} />
            <Layer {...terrLine} />
            <Layer {...terrSel} />
          </Source>
        )}
        {manzView && (
          <Source id="manz" type="geojson" data={manzView}>
            <Layer {...manzFillSel} />
            <Layer {...manzLine} />
            <Layer {...manzLineSel} />
          </Source>
        )}
        {/* Montar primero la referencia de orden; los tachados se insertan
            debajo de estas etiquetas aunque sus fuentes aparezcan después. */}
        {terrLabels && (
          <Source id="terr-lbl" type="geojson" data={terrLabels}>
            <Layer {...terrLabelFar} />
            <Layer {...terrLabelNear} />
          </Source>
        )}
        {tachadasFC && (
          <Source id="manz-tach-src" type="geojson" data={tachadasFC}>
            <Layer {...tachFill} beforeId="terr-label" />
            <Layer {...tachLine} beforeId="terr-label" />
          </Source>
        )}
        {tachXFC && (
          <Source id="manz-tach-x-src" type="geojson" data={tachXFC}>
            {/* beforeId: la fuente se monta después que los labels, así que hay que
                insertarla explícitamente debajo para no taparlos */}
            <Layer {...tachXHalo} beforeId="terr-label" />
            <Layer {...tachXLine} beforeId="terr-label" />
          </Source>
        )}
        {manzLabels && (
          <Source id="manz-lbl" type="geojson" data={manzLabels}>
            <Layer {...manzLabel} />
            <Layer {...manzLabelSel} />
          </Source>
        )}
        {bordeCalles && bordeCalles.features.length > 0 && (
          <Source id="calles-borde" type="geojson" data={bordeCalles}>
            <Layer {...calleLabel} />
          </Source>
        )}
      </Map>

      <div className="topbar">
        <span className="topbar-brandmark"><img src="logo-furgon.png" className="logo" alt="" /></span>
        <span className="topbar-copy">
          <h1>Territorios</h1>
          <small>Congregación Este · San Francisco</small>
        </span>
        <span className={`topbar-status${online ? '' : ' offline'}`}><i />{online ? 'Sincronizado' : 'Sin conexión'}</span>
        <button className="topbar-theme" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>{theme === 'dark' ? '☀' : '☾'}</button>
      </div>
      {isCamp && (
        <div className="camp-legend">
          <span><i className="dot-activo" />Activo</span>
          <span><i className="dot-hecho" />Hecho</span>
        </div>
      )}

      {geoError && <div className="toast">{geoError}</div>}

      {popup && !isMet && (
        <div className="info-card">
          <div className="info-card-head">
            <div>
              <span className="info-eyebrow">Territorio seleccionado</span>
              <div className="info-t"><b>{popup.territorio}</b><span>{popup.zona}</span></div>
            </div>
            <button className="info-close" onClick={clearTerr} aria-label="Cerrar">×</button>
          </div>
          <span className={`info-status${popup.activo ? ' active' : ''}`}><i />Activo</span>
          <div className="info-summary">
            <div><span>Año de servicio</span><b>{popup.veces_servicio || 0} {(popup.veces_servicio || 0) === 1 ? 'vez' : 'veces'}</b></div>
            <div><span>Total histórico</span><b>{popup.veces || 0} {popup.veces === 1 ? 'vez' : 'veces'}</b></div>
            <div><span>Última visita</span><b>{popup.ultima_fmt || 'Sin registro'}</b></div>
            {popup.dias_desde != null && <div><span>Antigüedad</span><b>{popup.dias_desde} días</b></div>}
          </div>
          <div className="info-actions">
            <button className="info-registro" onClick={() => abrirRegistroDe(popup.territorio)}><IconList /><span>Editar registro</span></button>
            <button className="info-share" onClick={shareTerr}><IconWhatsapp /><span>Compartir</span></button>
          </div>
        </div>
      )}

      {/* en Campaña el buscador solo encuentra los territorios marcados (los únicos visibles) */}
      {!isMet && <Buscador
        data={isCamp && terrView ? { ...terrView, features: terrView.features.filter(f => f.properties.campania) } : terrView}
        onPick={selectTerr}
      />}

      {isMet && <MetricaPanel data={metricTerrView} meta={meta} selected={popup} reference={metricReference} onReferenceChange={setMetricReference} onClearSelected={clearTerr} />}

      <nav className="footer">
        {/* si el admin apaga "modo campaña" esta vista desaparece para todos */}
        {campModoOn && (
          <button className={!showGuide && isCamp ? 'on' : ''} onClick={() => { setShowGuide(false); setMode('campana') }}>
            <IconPath /><span>Campaña</span>
          </button>
        )}
        <button className={!showGuide && mode === 'mapa' ? 'on' : ''} onClick={() => { setShowGuide(false); setMode('mapa') }}>
          <IconMap /><span>Mapa</span>
        </button>
        {(adminOn || metricsVisible) && <button className={!showGuide && isMet ? 'on' : ''} onClick={() => { setShowGuide(false); setMode('metrica'); setTimeout(fitAll, 0) }}>
          <IconChart /><span>Métrica</span>
        </button>}
        <button className={showGuide ? 'on' : ''} onClick={() => setShowGuide(true)}>
          <IconGuide /><span>Guía</span>
        </button>
        <button className={showAdminPanel ? 'on' : ''} onClick={() => { setShowGuide(false); adminOn ? setShowAdminPanel(true) : setShowLogin(true) }}>
          <IconAdmin /><span>Admin</span>
        </button>
      </nav>

      {showGuide && <PublicGuide campaignVisible={campModoOn} metricsVisible={metricsVisible} adminVisible={adminOn} onClose={() => setShowGuide(false)} />}

      {showLogin && (
        <AdminLogin
          onClose={() => setShowLogin(false)}
          onSuccess={(user) => { setAdminUser(user); setShowLogin(false); setShowAdminPanel(true) }}
        />
      )}

      {showAdminPanel && (
        <AdminPanel
          data={terrView}
          manzanas={manzView}
          registroBase={registroBase}
          onSave={saveRecordChanges}
          onClose={() => setShowAdminPanel(false)}
          onLogout={async () => { await logoutFirebase(); setAdminUser(null); setShowAdminPanel(false) }}
          campModoOn={campModoOn}
          onCampModoChange={setCampaignMode}
          metricsVisible={metricsVisible}
          onMetricsVisibleChange={setMetricsVisible}
          initialQuery={adminInitialQuery}
          syncError={adminSyncError}
          currentEmail={adminUser.email || ''}
          theme={theme}
          onThemeToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
          preview={adminPreview}
        />
      )}

      {splash && <Splash out={splashOut} />}
    </div>
  )
}
