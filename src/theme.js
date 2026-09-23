export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

// Base clara permanente. La aplicación ya no ofrece modo nocturno.
export const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`

// Polígonos de territorio: naranja sobre mapa oscuro (misma paleta en Mapa,
// Campaña y selección de Métrica). "hecho" es solo de Campaña: un territorio
// marcado C cuya pasada ya se completó (Inicio y Fin) se pinta verde para
// distinguirlo de lo recién asignado.
export const COLORS = {
  fill: '#ed7100', fillOpacity: 0.22, stroke: '#d85f00', glow: '#ed7100', neon: false,
  coreWidth: 2.4, glowWidth: 0, glowBlur: 0, label: '#9b4300', labelHalo: '#ffffff',
}
export const COLORS_HECHO = {
  fill: '#3ea55f', fillOpacity: 0.32, stroke: '#5fc97e', glow: '#3ea55f', neon: false,
  coreWidth: 2.2, glowWidth: 0, glowBlur: 0, label: '#c8f2d3', labelHalo: '#0a1510',
}

// Estilo OFFLINE: base desde el extracto local zona.pmtiles + glyphs locales.
// Se usa solo cuando no hay conexión (online sigue con MapTiler, sin cambios).
export function offlineStyle() {
  const base = new URL('./', location.href).href
  return {
    version: 8,
    glyphs: base + 'fonts/{fontstack}/{range}.pbf',
    sources: { pm: { type: 'vector', url: `pmtiles://${base}zona.pmtiles`, attribution: '© OpenStreetMap' } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#f4f4f3' } },
      { id: 'earth', type: 'fill', source: 'pm', 'source-layer': 'earth', paint: { 'fill-color': '#f1f1ef' } },
      { id: 'landuse', type: 'fill', source: 'pm', 'source-layer': 'landuse', paint: { 'fill-color': '#e5e8e3', 'fill-opacity': 0.65 } },
      { id: 'water', type: 'fill', source: 'pm', 'source-layer': 'water', paint: { 'fill-color': '#b9d7ec' } },
      { id: 'roads', type: 'line', source: 'pm', 'source-layer': 'roads',
        paint: { 'line-color': '#c2c2bf', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 2] } },
      { id: 'buildings', type: 'fill', source: 'pm', 'source-layer': 'buildings', paint: { 'fill-color': '#d7d5d2', 'fill-opacity': 0.7 } },
    ],
  }
}

// Escala de la MÉTRICA (veces completado): verde (0/1) -> rojo (más).
const METRIC_ZERO = '#8aa99a'
const METRIC_STEPS = { 1: '#2e9e5b', 2: '#9ccc3c', 3: '#f4c020', 4: '#f57c00', 5: '#d32f2f' }

export function metricColor(v) {
  if (v <= 0) return METRIC_ZERO
  if (v >= 5) return METRIC_STEPS[5]
  return METRIC_STEPS[v]
}

// Expresión MapLibre para pintar el fill por 'veces'.
export function metricFillExpr() {
  return ['step', ['get', 'veces'],
    METRIC_ZERO,
    1, METRIC_STEPS[1], 2, METRIC_STEPS[2], 3, METRIC_STEPS[3], 4, METRIC_STEPS[4], 5, METRIC_STEPS[5]]
}

// Leyenda (orden visual verde->rojo) para el panel de métrica.
export const METRIC_LEGEND = [
  { label: '0 / 1', color: '#2e9e5b' },
  { label: '2', color: '#9ccc3c' },
  { label: '3', color: '#f4c020' },
  { label: '4', color: '#f57c00' },
  { label: '5+', color: '#d32f2f' },
]
