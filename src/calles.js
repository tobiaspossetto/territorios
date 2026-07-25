// Detecta el nombre de calle de cada lado del contorno de un territorio, leyendo
// las etiquetas de calle ya renderizadas por el mapa base (no hace requests).

const R = 6371000 // radio terrestre en m

function toXY(lng, lat, lat0) {
  const k = Math.cos((lat0 * Math.PI) / 180)
  return [((lng * Math.PI) / 180) * R * k, ((lat * Math.PI) / 180) * R]
}

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

// distancia de un punto al segmento a-b (todo en metros/plano local)
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const L2 = dx * dx + dy * dy
  if (L2 === 0) return dist(p, a)
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2
  t = Math.max(0, Math.min(1, t))
  return dist(p, [a[0] + t * dx, a[1] + t * dy])
}

// ángulo del segmento normalizado a [0,180)
function angleOf(a, b) {
  let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  ang = ((ang % 180) + 180) % 180
  return ang
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 180
  return Math.min(d, 180 - d)
}

// Simplifica el contorno a "lados": une vértices consecutivos que siguen casi la
// misma dirección, y descarta los tramos muy cortos.
function ringToSides(ring, lat0, minLen = 40, tolAng = 22) {
  const pts = ring.map(([lng, lat]) => ({ lngLat: [lng, lat], xy: toXY(lng, lat, lat0) }))
  if (pts.length < 3) return []
  const sides = []
  let start = 0
  for (let i = 1; i < pts.length; i++) {
    const prevAng = angleOf(pts[start].xy, pts[i].xy)
    const nextIdx = i + 1 < pts.length ? i + 1 : null
    if (nextIdx == null) { sides.push([start, i]); break }
    const nextAng = angleOf(pts[i].xy, pts[nextIdx].xy)
    if (angleDiff(prevAng, nextAng) > tolAng) { sides.push([start, i]); start = i }
  }
  return sides
    .map(([i, j]) => ({
      a: pts[i], b: pts[j],
      len: dist(pts[i].xy, pts[j].xy),
      ang: angleOf(pts[i].xy, pts[j].xy),
    }))
    .filter((s) => s.len >= minLen)
}

// puntos de muestreo a lo largo de un lado (en metros/plano)
function sampleSide(s, n = 7) {
  const out = []
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1)
    out.push([s.a.xy[0] + (s.b.xy[0] - s.a.xy[0]) * t, s.a.xy[1] + (s.b.xy[1] - s.a.xy[1]) * t])
  }
  return out
}

/**
 * Devuelve un FeatureCollection de LineStrings (un lado cada uno) con
 * properties.calle para los lados donde se pudo identificar la calle.
 * Los lados sin calle reconocida se omiten.
 *
 * @param geom  geometría del territorio (Polygon | MultiPolygon)
 * @param roads features de calles renderizadas (con properties.name y geometría LineString)
 * @param maxDist  distancia máx. en metros entre lado y calle para considerarla suya
 */
export function bordeConCalles(geom, roads, maxDist = 30) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates : []
  if (!polys.length) return { type: 'FeatureCollection', features: [] }

  const lat0 = polys[0][0][0][1]

  // calles: tramos en plano local, con nombre
  const tramos = []
  for (const r of roads) {
    const name = r.properties && (r.properties.name || r.properties['name:latin'])
    if (!name) continue
    const g = r.geometry
    const lines = g.type === 'LineString' ? [g.coordinates]
      : g.type === 'MultiLineString' ? g.coordinates : []
    for (const line of lines) {
      const xy = line.map(([lng, lat]) => toXY(lng, lat, lat0))
      for (let i = 0; i + 1 < xy.length; i++) {
        tramos.push({ name, a: xy[i], b: xy[i + 1], ang: angleOf(xy[i], xy[i + 1]) })
      }
    }
  }

  const features = []
  for (const poly of polys) {
    for (const side of ringToSides(poly[0], lat0)) {
      const muestras = sampleSide(side)
      // por nombre de calle: cuántas muestras tiene cerca y a qué distancia media
      const score = new Map()
      for (const m of muestras) {
        let best = null
        for (const t of tramos) {
          if (angleDiff(t.ang, side.ang) > 25) continue      // debe ser casi paralela
          const d = distToSeg(m, t.a, t.b)
          if (d <= maxDist && (!best || d < best.d)) best = { name: t.name, d }
        }
        if (best) {
          const s = score.get(best.name) || { hits: 0, sum: 0 }
          s.hits++; s.sum += best.d
          score.set(best.name, s)
        }
      }
      // gana la calle presente en la mayoría de las muestras (y más cerca)
      let win = null
      for (const [name, s] of score) {
        if (s.hits < Math.ceil(muestras.length * 0.5)) continue
        const avg = s.sum / s.hits
        if (!win || s.hits > win.hits || (s.hits === win.hits && avg < win.avg)) {
          win = { name, hits: s.hits, avg }
        }
      }
      if (!win) continue   // lado sin calle reconocida -> sin label
      features.push({
        type: 'Feature',
        properties: { calle: win.name },
        geometry: { type: 'LineString', coordinates: [side.a.lngLat, side.b.lngLat] },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}
