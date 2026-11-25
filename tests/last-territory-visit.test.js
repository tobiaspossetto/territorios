import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {lastTerritoryVisit} from '../src/lastTerritoryVisit.js'
const source=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('última visita incluye un registro empezado más reciente, sin depender del orden',()=>{
  const rows=[{inicio:'2026-10-26',fin:null},{inicio:'2026-09-01',fin:'2026-09-08'}]
  const before=structuredClone(rows)
  assert.equal(lastTerritoryVisit(rows),'2026-10-26')
  assert.equal(lastTerritoryVisit([...rows].reverse()),'2026-10-26')
  assert.deepEqual(rows,before)
})
test('visitas completadas conservan la fecha de fin; sin fechas no inventa una visita',()=>{
  assert.equal(lastTerritoryVisit([{inicio:'2026-10-01',fin:'2026-10-20'},{inicio:'2026-10-12',fin:null}]),'2026-10-20')
  assert.equal(lastTerritoryVisit([]),null)
  assert.equal(lastTerritoryVisit([{inicio:null,fin:null}]),null)
})
test('la fecha de visita se publica y muestra sin cambiar las finalizaciones de métrica',()=>{
  const code=source('firebaseData.js')
  assert.match(code,/ultimaVisita: lastTerritoryVisit\(rows\)/)
  assert.match(code,/const ultima = completas.map\(\(r\) => r.fin\)/)
  assert.match(code,/ultima_visita_fmt: \(s.ultimaVisita \|\| s.ultima\)/)
  assert.match(code,/public-map-summary-v3/)
  assert.match(source('TerritoryStats.jsx'),/territory.ultima_visita_fmt \|\| territory.ultima_fmt/)
})
