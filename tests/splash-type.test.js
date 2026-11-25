import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizeSplashType,readStartupSplashType,rememberSplashType} from '../src/splashType.js'
const source=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('Collage es el valor por defecto y Auto conserva la camioneta',()=>{
  for(const value of [null,undefined,'',false,'invalid','Auto'])assert.equal(normalizeSplashType(value),'collage')
  assert.equal(normalizeSplashType('auto'),'auto')
  assert.equal(normalizeSplashType('collage'),'collage')
  assert.match(source('Splash.jsx'),/normalizeSplashType\(type\)==='auto'\?<VideoSplash/)
})
test('la selección se guarda en configuración pública con merge y validación',()=>{
  const code=source('firebaseData.js')
  assert.match(code,/splashType=normalizeSplashType\(value\?\.splashType\)/)
  assert.match(code,/function setSplashType\(splashType\) \{\s*assertWritableFirebase\(\)/)
  assert.match(code,/if\(!\['auto','collage'\].includes\(splashType\)\)throw/)
  assert.match(code,/\{splashType,updatedAt:Date.now\(\)\},\{merge:true\}/)
})
test('Otros ofrece dos botones accesibles, avisa fallos y bloquea cambios simultáneos',()=>{
  assert.match(source('AdminPanelV2.jsx'),/<SplashTypeSettings value=\{splashType\}/)
  const code=source('SplashTypeSettings.jsx')
  assert.match(code,/\[\['auto','Auto'\],\['collage','Collage'\]\]/)
  assert.match(code,/aria-pressed=\{selected===type\}/)
  assert.match(code,/disabled=\{busy\}/)
  assert.match(code,/await onSave\(type\)/)
  assert.match(code,/role="alert"/)
})
test('la carga espera su configuración sin arrancar dos animaciones ni cambiar a mitad',()=>{
  const app=source('App.jsx')
  assert.match(app,/if\(startupSplashType.current===null\)startupSplashType.current=loadingType/)
  assert.match(app,/type=\{startupSplashType.current\|\|splashType\} pending=\{!publicConfigReady\}/)
  assert.doesNotMatch(source('Splash.jsx'),/if\(pending\)return/)
  assert.match(app,/useState\(\(\)=>readStartupSplashType\(\)\)/)
  assert.match(app,/rememberSplashType\(loadingType\)/)
  assert.match(app,/onSplashTypeChange=\{async value=>\{if\(!adminPreview\)await setSplashType\(value\);setSplashTypeState\(value\)\}\}/)
})
test('recuerda la carga elegida sin bloquear si el almacenamiento no está disponible',()=>{
  const values=new Map()
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
  assert.equal(readStartupSplashType(storage),'collage')
  rememberSplashType('auto',storage)
  assert.equal(readStartupSplashType(storage),'auto')
  rememberSplashType('invalid',storage)
  assert.equal(readStartupSplashType(storage),'collage')
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}
  assert.equal(readStartupSplashType(blocked),'collage')
  assert.doesNotThrow(()=>rememberSplashType('auto',blocked))
})
test('Auto no precarga el collage y la ilustración elegida se guarda en caché a demanda',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')
  const config=readFileSync(new URL('../vite.config.js',import.meta.url),'utf8')
  assert.doesNotMatch(html,/rel="preload"[^>]+collage-carga/)
  assert.match(config,/globIgnores: \['\*\*\/collage-carga.png'\]/)
  assert.match(config,/cacheName: 'splash-scenes-v2'/)
})
