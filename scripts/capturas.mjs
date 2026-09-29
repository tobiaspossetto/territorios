// Genera una imagen por territorio abriendo la app real y capturando el mapa.
//
//   node scripts/capturas.mjs              -> todos los territorios
//   node scripts/capturas.mjs T10 T29      -> solo esos
//
// Requiere el dev server corriendo (npm run dev) o BASE apuntando al sitio.
// Salida: scripts/salida/T10.png

import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'salida')
const BASE = process.env.BASE || 'http://localhost:5173'
const W = 1200, H = 1500          // retrato, bueno para imprimir y para WhatsApp
const HEAD = 92                    // alto de la cabecera
const TEMA = 'light'

// oculta la interfaz para que quede solo el mapa
const CSS = `
  .topbar, .footer, .themeBtn, .search-fab, .info-card, .guide-backdrop,
  .splash, .maplibregl-ctrl, .metrica-panel { display: none !important; }
  .maplibregl-canvas { outline: none !important; }
`

// corre dentro de la página: deja solo el territorio pedido, agranda textos y encuadra
function aplicar({ id, bounds, cabeceraH }) {
  const m = window.__map
  const solo = ['==', ['get', 'territorio'], id]
  const capas = ['terr-fill', 'terr-line', 'terr-glow', 'terr-sel', 'terr-label',
    'terr-label-near', 'manz-fill-sel', 'manz-line', 'manz-line-sel', 'manz-label-sel']
  for (const l of capas) if (m.getLayer(l)) m.setFilter(l, solo)
  // 'manz-label' y 'manz-label-sel' dibujan el mismo número -> dejar solo una
  if (m.getLayer('manz-label')) m.setFilter('manz-label', ['==', ['get', 'territorio'], '__none__'])

  // textos más grandes para la captura
  const size = (l, v, halo) => {
    if (!m.getLayer(l)) return
    m.setLayoutProperty(l, 'text-size', v)
    if (halo) m.setPaintProperty(l, 'text-halo-width', halo)
  }
  size('manz-label-sel', 34, 4)       // números de manzana
  size('terr-label-near', 30, 5)      // número de territorio
  size('terr-label', 30, 5)
  size('calle-borde-label', 34, 5)    // nombres de calle del borde

  m.stop()
  m.jumpTo({ pitch: 0, bearing: 0 })
  // margen chico; arriba se compensa la cabecera para que quede centrado en el hueco
  m.fitBounds(bounds, {
    padding: { top: 36 + cabeceraH, bottom: 36, left: 36, right: 36 },
    maxZoom: 18, duration: 0,
  })
}

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

async function main() {
  const ids = process.argv.slice(2)
  const terr = JSON.parse(await readFile(join(HERE, '..', 'public', 'territorios.geojson'), 'utf8'))
  const todos = terr.features
    .map((f) => f.properties)
    .sort((a, b) => parseInt(a.territorio.slice(1)) - parseInt(b.territorio.slice(1)))
  const lista = ids.length ? todos.filter((p) => ids.includes(p.territorio)) : todos

  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })

  // tema fijo y guía desactivada antes de que cargue la app
  await page.addInitScript((tema) => {
    localStorage.setItem('theme', tema)
    localStorage.setItem('guideSeen', '1')
  }, TEMA)

  for (const p of lista) {
    const url = `${BASE}/?t=${p.territorio}`
    await page.goto(url, { waitUntil: 'load' })
    await page.addStyleTag({ content: CSS })

    // 1) dejar que la app haga su selección y termine el vuelo
    await page.waitForFunction(() => window.__map && document.querySelector('.info-card'),
      null, { timeout: 30000 }).catch(() => {})
    await page.waitForFunction(() => !window.__map.isMoving(), null, { timeout: 15000 }).catch(() => {})

    // cabecera fija con el territorio
    await page.evaluate(({ titulo, sub, h }) => {
      document.querySelector('#cap-head')?.remove()
      const d = document.createElement('div')
      d.id = 'cap-head'
      d.innerHTML = `<b>${titulo}</b><span>${sub}</span>`
      Object.assign(d.style, {
        position: 'fixed', top: '0', left: '0', right: '0', height: h + 'px', zIndex: '9999',
        display: 'flex', alignItems: 'center', gap: '16px', padding: '0 34px',
        background: '#ffffff', borderBottom: '3px solid #6a4fb0', boxSizing: 'border-box',
        font: '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#2a2733',
      })
      d.querySelector('b').style.cssText = 'font-size:44px;font-weight:800;color:#4e3b8f;letter-spacing:.5px'
      d.querySelector('span').style.cssText = 'color:#6b6580'
      document.body.appendChild(d)
    }, { titulo: p.territorio, sub: p.zona || '', h: HEAD })

    const arg = {
      id: p.territorio,
      cabeceraH: HEAD,
      bounds: bboxOf(terr.features.find((f) => f.properties.territorio === p.territorio).geometry),
    }

    // 2) aislar el territorio y encuadrarlo
    await page.evaluate(aplicar, arg)

    // 3) esperar tiles del encuadre final
    await page.waitForFunction(() => {
      const m = window.__map
      return m && !m.isMoving() && m.areTilesLoaded()
    }, null, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(700)

    // 4) re-aplicar (React puede haber repuesto los filtros al re-renderizar)
    await page.evaluate(aplicar, arg)

    // 5) los nombres de calle del borde se calculan al terminar el movimiento:
    //    esperar a que aparezcan y recién ahí fijar su tamaño (si no, React lo repone)
    await page.waitForFunction(() => {
      const m = window.__map
      return m.getLayer('calle-borde-label') &&
        m.queryRenderedFeatures({ layers: ['calle-borde-label'] }).length > 0
    }, null, { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(400)
    await page.evaluate(aplicar, arg)
    await page.waitForTimeout(500)

    const file = join(OUT, `${p.territorio}.png`)
    await page.screenshot({ path: file })
    console.log(`${p.territorio.padEnd(5)} ${p.zona}`)
  }

  await browser.close()
  console.log(`\nListo -> ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
