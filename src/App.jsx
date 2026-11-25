import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import Map, { Source, Layer, Marker, NavigationControl, GeolocateControl, useControl } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { Protocol, PMTiles } from 'pmtiles'
import {OfflineArchiveSource} from './offlineArchive.js'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE, MAP_STYLE_DARK, COLORS, COLORS_HECHO, MAP_COLORS, MAPTILER_KEY, metricFillExpr, offlineStyle } from './theme.js'
import {mapAppearance} from './mapAppearance.js'
import {useMapConnection} from './useMapConnection.js'
import BuildingPlaces from './BuildingPlaces.jsx'
import TerritoryReflection from './TerritoryReflection.jsx'
import TerritoryBadges from './TerritoryBadges.jsx'
import {territorySelection,territorySelectionFilter} from './territorySelection.js'
import MarkerAnimationControl from './MarkerAnimationControl.jsx'
import InitialMapReady from './InitialMapReady.jsx'
import {MAP_NAVIGATION_BOUNDS} from './mapBounds.js'
import {startupReady,splashRemaining} from './startupReady.js'
import AdminPanelLoader from './AdminPanelLoader.jsx'
import {metricHistoryStart} from './metricFrequency.js'
import TerritoryDetails from './TerritoryDetails.jsx'
import TerritoryStats from './TerritoryStats.jsx'
import {crossedBlocks,crossedBlockLayers} from './crossedBlocks.js'
import MetricaPanel from './MetricaPanel.jsx'
import './game-preview.css'
import { configureDistrictPreview, districtLandmarks } from './districtPreview.js'
import { pickBuildingPolygon } from './buildingReference.js'
import Splash from './Splash.jsx'
import {readStartupSplashType,rememberSplashType} from './splashType.js'
import Buscador from './Buscador.jsx'
import PublicProgram from './PublicProgram.jsx'
import {territoryProgramSchedule} from './assignmentSearch.js'
import {formatProgramDate} from './programDates.js'
import {applyDocumentTheme} from './documentTheme.js'
import {firebaseWritesBlocked} from './firebase.js'
import {isAssignmentToday} from './programDates.js'
import {guideDemoProgram,guideDemoSummaries} from './guideDemo.js'
import { bordeConCalles, callesDelMapa, mergeTerritoryStreetLabels } from './calles.js'
import { IconPath, IconAdmin, IconWhatsapp, IconList } from './icons.jsx'
import FooterIcon from './FooterIcon.jsx'
import AdminLogin from './AdminLogin.jsx'
import { validPinCoordinates, assignmentColorsByTerritory, assignmentDay, layoutAssignmentPosts, applyAssignmentColors, visibleMapAssignments, buildPublicProgramAssignments, assignmentTerritories } from './programAssignments.js'
import {
  applyPublicSummaries, ensurePublicMapSummary, isAuthorizedAdmin, logoutFirebase, observeAuth,
  readPublicMetricSnapshot,
  saveAssignmentPosition, saveRecordChanges, setCampaignMode, setMetricsVisible, setProgramWeekStart, setSplashType, subscribePublicState, subscribeRecords,
} from './firebaseData.js'

const PublicGuide = lazy(() => import('./PublicGuide.jsx'))
const AdminPanel = AdminPanelLoader
const panelLoading = <div className="toast" role="status">Cargando sección…</div>

// protocolo pmtiles (para el mapa base offline). Se registra una sola vez.
if (typeof window !== 'undefined' && !window.__pmtilesReg) {
  const protocol=new Protocol()
  protocol.add(new PMTiles(new OfflineArchiveSource(new URL('zona.pmtiles',window.location.href).href)))
  maplibregl.addProtocol('pmtiles', protocol.tile)
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

function PinMapControl({ active, onToggle, edit = false }) {
  const control = useControl(() => {
    const container = document.createElement('div')
    container.className = `maplibregl-ctrl maplibregl-ctrl-group pin-map-control ${edit ? 'pin-edit-control' : 'pin-visibility-control'}`
    const button = document.createElement('button')
    button.type = 'button'
    button.innerHTML = edit
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="pin-visibility-slash" d="m3 3 18 18"/></svg>'
    container.appendChild(button)
    return { button, onAdd: () => container, onRemove: () => container.remove() }
  }, { position: 'top-right' })
  useEffect(() => {
    control.button.onclick = onToggle
    control.button.setAttribute('aria-pressed', String(active))
    const label = edit ? (active ? 'Desactivar edición de pines' : 'Activar edición de pines') : (active ? 'Ocultar pines e iconos' : 'Mostrar pines e iconos')
    control.button.setAttribute('aria-label', label)
    control.button.title = edit && active ? 'Edición activa: arrastrá un pin' : label
    control.button.classList.toggle('is-active', edit && active)
    control.button.classList.toggle('is-hidden', !edit && !active)
    const slash = control.button.querySelector('.pin-visibility-slash')
    if (slash) slash.style.display = active ? 'none' : ''
    return () => { control.button.onclick = null }
  }, [control, active, onToggle, edit])
  return null
}

export default function App({previewDesign=false, designUI=false, ProgramView=PublicProgram}) {
  const designPreview = import.meta.env.DEV && previewDesign
  const redesigned = designUI || designPreview
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('app-v2-theme')
      return saved === 'dark' ? 'dark' : 'light'
    } catch { return 'light' }
  })
  const [campModoOn, setCampModoOn] = useState(false)
  const [metricsVisible, setMetricsVisibleState] = useState(true)
  const [programWeekStart, setProgramWeekStartState] = useState(0)
  const [splashType,setSplashTypeState]=useState(()=>readStartupSplashType())
  const startupSplashType=useRef(null)
  const [programAssignments, setProgramAssignments] = useState([])
  const [currentAssignmentDay, setCurrentAssignmentDay] = useState(assignmentDay)
  useEffect(() => {
    const update = () => setCurrentAssignmentDay(assignmentDay())
    const interval = setInterval(update, 60000)
    window.addEventListener('focus', update)
    return () => { clearInterval(interval); window.removeEventListener('focus', update) }
  }, [])
  const [pinEdits, setPinEdits] = useState({})
  const [pinEditing, setPinEditing] = useState(false)
  const [pinsVisible, setPinsVisible] = useState(true)
  const [pinSaving, setPinSaving] = useState(false)
  const [pinUndo, setPinUndo] = useState(null)
  const [pinUndoSeconds, setPinUndoSeconds] = useState(8)
  const [pinNotice, setPinNotice] = useState('')
  const pinNoticeTimer = useRef(null)
  const draggingPin = useRef(false)
  useEffect(() => () => clearTimeout(pinNoticeTimer.current), [])
  useEffect(() => {
    if (!pinUndo) return undefined
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((pinUndo.expiresAt - Date.now()) / 1000))
      setPinUndoSeconds(remaining)
      if (!remaining) { setPinUndo(null); setPinNotice('') }
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 250)
    return () => clearInterval(interval)
  }, [pinUndo])
  const [metricReference, setMetricReference] = useState(() => {
    try { return localStorage.getItem('metric-reference') === 'history' ? 'history' : 'service' } catch { return 'service' }
  })
  const [mode, setMode] = useState('mapa') // 'mapa' | 'metrica'
  const [campaignFilter, setCampaignFilter] = useState(false)
  const isCamp = mode === 'mapa' && campModoOn && campaignFilter
  useEffect(() => { setCampaignFilter(campModoOn) }, [campModoOn])
  const [terr, setTerr] = useState(null)
  const [manz, setManz] = useState(null)
  const [meta, setMeta] = useState(null)
  const [popup, setPopup] = useState(null)
  const [selected, setSelected] = useState(null)     // territorio id
  const [selectedTerritories,setSelectedTerritories]=useState([])
  const [tachadas, setTachadas] = useState(null)     // manzanas tachadas por URL o por configuración del registro activo
  const [geoError, setGeoError] = useState(null)
  const online=useMapConnection(MAP_STYLE)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapGeneration, setMapGeneration] = useState(0)
  const [bordeCalles, setBordeCalles] = useState(null)
  const [splash, setSplash] = useState(true)
  const [splashOut, setSplashOut] = useState(false)
  const splashFinishTimer=useRef(null)
  const splashFinishFrame=useRef(null)
  const splashStartedAt=useRef(performance.now())
  useEffect(()=>()=>{clearTimeout(splashFinishTimer.current);cancelAnimationFrame(splashFinishFrame.current)},[])
  const [startupSlow,setStartupSlow]=useState(false)
  const assignmentMarkers=useRef(new globalThis.Map())
  const localSandbox=firebaseWritesBlocked
  const adminPreview = designPreview || localSandbox || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('adminPreview'))
  const guidePreview = designPreview || localSandbox || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('guidePreview'))
  const gamePreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('gamePreview')
  const districtPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('districtPreview')
  const satellitePreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('satellitePreview')
  const [satellite, setSatellite] = useState(satellitePreview)
  const isSatellite = satellitePreview && satellite && online
  const buildingPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('buildingPreview')
  const [buildingInspect, setBuildingInspect] = useState(buildingPreview)
  const [inspectedBuilding, setInspectedBuilding] = useState(null)
  const [buildingCopyStatus, setBuildingCopyStatus] = useState('')
  const campaignGuidePreview = adminPreview && new URLSearchParams(window.location.search).has('campaignGuidePreview')
  const previewRecords = adminPreview ? [
    { id: 'preview-1', territorio: 'T18', inicio: '2026-09-18', fin: '2026-09-22', campania: true, manzanasActivas: null },
    { id: 'preview-2', territorio: 'T25', inicio: '2026-09-24', fin: null, campania: true, manzanasActivas: ['1', '3', '4'] },
    { id: 'preview-3', territorio: 'T31', inicio: '2026-09-15', fin: '2026-09-19', campania: false, manzanasActivas: null },
  ] : []
  const [adminUser, setAdminUser] = useState(() => adminPreview ? { email: 'preview@local.test' } : null)
  const [showLogin, setShowLogin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(adminPreview && !campaignGuidePreview && !designPreview && (!localSandbox||new URLSearchParams(window.location.search).has('adminPreview')))
  const [adminMinimized, setAdminMinimized] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showProgram,setShowProgram]=useState(() => {
    const params = new URLSearchParams(window.location.search)
    return !params.get('t') && (guidePreview || ![...params.keys()].some(key => key.endsWith('Preview')))
  })
  const [adminInitialQuery, setAdminInitialQuery] = useState('')
  const [adminRecordRequest,setAdminRecordRequest]=useState(null)
  const consumeAdminRecordRequest=useCallback(request=>{
    setAdminRecordRequest(current=>current===request?null:current)
  },[])
  const [registroBase, setRegistroBase] = useState(previewRecords)
  const [adminRecordsReady,setAdminRecordsReady]=useState(adminPreview)
  const [publicSummaries, setPublicSummaries] = useState({})
  const [publicConfigReady, setPublicConfigReady] = useState(false)
  const [adminSyncError, setAdminSyncError] = useState('')
  const mapRef = useRef(null)
  const themeCamera = useRef(null)
  const mapHasLoaded = useRef(false)
  const geoRef = useRef(null)
  const adminOn = !!adminUser && !campaignGuidePreview
  useEffect(() => { if (!adminOn) { setPinEditing(false); setPinUndo(null) } }, [adminOn])
  const terrView = useMemo(() => applyPublicSummaries(terr, publicSummaries), [terr, publicSummaries])
  const manzView = useMemo(() => applyPublicSummaries(manz, publicSummaries), [manz, publicSummaries])
  const metricTerrView = useMemo(() => !terrView ? null : ({
    ...terrView,
    features: terrView.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        veces: metricReference === 'service' ? (feature.properties.veces_servicio || 0) : (publicSummaries[feature.properties.territorio]?.veces || 0),
      },
    })),
  }), [terrView, metricReference, publicSummaries])
  const terrLabels = useMemo(() => (terrView ? toLabelFC(terrView) : null), [terrView])
  const manzLabels = useMemo(() => (manzView ? toLabelFC(manzView) : null), [manzView])
  const assignedPosts = useMemo(() => {
    if (!terrView) return []
    const palette = assignmentColorsByTerritory(programAssignments.filter(assignment => terrView.features.some(feature => feature.properties.territorio === assignment.territorio)))
    const posts = visibleMapAssignments(programAssignments).map((assignment, index) => {
      const feature = terrView.features.find((item) => item.properties.territorio === assignment.territorio)
      if (!feature) return null
      const id = assignment.id || `legacy-${assignment.territorio}-${index}`
      const done = isCamp && feature.properties.campania_hecho === true
      const color = done ? '#b3dec1' : palette[assignment.territorio].color
      const ink = done ? COLORS_HECHO.stroke : palette[assignment.territorio].ink
      const coordinates = pinEdits[id] || (validPinCoordinates(assignment.coordinates) ? assignment.coordinates : labelPoint(feature.geometry))
      return coordinates ? { ...assignment, id, coordinates, color, ink, campania: feature.properties.campania === true,
        group: assignment.group === true || /(?:^| - )G\d+/.test(assignment.label || '') } : null
    }).filter(Boolean)
    return layoutAssignmentPosts(posts,currentAssignmentDay)
  }, [terrView, programAssignments, pinEdits, isCamp,currentAssignmentDay])

  const assignmentTerrView = useMemo(() => {
    return applyAssignmentColors(terrView,assignedPosts)
  }, [terrView, assignedPosts])

  const moveAssignment = async (assignment, event) => {
    draggingPin.current = false
    if (pinSaving || !adminOn) return
    const coordinates = [event.lngLat.lng, event.lngLat.lat]
    setPinSaving(true)
    setPinUndo(null)
    setPinEdits(all => ({ ...all, [assignment.id]: coordinates }))
    setPinNotice('Guardando posición…')
    clearTimeout(pinNoticeTimer.current)
    try {
      if (!adminPreview) await saveAssignmentPosition(assignment, coordinates)
      setPinNotice(adminPreview ? 'Posición ajustada en esta vista de prueba' : 'Posición guardada para todos')
      setPinUndoSeconds(8)
      setPinUndo({ assignment, previousCoordinates: [...assignment.coordinates], savedCoordinates: coordinates, expiresAt: Date.now() + 8000 })
      pinNoticeTimer.current = setTimeout(() => { setPinNotice(''); setPinUndo(null) }, 8000)
    } catch (error) {
      setPinNotice(error.message || 'No se pudo guardar la posición')
      pinNoticeTimer.current = setTimeout(() => setPinNotice(''), 4500)
    } finally {
      if (!adminPreview) setPinEdits(all => { const next = { ...all }; delete next[assignment.id]; return next })
      setPinSaving(false)
    }
  }

  const undoPinMove = async () => {
    if (!pinUndo || pinSaving || !adminOn || Date.now() >= pinUndo.expiresAt) return
    const { assignment, previousCoordinates, savedCoordinates } = pinUndo
    clearTimeout(pinNoticeTimer.current)
    setPinSaving(true)
    setPinUndo(null)
    setPinNotice('Restaurando posición…')
    try {
      if (!adminPreview) await saveAssignmentPosition(assignment, previousCoordinates, { expectedCoordinates: savedCoordinates })
      setPinEdits(all => ({ ...all, [assignment.id]: previousCoordinates }))
      setPinNotice('Movimiento deshecho')
    } catch (error) {
      setPinNotice(error.message || 'No se pudo deshacer el movimiento')
    } finally {
      if (!adminPreview) setPinEdits(all => { const next = { ...all }; delete next[assignment.id]; return next })
      setPinSaving(false)
      pinNoticeTimer.current = setTimeout(() => setPinNotice(''), 4500)
    }
  }

  // Cerca se ven los tachados de todos; al seleccionar se conserva el detalle.
  // ?m= reemplaza solo la configuración del territorio seleccionado.
  const tachadasFC = useMemo(() => {
    let tachadoExplicito = false
    try { tachadoExplicito = new URL(window.location.href).searchParams.has('m') } catch { /* usar configuración */ }
    return crossedBlocks(manzView,{mode,selected,explicit:tachadoExplicito,excluded:tachadas||[]})
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
        if (x) feats.push({ type: 'Feature', properties: {...f.properties}, geometry: { type: 'MultiLineString', coordinates: x } })
      }
    }
    return { type: 'FeatureCollection', features: feats }
  }, [tachadasFC])
  const ready = useRef({ data: false, map: false, time: false, video: false, done: false })
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
    applyDocumentTheme(theme)
    try {
      localStorage.setItem('app-v2-theme', theme)
    } catch { /* preferencia opcional */ }
  }, [theme])

  useEffect(() => {
    const syncTheme = event => {
      if (event.key === 'app-v2-theme' || event.key === null) {
        setTheme(event.newValue === 'dark' ? 'dark' : 'light')
      }
    }
    window.addEventListener('storage', syncTheme)
    return () => window.removeEventListener('storage', syncTheme)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('metric-reference', metricReference) } catch { /* preferencia opcional */ }
  }, [metricReference])

  const hideSplash = useCallback(() => {
    const r = ready.current
    if (r.done) return
    if (startupReady(r,startupSplashType.current||'collage')) {
      r.done = true
      splashFinishTimer.current=setTimeout(()=>{
        setSplashOut(true)
        // Paint the completed bar before removing it, including on slow starts.
        splashFinishFrame.current=requestAnimationFrame(()=>{
          splashFinishFrame.current=requestAnimationFrame(()=>setSplash(false))
        })
      },splashRemaining(splashStartedAt.current,performance.now()))
    }
  }, [])
  const initialMapReady=useCallback(()=>{ready.current.map=true;hideSplash()},[hideSplash])
  const initialVideoReady=useCallback(()=>{ready.current.video=true;hideSplash()},[hideSplash])

  useEffect(() => {
    const fb = setTimeout(() => { if(!ready.current.done)setStartupSlow(true) },8000)
    return () => { clearTimeout(fb) }
  }, [hideSplash])

  useEffect(() => {
    const controller=new AbortController()
    const options={signal:controller.signal,cache:'no-cache'}
    Promise.all([
      fetch('territorios.geojson',options).then(r => r.json()),
      fetch('manzanas.geojson',options).then(r => r.json()),
    ]).then(([t, m]) => { setTerr(t); setManz(m); ready.current.data = true; hideSplash() })
      .catch(error=>{if(error.name!=='AbortError')console.error(error)})
    fetch('meta.json',options).then(r => r.json()).then(setMeta).catch(() => {})
    return()=>controller.abort()
  }, [hideSplash, online])

  useEffect(() => {
    if (adminPreview || guidePreview) return undefined
    let revision = 0
    return observeAuth(async (user) => {
      const current = ++revision
      const allowed = user ? await isAuthorizedAdmin(user) : false
      if (current === revision) setAdminUser(allowed ? user : null)
    })
  }, [adminPreview, guidePreview])

  useEffect(() => {
    // Captura de documentación: datos ficticios, sin suscripción ni escritura remota.
    if (guidePreview) {
      if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('realMetrics')) {
        let cancelled = false
        setMode('metrica'); setShowProgram(false); setMetricsVisibleState(true)
        readPublicMetricSnapshot().then(summaries => {
          if (cancelled) return
          setPublicSummaries(summaries)
          setPublicConfigReady(true)
          ready.current.publicConfig = true; hideSplash()
        }).catch(error => console.error('Copia de métricas reales:', error))
        return () => { cancelled = true }
      }
      setPublicSummaries(guideDemoSummaries())
      setProgramAssignments(buildPublicProgramAssignments(guideDemoProgram()))
      setCampModoOn(true); setMetricsVisibleState(false); setPublicConfigReady(true)
      ready.current.publicConfig = true; hideSplash()
      return undefined
    }
    if (campaignGuidePreview) {
      const done = new Set([18, 20, 22, 25, 28, 30, 35, 42])
      setPublicSummaries(Object.fromEntries(Array.from({ length: 65 }, (_, index) => {
        const n = index + 1
        return [`T${n}`, { veces: done.has(n) ? 1 : 0, vecesServicio: done.has(n) ? 1 : 0, campania: done.has(n), campaniaHecho: done.has(n), activo: [26, 27, 31].includes(n), primera: '2026-09-01', ultima: done.has(n) ? '2026-09-28' : null }]
      })))
      setProgramAssignments([[18, 'SAB - PM - G1'], [25, 'SAB - PM - G2'], [26, 'JUE - PM'], [27, 'VIE - AM'], [31, 'MAR - PM']].map(([n, label]) => ({ id: `example-${n}`, territorio: `T${n}`, label, group: label.includes('G'), coordinates: null })))
      setCampModoOn(true); setMetricsVisibleState(false); setPublicConfigReady(true); setMode('mapa')
      ready.current.publicConfig = true; hideSplash()
      return undefined
    }
    return subscribePublicState(({ summaries, campaignMode, metricsVisible: showMetrics, programAssignments: assignments, programWeekStart: weekStart, splashType: loadingType }) => {
    setPublicSummaries(summaries)
    setCampModoOn(campaignMode)
    setMetricsVisibleState(showMetrics)
    setProgramWeekStartState(weekStart)
    setSplashTypeState(loadingType)
    rememberSplashType(loadingType)
    if(startupSplashType.current===null)startupSplashType.current=loadingType
    setProgramAssignments(assignments)
    setPublicConfigReady(true)
    ready.current.publicConfig = true; hideSplash()
    if (!publicConfigLoaded.current) {
      publicConfigLoaded.current = true
      setMode('mapa')
    }
    }, (error) => console.error('Firebase público:', error))
  }, [campaignGuidePreview, guidePreview, hideSplash, online])

  useEffect(() => {
    if (!adminUser) { setRegistroBase([]); setAdminRecordsReady(false); return undefined }
    if (adminPreview) return undefined
    setAdminRecordsReady(false)
    return subscribeRecords((records) => {
      setRegistroBase(records)
      setAdminRecordsReady(true)
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

  const fitAll = useCallback(() => {
    if (!terr || !mapRef.current) return
    const { bounds, center } = mainClusterFocus(terr.features)
    mapRef.current.fitBounds(bounds, { padding: 24, duration: 0 })
    mapRef.current.jumpTo({ center })   // el bbox no queda parejo -> recentrar en el promedio real
    mapRef.current.zoomTo(mapRef.current.getZoom() + 0.35, { duration: 0 })
    if (gamePreview || districtPreview || satellitePreview) mapRef.current.jumpTo({ pitch: 55, bearing: -24 })
  }, [terr, gamePreview, districtPreview, satellitePreview])

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
    deepLinkDone.current=true
    const selection=territorySelection(terrView,id,opts.territories)
    setSelected(id)
    setSelectedTerritories(selection.map(feature=>feature.properties.territorio))
    setPopup({ ...feat.properties })
    const hasExplicitTachado = Object.prototype.hasOwnProperty.call(opts, 'tachadas')
    const tach = hasExplicitTachado
      ? (opts.tachadas && opts.tachadas.length ? opts.tachadas : null)
      : tachadasDeConfig(id, feat.properties.manzanas_activas)
    setTachadas(tach)
    // ?m se conserva únicamente para links explícitos; la configuración normal vive en Firebase.
    setUrlTerr(id, hasExplicitTachado ? tach : null)
    const cam = { padding: { top: 140, bottom: 70, left: 40, right: 40 }, maxZoom: 16.5, duration: 650 }
    if (redesigned) {
      cam.padding = window.matchMedia('(max-width: 720px)').matches
        ? {top:120,bottom:Math.min(380,window.innerHeight*.46),left:24,right:64}
        : {top:80,bottom:60,left:40,right:390}
    }
    if (opts.tilt) { cam.pitch = 38; cam.bearing = -16; cam.duration = 950 }  // vista 3D leve (deep-link)
    if (districtPreview) { cam.pitch = 55; cam.bearing = -24 }
    if (satellitePreview) { cam.pitch = 48; cam.bearing = -16 }
    if (mapRef.current) {
      const bounds=selection.map(feature=>bboxOf(feature.geometry))
      mapRef.current.fitBounds([[Math.min(...bounds.map(b=>b[0][0])),Math.min(...bounds.map(b=>b[0][1]))],[Math.max(...bounds.map(b=>b[1][0])),Math.max(...bounds.map(b=>b[1][1]))]],cam)
    }
  }, [terrView, tachadasDeConfig, districtPreview, satellitePreview, redesigned])

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
    setSelected(null); setSelectedTerritories([]); setPopup(null); setTachadas(null); setUrlTerr(null)
  }, [])

  const onClick = useCallback((e) => {
    if (buildingPreview && buildingInspect && mapRef.current) {
      const map = mapRef.current.getMap()
      const layers = map.getStyle().layers.filter(layer => /building/i.test(layer['source-layer'] || layer.id) && ['fill', 'fill-extrusion'].includes(layer.type)).map(layer => layer.id)
      const feature = layers.length ? map.queryRenderedFeatures(e.point, { layers }).find(f => ['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) : null
      setBuildingCopyStatus('')
      if (!feature) { setInspectedBuilding(null); setBuildingCopyStatus('No encontré un edificio en ese punto. Acercá el mapa y tocá su techo.'); return }
      const picked = pickBuildingPolygon(feature.geometry, [e.lngLat.lng,e.lngLat.lat])
      const coordinates = []
      const walk = value => { if (typeof value[0] === 'number') coordinates.push(value); else value.forEach(walk) }
      walk(picked.geometry.coordinates)
      const lngs = coordinates.map(p => p[0]), lats = coordinates.map(p => p[1])
      const bounds = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
      const rounded = n => Number(n.toFixed(7))
      const reference = { edificioId: feature.id ?? null, componente: picked.component, idAgrupado: picked.grouped, capa: feature.layer.id, fuente: feature.source, capaFuente: feature.sourceLayer, puntoTocado: { longitud: rounded(e.lngLat.lng), latitud: rounded(e.lngLat.lat) }, centroAproximado: { longitud: rounded((bounds[0] + bounds[2]) / 2), latitud: rounded((bounds[1] + bounds[3]) / 2) }, limites: bounds.map(rounded) }
      setInspectedBuilding({ reference, feature: { type: 'Feature', geometry: picked.geometry, properties: { height: Number(feature.properties?.render_height || feature.properties?.height) || 6 } } })
      return
    }
    const f = e.features && e.features[0]
    if (!f) { clearTerr(); return }
    selectTerr(f.properties.territorio)
  }, [selectTerr, clearTerr, buildingPreview, buildingInspect])

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
      setMode('mapa')
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
    setAdminRecordRequest({territorio})
    if (adminOn) { setAdminMinimized(false); setShowAdminPanel(true) }
    else setShowLogin(true)
  }, [adminOn])

  // calles limítrofes: al seleccionar (y cuando el mapa quedó quieto), leer las
  // etiquetas de calle ya renderizadas y rotular cada lado del territorio
  useEffect(() => {
    const map = mapRef.current && mapRef.current.getMap ? mapRef.current.getMap() : null
    if (!selected || !terr) { setBordeCalles(null); return }
    if (!map) return
    const feat = terr.features.find((f) => f.properties.territorio === selected)
    if (!feat) { setBordeCalles(null); return }
    let cancelled = false
    const compute = () => {
      if (cancelled) return
      // Both online and downloaded tiles contain named street geometry.
      const roads = callesDelMapa(map, online)
      const fc = bordeConCalles(feat.geometry, roads)
      // A theme change temporarily unloads the base tiles. Retain only this
      // territory's known labels until the replacement source is ready.
      if (!cancelled) setBordeCalles(previous=>mergeTerritoryStreetLabels(previous,fc,selected))
    }
    const sourceReady = event => {
      if(!event.isSourceLoaded)return
      const source=online
        ? map.getStyle()?.layers?.find(layer=>layer['source-layer']==='transportation_name')?.source||'maptiler_planet'
        : 'pm'
      if(event.sourceId===source)compute()
    }
    if(map.isStyleLoaded())compute()
    map.once('idle', compute)
    map.on('sourcedata', sourceReady)
    return () => { cancelled = true; map.off('idle', compute); map.off('sourcedata',sourceReady) }
  }, [selected, terr, mapLoaded, mapGeneration, online, theme])

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
  const multipleSelection=selectedTerritories.length>1
  const popupSchedule=territoryProgramSchedule(programAssignments,multipleSelection?selectedTerritories:popup?.territorio)
  const popupHistoricalStart = metricHistoryStart(terrView?.features.map(f=>f.properties)||[], meta?.historialDesde)
  // Paleta dorada para Mapa, Métrica y Campaña. "hecho" (verde) es un
  // matiz exclusivo de Campaña: un territorio marcado C cuya pasada ya se
  // completó esta semana, para distinguirlo de lo recién asignado ("activo").
  // El territorio SELECCIONADO es un solo feature -> alcanza con mirar su
  // estado en JS; los territorios sin seleccionar se pintan todos juntos ->
  // esos necesitan una expresión de MapLibre que lea la propiedad por feature.
  const appearance = mapAppearance(theme)
  const c = {...COLORS, stroke:appearance.stroke, label:appearance.label}
  const ch = appearance.dark ? {...COLORS_HECHO, stroke:'#76d69b', label:'#b8f0cc'} : COLORS_HECHO
  const cm = appearance.dark ? {...MAP_COLORS, fill:'#d2b574', fillOpacity:.16, stroke:'#b29e68', activeStroke:'#ffc16b'} : MAP_COLORS
  const selFeat = isCamp && selected && terrView ? terrView.features.find(f => f.properties.territorio === selected) : null
  const selHecho = !!(selFeat && selFeat.properties.campania_hecho)
  const selectionFilter=territorySelectionFilter(selectedTerritories)
  const manzBorder = appearance.blockBorder
  const selectedAssignment = assignedPosts.find(post => post.territorio === selected)
  const highlight = isCamp && selHecho ? ch.stroke : (!isMet && selectedAssignment ? (appearance.dark ? selectedAssignment.color : selectedAssignment.ink) : (isCamp ? appearance.neutralStroke : c.stroke))
  const lblTxt = appearance.blockLabel
  const lblHalo = appearance.labelHalo
  // nro de territorio: un solo tono (calle-borde-label, solo el seleccionado) y
  // una expresión por feature (terr-label/-near, se ven todos los marcados juntos)
  const terrLblColorPlain = isCamp && selHecho ? ch.label : c.label
  const terrLblColorExpr = isCamp
    ? ['case', ['==', ['get', 'campania_hecho'], true], ch.label, c.label]
    : c.label

  // --- capa TERRITORIO (unión) ---
  // Campaña muestra todos: verde para hechos; asignación semanal o base neutra para el resto.
  const campFilter = ['has', 'territorio']
  const campFillExpr = ['case', ['==', ['get', 'campania_hecho'], true], ch.fill, ['coalesce', ['get', 'assignmentColor'], appearance.neutralFill]]
  const assignmentBorder = appearance.dark ? 'assignmentColor' : 'assignmentInk'
  const campStrokeExpr = ['case', ['==', ['get', 'campania_hecho'], true], ch.stroke, ['coalesce', ['get', assignmentBorder], appearance.neutralStroke]]
  const normalFillExpr = ['case', ['==', ['get', 'activo'], true], cm.activeFill, cm.fill]
  const normalFillOpacityExpr = ['case', ['==', ['get', 'activo'], true], cm.activeFillOpacity, cm.fillOpacity]
  const normalStrokeExpr = ['case', ['==', ['get', 'activo'], true], cm.activeStroke, cm.stroke]
  const normalStrokeWidthExpr = ['case', ['==', ['get', 'activo'], true], 3, c.coreWidth]
  const terrFill = {
    id: 'terr-fill', type: 'fill',
    ...(isCamp ? { filter: campFilter } : {}),
    paint: {
      'fill-color': isMet ? metricFillExpr() : (isCamp ? campFillExpr : ['coalesce', ['get', 'assignmentColor'], normalFillExpr]),
      'fill-opacity': isSatellite ? (isMet ? .4 : ['case', ['!=', ['get', 'assignmentColor'], null], .23, .06]) : (isMet ? 0.7 : (isCamp ? ['case', ['==', ['get', 'campania_hecho'], true], 0.35, ['!=', ['get', 'assignmentColor'], null], 0.55, 0.12] : ['case', ['!=', ['get', 'assignmentColor'], null], 0.55, normalFillOpacityExpr])),
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
      'line-opacity': selected ? ['case', selectionFilter, glowBase, 0] : glowBase,
    },
  }
  const terrLine = {
    id: 'terr-line', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' },
    filter: isCamp ? ['!=', ['get', 'campania_hecho'], true] : campFilter,
    paint: {
      'line-color': isMet ? appearance.metricStroke : (isCamp ? campStrokeExpr : ['coalesce', ['get', assignmentBorder], normalStrokeExpr]),
      'line-width': isMet ? 1.2 : (isCamp ? c.coreWidth : normalStrokeWidthExpr),
      // al seleccionar: atenuar el resto para que destaque el elegido
      'line-opacity': selected ? ['case', selectionFilter, 1, 0.15] : 1,
    },
  }
  const terrSel = {
    id: 'terr-sel', type: 'line', filter: selectionFilter,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': highlight, 'line-width': 3.2, 'line-dasharray': isCamp && selHecho ? [3,2] : [1,0] },
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
    id: 'manz-fill-sel', type: 'fill', filter: selectionFilter,
    paint: { 'fill-color': isCamp ? (selHecho ? ch.fill : appearance.neutralFill) : cm.fill, 'fill-opacity': isCamp ? 0.08 : 0.12 },
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
    id: 'manz-line-sel', type: 'line', filter: selectionFilter,
    paint: { 'line-color': isCamp ? (selHecho ? manzBorder : appearance.neutralStroke) : c.stroke, 'line-width': isCamp && selHecho ? .8 : 1.4, 'line-opacity': isCamp && selHecho ? .45 : 1 },
  }
  const tachFill = {
    id: 'manz-tach-fill', type: 'fill',
    paint: { 'fill-color': '#d98282', 'fill-opacity': 0.24 },
  }
  const tachLine = {
    id: 'manz-tach-line', type: 'line',
    paint: { 'line-color': appearance.cross, 'line-width': 1.5, 'line-opacity': 0.78 },
  }
  // la X ocupa la manzana entera (diagonales dibujadas como líneas)
  const tachXHalo = {
    id: 'manz-tach-x-halo', type: 'line',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': appearance.crossHalo,
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 8],
    },
  }
  const tachXLine = {
    id: 'manz-tach-x', type: 'line',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': appearance.cross,
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 4.5],
    },
  }

  const manzLabelSel = {
    id: 'manz-label-sel', type: 'symbol', filter: selectionFilter,
    layout: {
      'text-field': ['get', 'manzana'], 'text-font': ['Noto Sans Bold'], 'text-size': 16,
      'text-allow-overlap': false,
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      'text-radial-offset': 1.2, 'text-justify': 'auto',
    },
    paint: { 'text-color': lblTxt, 'text-halo-color': lblHalo, 'text-halo-width': 2.6 },
  }

  const adminVisible = showAdminPanel && !adminMinimized
  const activeTab = adminVisible ? 'admin' : showGuide ? 'guia' : showProgram ? 'programa' : isMet ? 'metrica' : 'mapa'
  const leaveAdmin = () => { if (showAdminPanel) setAdminMinimized(true) }

  return (
    <div className={`app app-v2 theme-${theme}` + (redesigned ? ' design-poc' : '') + (popup ? ' has-popup' : '') + (isMet ? ' mode-metric' : '') + (showAdminPanel && adminMinimized ? ' admin-is-minimized' : '') + (gamePreview || districtPreview ? ' game-preview' : '')}>
      <Map
        key={`map-${theme}`}
        ref={mapRef}
        mapStyle={online ? (isSatellite ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}` : (theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE)) : offlineStyle(theme)}
        initialViewState={themeCamera.current || { longitude: -62.03, latitude: -31.43, zoom: 12, pitch: gamePreview || districtPreview || satellitePreview ? 55 : 0, bearing: gamePreview || districtPreview || satellitePreview ? -24 : 0 }}
        onMove={event => { themeCamera.current = event.viewState }}
        interactiveLayerIds={['terr-fill']}
        onClick={onClick}
        onLoad={() => {
          if (mapRef.current) { mapRef.current.resize(); if (import.meta.env.DEV) window.__map = mapRef.current.getMap() }
          // si la URL trae ?t=... el encuadre lo hace el deep-link: si este fitAll
          // corre después (mapa lento), le pisaba la cámara ya posicionada
          let hasDeepLink = false
          try { hasDeepLink = !!new URL(window.location.href).searchParams.get('t') } catch (e) {}
          if (!hasDeepLink && !mapHasLoaded.current) fitAll()
          if (districtPreview) {
            configureDistrictPreview(mapRef.current.getMap())
            mapRef.current.jumpTo({ pitch: 55, bearing: -24 })
          }
          setMapLoaded(true)
          setMapGeneration(value=>value+1)
          mapHasLoaded.current = true
        }}
        minZoom={12}
        maxBounds={MAP_NAVIGATION_BOUNDS}
        renderWorldCopies={false}
        maxZoom={20}
        maxPitch={70}
        onStyleData={() => {
          if (!mapRef.current) return
          const map = mapRef.current.getMap()
          if (districtPreview) configureDistrictPreview(map)
        }}
        dragRotate
        pitchWithRotate
        touchZoomRotate
        style={{ position: 'absolute', inset: 0,visibility:showProgram?'hidden':'visible' }}
      >
        <NavigationControl position="top-right" showCompass visualizePitch />
        <GeolocateControl
          ref={geoRef} position="top-right"
          trackUserLocation showUserLocation showUserHeading
          positionOptions={{ enableHighAccuracy: true }} onError={onGeoError}
        />
        {!isMet && <PinMapControl active={pinsVisible} onToggle={() => {
          setPinsVisible(visible => !visible)
          setPinEditing(false)
        }} />}
        {adminOn && !isMet && <PinMapControl edit active={pinsVisible && pinEditing} onToggle={() => {
          if (!pinsVisible) setPinsVisible(true)
          setPinEditing(active => !active)
        }} />}
        {!isMet && pinsVisible && assignedPosts.map((assignment) => (
          <Marker key={assignment.id} ref={marker=>{if(marker)assignmentMarkers.current.set(assignment.id,marker);else assignmentMarkers.current.delete(assignment.id)}} style={{pointerEvents:'none',zIndex:isAssignmentToday(assignment,currentAssignmentDay) ? 14 : 12}} longitude={assignment.coordinates[0]} latitude={assignment.coordinates[1]} anchor="bottom" offset={[assignment.offsetX, 0]}
            draggable={adminOn && pinEditing && !pinSaving && (adminPreview || Boolean(assignment.salidaId && assignment.detalleId))}
            onDragStart={() => { draggingPin.current = true }} onDragEnd={event => moveAssignment(assignment, event)}>
            <button type="button" className={`assignment-post${adminOn && pinEditing ? ' editable' : ''}`} style={{ '--pin-color': assignment.color, '--pin-ink': assignment.ink }} aria-label={`${adminOn && pinEditing ? 'Mover pin' : 'Ver territorio'} ${assignment.territorio}, ${assignment.label}`} title={adminOn && pinEditing ? 'Arrastrá para ajustar la posición' : `Ver ${assignment.territorio} · ${assignment.label}`} onClick={event => {
              event.stopPropagation()
              if (!(adminOn && pinEditing)) selectTerr(assignment.territorio)
            }}>
              <div className="assignment-post-labels">
                <span className={`${assignment.group ? 'is-group' : ''}${isAssignmentToday(assignment,currentAssignmentDay) ? ' is-today' : ''}`}>{assignment.label.replaceAll(' - ', ' · ')}</span>
              </div>
              <svg className="assignment-post-stem" width="1" height={assignment.stemHeight} aria-hidden="true">
                <path d={`M 0 0 Q 0 ${assignment.stemHeight / 2} ${-assignment.offsetX} ${assignment.stemHeight - 5}`} fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" />
                <path d={`M 0 0 Q 0 ${assignment.stemHeight / 2} ${-assignment.offsetX} ${assignment.stemHeight - 5}`} fill="none" stroke={assignment.ink} strokeWidth="2" strokeLinecap="round" />
                <circle cx={-assignment.offsetX} cy={assignment.stemHeight - 5} r="8" fill="white" fillOpacity=".92" />
                <circle cx={-assignment.offsetX} cy={assignment.stemHeight - 5} r="5.5" fill={assignment.color} stroke={assignment.ink} strokeWidth="2" />
              </svg>
            </button>
          </Marker>
        ))}
        {terrView && (
          <Source id="terr" type="geojson" data={isMet ? metricTerrView : assignmentTerrView}>
            <Layer {...terrFill} />
            {gamePreview && !isMet && <Layer id="game-terrain" type="fill-extrusion" paint={{
              'fill-extrusion-color': isCamp ? campFillExpr : ['coalesce', ['get', 'assignmentColor'], '#d5cbb5'],
              'fill-extrusion-height': ['case', selectionFilter, 18, ['has', 'assignmentColor'], 10, 3],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.68,
              'fill-extrusion-vertical-gradient': true,
            }} />}
            <Layer {...terrGlow} />
            <Layer {...terrLine} />
            {isCamp && <Layer id="terr-campaign-done" type="line" filter={['all',['==',['get','campania_hecho'],true],['!',selectionFilter]]}
              layout={{'line-join':'round','line-cap':'butt'}} paint={{'line-color':ch.stroke,'line-width':2.8,'line-dasharray':[3,2],
                'line-opacity':selected?['case',selectionFilter,1,.4]:1}} />}
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
        {buildingPreview && buildingInspect && inspectedBuilding && <Source id="inspected-building" type="geojson" data={inspectedBuilding.feature}>
          <Layer id="inspected-building-volume" type="fill-extrusion" paint={{ 'fill-extrusion-color': '#ff8b28', 'fill-extrusion-height': ['+', ['get', 'height'], .5], 'fill-extrusion-opacity': .95 }} />
          <Layer id="inspected-building-outline" type="line" paint={{ 'line-color': '#ff8b28', 'line-width': 3 }} />
        </Source>}
        {districtPreview && manz && <Source id="district-landmarks" type="geojson" data={districtLandmarks(manz)}>
          <Layer id="district-landmarks-fill" type="fill" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': .85 }} />
          <Layer id="district-landmarks-label" type="symbol" layout={{ 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-max-width': 12 }} paint={{ 'text-color': '#344239', 'text-halo-color': '#fff9ec', 'text-halo-width': 2 }} />
        </Source>}
        {/* Montar primero la referencia de orden; los tachados se insertan
            debajo de estas etiquetas aunque sus fuentes aparezcan después. */}
        {terrLabels && (
          <Source id="terr-lbl" type="geojson" data={terrLabels}>
            <Layer {...terrLabelFar} layout={{...terrLabelFar.layout,'text-padding':13}} paint={{...terrLabelFar.paint,'text-opacity':0}} />
            <Layer {...terrLabelNear} layout={{...terrLabelNear.layout,'text-padding':10}} paint={{...terrLabelNear.paint,'text-opacity':0}} />
          </Source>
        )}
        {tachadasFC && (
          <Source id="manz-tach-src" type="geojson" data={tachadasFC}>
            {[tachFill,tachLine].flatMap(layer=>crossedBlockLayers(layer,selectedTerritories)).map(layer=><Layer key={layer.id} {...layer} beforeId="terr-label"/>)}
          </Source>
        )}
        {tachXFC && (
          <Source id="manz-tach-x-src" type="geojson" data={tachXFC}>
            {/* beforeId: la fuente se monta después que los labels, así que hay que
                insertarla explícitamente debajo para no taparlos */}
            {[tachXHalo,tachXLine].flatMap(layer=>crossedBlockLayers(layer,selectedTerritories)).map(layer=><Layer key={layer.id} {...layer} beforeId="terr-label"/>)}
          </Source>
        )}
        {manzLabels && (
          <Source id="manz-lbl" type="geojson" data={manzLabels}>
            <Layer {...manzLabelSel} />
          </Source>
        )}
        {bordeCalles && bordeCalles.features.length > 0 && (
          <Source id="calles-borde" type="geojson" data={bordeCalles}>
            <Layer {...calleLabel} />
          </Source>
        )}
        {!isSatellite && !districtPreview && !gamePreview && <BuildingPlaces mapReady={mapLoaded} showIcons={!isMet && pinsVisible} />}
        {terrLabels&&<TerritoryBadges labels={terrLabels} selected={selectedTerritories} onSelect={selectTerr} />}
        <TerritoryReflection data={assignmentTerrView} assignments={assignedPosts} day={currentAssignmentDay} dark={appearance.dark} active={mapLoaded && !isMet && pinsVisible && !showGuide && !showProgram && !(showAdminPanel && !adminMinimized)} />
        <MarkerAnimationControl items={assignedPosts} day={currentAssignmentDay} active={mapLoaded && !isMet && pinsVisible && !showGuide && !showProgram && !(showAdminPanel && !adminMinimized)} />
        <InitialMapReady enabled={Boolean(terr&&manz&&publicConfigReady&&!splashOut)} posts={assignedPosts} markers={assignmentMarkers} onReady={initialMapReady}/>
      </Map>
      {gamePreview && <aside className="game-preview-badge"><span>POC LOCAL · VISTA ESTRATEGIA</span><strong>Explorá el territorio</strong><small>Arrastrá para explorar · girá e incliná con dos dedos o botón derecho</small><a href="/">Volver al mapa clásico</a></aside>}
      {districtPreview && <aside className="game-preview-badge"><span>POC LOCAL · MAPA COMPLETO 3D</span><strong>Ciudad simplificada</strong><small>Edificios según disponibilidad; alturas aproximadas. Club y cancha de T36 interpretados de tu imagen. No incluye casas ni árboles decorativos.</small><a href="/?cityPreview=1">Comparar con la maqueta</a><a href="/">Volver al mapa clásico</a></aside>}
      {satellitePreview && <section className="satellite-preview-switch" aria-label="Mapa base de la PoC"><span>POC LOCAL</span><div><button type="button" aria-pressed={!isSatellite} onClick={()=>setSatellite(false)}>Mapa</button><button type="button" disabled={!online} aria-pressed={isSatellite} onClick={()=>setSatellite(true)}>Satélite</button></div><small>{online ? 'Vista inclinable · no es fotogrametría 3D' : 'Satélite requiere conexión'}</small></section>}
      {buildingPreview && <section className="building-inspector" aria-label="Identificar edificio">
        <header><strong>Identificar edificio · Local</strong><button type="button" aria-pressed={buildingInspect} onClick={()=>setBuildingInspect(value=>!value)}>{buildingInspect ? 'Salir de selección' : 'Seleccionar edificio'}</button></header>
        {buildingInspect && <><p>Tocá el techo de un edificio. Se resaltará en naranja.</p>{inspectedBuilding && <><textarea aria-label="Referencia del edificio para copiar" readOnly value={JSON.stringify(inspectedBuilding.reference,null,2)} /><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify(inspectedBuilding.reference,null,2));setBuildingCopyStatus('Referencia copiada')}catch{setBuildingCopyStatus('Seleccioná el texto y copialo manualmente')}}}>Copiar referencia</button><small>El centro es aproximado; los IDs pueden cambiar al actualizar el proveedor. Puede ser una parte de un edificio dividido entre tiles.</small></>}{buildingCopyStatus&&<p role="status">{buildingCopyStatus}</p>}</>}
      </section>}

      <div className="topbar">
        <span className="topbar-brandmark"><img src="logo-furgon.png" className="logo" alt="" /></span>
        <span className="topbar-copy">
          <h1>Territorios</h1>
          <small>Este - San Francisco</small>
        </span>
        <span className={`topbar-status${online ? '' : ' offline'}`} title={localSandbox?'Prueba local: datos ficticios y cambios solo en memoria. Sin escrituras a producción.':undefined} aria-label={localSandbox?'Prueba local. Sin escrituras a producción.':undefined}><i />{localSandbox?'Prueba local':online ? 'Sincronizado' : 'Sin conexión'}</span>
        <button className="topbar-theme" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>{theme === 'dark' ? '☀' : '☾'}</button>
      </div>
      {campModoOn && !isMet && !showProgram && !showGuide && <div className="map-campaign-filter">
        <button type="button" aria-pressed={campaignFilter} onClick={()=>setCampaignFilter(value=>!value)}>
          <IconPath/><span>Campaña</span><span aria-hidden="true">{campaignFilter?'✓':'○'}</span>
        </button>
        {campaignFilter && <span className="campaign-filter-key"><i aria-hidden="true"/>Hecho en campaña</span>}
      </div>}

      {geoError && <div className="toast">{geoError}</div>}
      {pinNotice && <div className={`toast pin-notice${pinUndo && adminOn ? ' has-action' : ''}`} role="status">
        <span>{pinNotice}</span>
        {pinUndo && adminOn && <button type="button" onClick={undoPinMove} disabled={pinSaving} aria-label="Deshacer movimiento">Deshacer <span className="pin-undo-countdown" aria-hidden="true">· {pinUndoSeconds} s</span></button>}
      </div>}

      {popup && !isMet && !showProgram && !(buildingPreview && buildingInspect) && (
        <div className={`info-card${adminOn&&!multipleSelection ? '' : ' info-card-basic'}`}>
          <div className="info-card-head">
            <div>
              {!multipleSelection&&<span className="info-eyebrow">Territorio seleccionado</span>}
              <div className="info-t"><b>{multipleSelection?selectedTerritories.join(' - '):popup.territorio}</b>{!multipleSelection&&<span>{popup.zona}</span>}</div>
            </div>
            <button className="info-close" onClick={clearTerr} aria-label="Cerrar">×</button>
          </div>
          {!multipleSelection && adminOn && popup.activo && <span className="info-status active"><i />Empezado</span>}
          {popupSchedule.length>0&&<div className="info-program" aria-label="Salidas asignadas a este territorio">
            <span className="info-program-title">Programa de salidas</span>
              <ul>{popupSchedule.map(group=><li key={JSON.stringify([group.fecha,group.title,group.horario])}>
                <span>{group.title}{group.fecha?` ${formatProgramDate(group.fecha)}`:''}</span><strong>{group.horario}{group.horario?.includes(':')?' hs':''}</strong>
              </li>)}</ul>
          </div>}
          {!multipleSelection && adminOn && <TerritoryDetails key={popup.territorio}>
            <TerritoryStats territory={popup} historicalStart={popupHistoricalStart} />
          </TerritoryDetails>}
          {!multipleSelection&&<div className="info-actions">
            {adminOn && <button className="info-registro" onClick={() => abrirRegistroDe(popup.territorio)} aria-label="Editar registro" title="Editar registro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg></button>}
            <button className="info-share" onClick={shareTerr} aria-label="Compartir territorio" title="Compartir territorio"><IconWhatsapp /></button>
          </div>}
        </div>
      )}

      {/* Todas las salidas públicas; solo las ubicables permiten navegar. */}
      {!isMet && !showProgram && !showGuide && <Buscador
        assignments={programAssignments}
        posts={assignedPosts}
        data={terrView}
        onPick={selectTerr}
      />}

      {isMet && !showProgram && <MetricaPanel data={metricTerrView} meta={meta} selected={popup} reference={metricReference} onReferenceChange={setMetricReference} onClearSelected={clearTerr} />}

      {showProgram&&<ProgramView preview={designPreview} assignments={programAssignments} weekStart={programWeekStart} day={currentAssignmentDay} data={terrView} ready={publicConfigReady} onPick={assignment=>{setShowProgram(false);setShowGuide(false);setMode('mapa');selectTerr(assignment.territorio,{territories:assignmentTerritories(assignment)})}}/>}

      <nav className="footer">
        <button className={activeTab==='programa'?'on':''} aria-current={activeTab==='programa'?'page':undefined} onClick={()=>{leaveAdmin();setShowGuide(false);setShowProgram(true)}}><FooterIcon name="programa" selected={activeTab==='programa'}/><span>Programa</span></button>
        <button className={activeTab==='mapa' ? 'on' : ''} aria-current={activeTab==='mapa'?'page':undefined} onClick={() => { leaveAdmin();setShowProgram(false);setShowGuide(false); setMode('mapa') }}>
          <FooterIcon name="mapa" selected={activeTab==='mapa'}/><span>Mapa</span>
        </button>
        {(adminOn || metricsVisible) && <button className={activeTab==='metrica' ? 'on' : ''} aria-current={activeTab==='metrica'?'page':undefined} onClick={() => { leaveAdmin();setShowProgram(false);setShowGuide(false); setMode('metrica'); setTimeout(fitAll, 0) }}>
          <FooterIcon name="metrica" selected={activeTab==='metrica'}/><span>Métrica</span>
        </button>}
        <button className={activeTab==='guia' ? 'on' : ''} aria-current={activeTab==='guia'?'page':undefined} onClick={() => {leaveAdmin();setShowProgram(false);setShowGuide(true)}}>
          <FooterIcon name="guia" selected={activeTab==='guia'}/><span>Guía</span>
        </button>
        <button className={activeTab==='admin' ? 'on' : ''} aria-current={activeTab==='admin'?'page':undefined} onClick={() => { setShowProgram(false);setShowGuide(false); setAdminMinimized(false); adminOn ? setShowAdminPanel(true) : setShowLogin(true) }}>
          <FooterIcon name="admin" selected={activeTab==='admin'}/><span>Admin</span>
        </button>
      </nav>

      {showGuide && <Suspense fallback={panelLoading}><PublicGuide campaignVisible={campModoOn} metricsVisible={metricsVisible} adminVisible={adminOn} onClose={() => setShowGuide(false)} /></Suspense>}

      {showLogin && (
        <AdminLogin
          onClose={() => setShowLogin(false)}
          onSuccess={(user) => { setAdminUser(user); setShowLogin(false); setAdminMinimized(false); setShowAdminPanel(true) }}
        />
      )}

      {showAdminPanel && (
        <div style={{display:adminMinimized?'none':'contents'}}>
        <Suspense fallback={panelLoading}>
        <AdminPanel
          fallback={panelLoading}
          minimized={adminMinimized}
          data={terrView}
          manzanas={manzView}
          registroBase={registroBase}
          recordsReady={adminRecordsReady}
          onSave={adminPreview ? async ({created,updated,deleted}) => setRegistroBase(rows => {
            const removed = new Set(deleted.map(row => row.id))
            const changed = new globalThis.Map(updated.map(({record}) => [record.id,record]))
            return [...rows.filter(row => !removed.has(row.id)).map(row => changed.get(row.id) || row), ...created.map(row => ({...row,id:`preview-${row.id}`}))]
          }) : saveRecordChanges}
          onClose={() => setShowAdminPanel(false)}
          onMinimize={() => { setAdminMinimized(true); setShowGuide(false); setShowProgram(false) }}
          onLogout={async () => { if (!adminPreview) await logoutFirebase(); setAdminUser(null); setShowAdminPanel(false) }}
          campModoOn={campModoOn}
          onCampModoChange={adminPreview ? async value => setCampModoOn(value) : setCampaignMode}
          metricsVisible={metricsVisible}
          onMetricsVisibleChange={adminPreview ? async value => setMetricsVisibleState(value) : setMetricsVisible}
          programWeekStart={programWeekStart}
          onProgramWeekStartChange={adminPreview ? async value => setProgramWeekStartState(value) : setProgramWeekStart}
          splashType={splashType}
          onSplashTypeChange={async value=>{if(!adminPreview)await setSplashType(value);setSplashTypeState(value)}}
          initialQuery={adminInitialQuery}
          recordRequest={adminRecordRequest}
          onRecordRequestHandled={consumeAdminRecordRequest}
          syncError={adminSyncError}
          currentEmail={adminUser.email || ''}
          theme={theme}
          preview={adminPreview}
          designPreview={redesigned}
        />
        </Suspense>
        </div>
      )}

      {showAdminPanel && adminMinimized && <button type="button" className="admin-resume-bar" onClick={() => { setShowProgram(false);setAdminMinimized(false); setShowGuide(false) }} aria-label="Retomar Administración donde la dejaste">
        <IconAdmin /><span><strong>Administración</strong><small>Retomar donde la dejaste</small></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>
      </button>}
      {splash && <Splash theme={theme} type={startupSplashType.current||splashType} pending={!publicConfigReady} out={splashOut} slow={startupSlow} onPlaybackComplete={initialVideoReady} onContinue={()=>{ready.current.done=true;setSplash(false)}} />}
    </div>
  )
}
