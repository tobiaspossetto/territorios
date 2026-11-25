import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,statSync} from 'node:fs'
import {startupReady,SPLASH_MINIMUM_MS,splashRemaining} from '../src/startupReady.js'

test('conserva el video anterior como alternativa reversible',()=>{
  const source=readFileSync(new URL('../src/Splash.jsx',import.meta.url),'utf8')
  assert.match(source,/autoPlay muted loop=\{played\} playsInline/)
  assert.match(source,/onEnded=\{\(\)=>\{setPlayed\(true\);onPlaybackComplete\?\.\(\)\}\}/)
  assert.match(source,/poster="logo-furgon.png"/)
  assert.match(source,/prefers-reduced-motion: reduce/)
  assert.match(source,/onError=\{\(\)=>setFailed\(true\)\}/)
  assert.match(source,/video.pause\(\)/)
  assert.ok(statSync(new URL('../public/camioneta-inicio-claro.mp4',import.meta.url)).size<1024*1024)
})
test('la carga normal usa el collage sin parámetros de prueba ni reproductor',()=>{
  const source=readFileSync(new URL('../src/Splash.jsx',import.meta.url),'utf8')
  assert.match(source,/export default function Splash\(\{type='collage',pending=false,\.\.\.props\}\)/)
  assert.match(source,/normalizeSplashType\(type\)==='auto'\?<VideoSplash \{\.\.\.props\}\/>:<CollageSplash/)
  assert.doesNotMatch(source,/collagePreview|import.meta.env.DEV/)
  const collage=readFileSync(new URL('../src/CollageSplash.jsx',import.meta.url),'utf8')
  const scenes=readFileSync(new URL('../src/collageScenes.js',import.meta.url),'utf8')
  assert.equal((scenes.match(/"name":/g)||[]).length,11)
  assert.doesNotMatch(collage,/<video/)
  assert.doesNotMatch(collage,/const DURATION=/)
  assert.match(collage,/if\(!loaded\)return/)
  assert.match(collage,/onPlaybackComplete\?\.\(\)/)
  assert.match(collage,/return\(\)=>clearTimeout\(timer\)/)
  assert.match(collage,/onError=\{\(\)=>setFailed\(true\)\}/)
  assert.match(collage,/<SplashProgress complete=\{out\}/)
  assert.doesNotMatch(collage,/aria-valuenow|collage-loading/)
  assert.doesNotMatch(collage,/collage-carga\.png/)
  assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/rel="preload" as="image" href="\.\/collage-carga.png"/)
})

test('la carga dura dos segundos desde el inicio, sin añadir espera al cargar más lento',()=>{
  assert.equal(SPLASH_MINIMUM_MS,2000)
  assert.equal(splashRemaining(100,100),2000)
  assert.equal(splashRemaining(100,600),1500)
  assert.equal(splashRemaining(100,2100),0)
  assert.equal(splashRemaining(100,5100),0)
  const progress=readFileSync(new URL('../src/SplashProgress.jsx',import.meta.url),'utf8')
  assert.match(progress,/aria-valuenow=\{complete\?100:undefined\}/)
  const css=readFileSync(new URL('../src/collage-splash.css',import.meta.url),'utf8')
  assert.match(css,/\.collage-progress.is-complete span \{ animation:none; width:100%; transform:none/)
})

test('Auto no espera el video si mapa y datos están listos',()=>{
  const ready={data:true,map:true,time:true,publicConfig:true,video:false}
  assert.equal(startupReady(ready),true)
  assert.equal(startupReady({...ready,video:true}),true)
})

test('ambas cargas terminan con los datos y mapa listos, sin espera mínima',()=>{
  const ready={data:true,map:true,publicConfig:true,time:false,video:false}
  assert.equal(startupReady(ready,'collage'),true)
  assert.equal(startupReady({...ready,video:true},'collage'),true)
  assert.equal(startupReady(ready,'auto'),true)
  for(const field of ['data','map','publicConfig'])assert.equal(startupReady({...ready,video:true,[field]:false},'collage'),false)
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/startupReady\(r,startupSplashType.current\|\|'collage'\)/)
})

test('terminar video no permite entrar si falta cargar la app',()=>{
  const ready={data:true,map:true,time:true,publicConfig:true,video:true}
  for(const field of ['data','map','publicConfig'])assert.equal(startupReady({...ready,[field]:false}),false)
})

test('la vista permanente de prueba retirada no se monta en la aplicación',()=>{
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8')
  assert.doesNotMatch(main,/splashPreview|previewType|previewTheme/)
})
test('la app publicada monta la bienvenida sin esperar un segundo módulo',()=>{
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8')
  assert.match(main,/import PublishedApp from '\.\/PublishedApp.jsx'/)
  assert.match(main,/REDESIGN_ENABLED \? PublishedApp : App/)
  assert.doesNotMatch(main,/React.lazy\(\(\) => import\('\.\/PublishedApp.jsx'\)\)/)
})
test('conserva el arranque automático original sin depender de un toque ni controles de reproducción',()=>{
  const source=readFileSync(new URL('../src/Splash.jsx',import.meta.url),'utf8')
  assert.match(source,/else video.play\(\)\?\.catch\(\(\)=>\{if\(active\)setFailed\(true\)\}\)/)
  assert.doesNotMatch(source,/pointerdown|visibilitychange/)
  const video=source.split('\n').find(line=>line.includes('<video '))
  assert.ok(video)
  assert.doesNotMatch(video,/onClick|\bcontrols\b/)
  assert.match(source,/setTimeout\(\(\)=>setFailed\(true\),15000\)/)
})
test('cada tema usa su video de inicio independiente',()=>{
  const source=readFileSync(new URL('../src/Splash.jsx',import.meta.url),'utf8')
  assert.match(source,/theme='light'/)
  assert.match(source,/videoSource=theme==='dark'\?'camioneta-inicio-oscuro.mp4\?v=af4ecc8f':'camioneta-inicio-claro.mp4'/)
  assert.match(source,/src=\{videoSource\}/)
  assert.match(readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),/<Splash theme=\{theme\}/)
  assert.ok(statSync(new URL('../public/camioneta-inicio-claro.mp4',import.meta.url)).size<1024*1024)
  assert.ok(statSync(new URL('../public/camioneta-inicio-oscuro.mp4',import.meta.url)).size<1024*1024)
})
test('fondo claro coincide con el video y el título reutiliza la textura sin cambiar su contenido',()=>{
  const css=readFileSync(new URL('../src/v2.css',import.meta.url),'utf8')
  assert.match(css,/\.theme-light \.splash \{ background:#f5f2ea/)
  assert.match(css,/\.theme-dark \.splash \{ background:#1e1c19/)
  assert.match(css,/\.splash-title \{\s*background-color:#78340f;\s*background-image:url\('\/logo-furgon.png'\)/)
  assert.match(css,/-webkit-background-clip:text/)
  assert.match(readFileSync(new URL('../src/Splash.jsx',import.meta.url),'utf8'),/<div className="splash-title">TERRITORIOS<\/div>/)
})
