export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

// Capa clara, blanca y sin relieve cromático usada antes del rediseño.
export const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${MAPTILER_KEY}`

// Polígonos de territorio: dorado sobre blanco. "hecho" es solo de Campaña:
// un territorio marcado C cuya pasada ya se completó se pinta verde.
export const COLORS = {
  fill: '#d4af37', fillOpacity: 0.2, stroke: '#8a6a12', glow: '#d4af37', neon: false,
  coreWidth: 2, glowWidth: 0, glowBlur: 0, label: '#4a3a08', labelHalo: '#ffffff',
}
export const COLORS_HECHO = {
  fill: '#2e9e5b', fillOpacity: 0.22, stroke: '#1f6e3f', glow: '#2e9e5b', neon: false,
  coreWidth: 2.2, glowWidth: 0, glowBlur: 0, label: '#1c4a2c', labelHalo: '#ffffff',
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
      { id: 'bg', type: 'background', paint: { 'background-color': '#0a0f1c' } },
      { id: 'earth', type: 'fill', source: 'pm', 'source-layer': 'earth', paint: { 'fill-color': '#0e1626' } },
      { id: 'landuse', type: 'fill', source: 'pm', 'source-layer': 'landuse', paint: { 'fill-color': '#12203a', 'fill-opacity': 0.5 } },
      { id: 'water', type: 'fill', source: 'pm', 'source-layer': 'water', paint: { 'fill-color': '#0a2036' } },
      { id: 'roads', type: 'line', source: 'pm', 'source-layer': 'roads',
        paint: { 'line-color': '#3a4a63', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 2] } },
      { id: 'buildings', type: 'fill', source: 'pm', 'source-layer': 'buildings', paint: { 'fill-color': '#152036', 'fill-opacity': 0.6 } },
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
