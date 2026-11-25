import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {mapAppearance} from '../src/mapAppearance.js'

test('dark map contrasts differ without changing the light palette',()=>{
  const light=mapAppearance('light'), dark=mapAppearance('dark')
  assert.equal(light.label,'#4a3a08')
  assert.equal(light.stroke,'#8a6a12')
  for(const key of ['stroke','label','labelHalo','blockLabel','blockBorder','metricStroke','cross','crossHalo']) assert.notEqual(light[key],dark[key])
  assert.equal(dark.dark,true)
})
test('theme changes online and offline maps through the single app theme',()=>{
  const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/theme === 'dark' \? MAP_STYLE_DARK : MAP_STYLE/)
  assert.match(app,/offlineStyle\(theme\)/)
  assert.match(app,/mapAppearance\(theme\)/)
  assert.match(app,/key=\{`map-\$\{theme\}`\}/)
  assert.match(app,/initialViewState=\{themeCamera.current \|\|/)
  assert.match(app,/themeCamera.current = event.viewState/)
  const theme=fs.readFileSync(new URL('../src/theme.js',import.meta.url),'utf8')
  assert.match(theme,/maps\/streets-v2-dark\/style.json/)
})
test('reflection cleanup is safe after the old map has been removed',()=>{
  const source=fs.readFileSync(new URL('../src/TerritoryReflection.jsx',import.meta.url),'utf8')
  assert.ok(source.indexOf('if(!map.getStyle())return') < source.indexOf("map.getLayer('today-territory-elevation')"))
  assert.match(source,/dark \? \.18 : \.4/)
})
