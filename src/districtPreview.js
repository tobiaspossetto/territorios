// PoC local: extrusión de huellas reales del proveedor, no edificios decorativos.
const configuring = new WeakSet()
export function configureDistrictPreview(map) {
  if (!map.isStyleLoaded() || configuring.has(map) || map.getLayer('district-buildings')) return
  const style = map.getStyle()
  const building = style.layers.find(layer => layer.source && /building/i.test(layer['source-layer'] || '') && ['fill', 'fill-extrusion'].includes(layer.type))
  if (!building) return
  configuring.add(map)
  try {
  for (const layer of style.layers) {
    if (layer.source === building.source && layer['source-layer'] === building['source-layer'] && ['fill', 'fill-extrusion'].includes(layer.type)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    }
  }
  map.addLayer({
    id: 'district-buildings', type: 'fill-extrusion', source: building.source,
    'source-layer': building['source-layer'], minzoom: 14,
    paint: {
      'fill-extrusion-color': ['match', ['coalesce', ['get', 'class'], ['get', 'type'], ''], ['school', 'university', 'hospital'], '#b7a78a', '#cbc8bd'],
      'fill-extrusion-height': ['min', 120, ['max', 3, ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height'], 6], 6]]],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': .88,
      'fill-extrusion-vertical-gradient': true,
    },
  }, style.layers.find(layer => layer.type === 'symbol')?.id)
  } finally { configuring.delete(map) }
}

// Referentes de T36 interpretados de la imagen aérea aportada por el usuario.
export function districtLandmarks(blocks) {
  if (!blocks) return null
  return { type: 'FeatureCollection', features: blocks.features.filter(f => f.properties.territorio === 'T36' && ['2', '4'].includes(String(f.properties.manzana))).map(f => {
    const isField = String(f.properties.manzana) === '4'
    return { ...f, properties: { ...f.properties, name: isField ? 'Club Defensores · cancha' : 'Predio del club', color: isField ? '#b6aa91' : '#93a47e' } }
  }) }
}
