import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {MAP_NAVIGATION_BOUNDS} from '../src/mapBounds.js'

test('el límite incluye todos los territorios y manzanas actuales, incluida Josefina',()=>{
  const [[west,south],[east,north]]=MAP_NAVIGATION_BOUNDS
  assert.ok(west<east&&south<north)
  for(const file of ['territorios','manzanas']){
    const data=JSON.parse(readFileSync(new URL(`../public/${file}.geojson`,import.meta.url),'utf8'))
    const check=coordinates=>{
      if(typeof coordinates[0]==='number'){
        const [lng,lat]=coordinates
        assert.ok(lng>=west&&lng<=east&&lat>=south&&lat<=north,`${file}: ${lng}, ${lat} fuera del límite`)
      }else coordinates.forEach(check)
    }
    data.features.forEach(feature=>check(feature.geometry.coordinates))
  }
})

test('los límites se aplican al mapa desde el inicio, sin habilitar copias del mundo',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/maxBounds=\{MAP_NAVIGATION_BOUNDS\}/)
  assert.match(app,/renderWorldCopies=\{false\}/)
  assert.match(app,/minZoom=\{12\}/)
})
