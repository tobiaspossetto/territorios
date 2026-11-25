import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,statSync} from 'node:fs'
import {COLLAGE_SCENES,shuffleCollageScenes} from '../src/collageScenes.js'
test('cada mezcla conserva las once escenas seleccionadas sin duplicar ni modificar',()=>{
  assert.ok(COLLAGE_SCENES.every(scene=>!['salon','construccion','reconstruccion','estudio'].includes(scene.id)))
  const original=structuredClone(COLLAGE_SCENES)
  const shuffled=shuffleCollageScenes(()=>0)
  assert.equal(shuffled.length,11)
  assert.equal(new Set(shuffled.map(scene=>scene.name)).size,11)
  assert.notDeepEqual(shuffled.map(s=>s.name),COLLAGE_SCENES.map(s=>s.name))
  assert.deepEqual(new Set(shuffled.map(s=>s.name)),new Set(COLLAGE_SCENES.map(s=>s.name)))
  assert.deepEqual(COLLAGE_SCENES,original)
})
test('cada escena usa una ilustración independiente optimizada y versionada',()=>{
  assert.equal(new Set(COLLAGE_SCENES.map(s=>s.id)).size,11)
  let total=0
  for(const scene of COLLAGE_SCENES){
    assert.match(scene.src,/^splash-scenes\/[a-z]+-[a-f0-9]{10}\.webp$/)
    assert.equal(scene.crop,undefined)
    const size=statSync(new URL('../public/'+scene.src,import.meta.url)).size
    assert.ok(size<120000,scene.name)
    total+=size
  }
  assert.ok(total<1200000)
})
test('la bienvenida monta solo la escena actual y precarga una siguiente sin filtros',()=>{
  const jsx=readFileSync(new URL('../src/CollageSplash.jsx',import.meta.url),'utf8')
  const css=readFileSync(new URL('../src/collage-splash.css',import.meta.url),'utf8')
  assert.match(jsx,/const shown=gallery\?frames:\[current\]/)
  assert.match(jsx,/next.src=frames\[\(index\+1\)%frames.length\].src/)
  assert.match(jsx,/<img className="collage-art" src=\{scene.src\}/)
  assert.doesNotMatch(css,/mix-blend-mode|filter:|mask-image|background-image|crop-ratio/)
  assert.match(jsx,/if\(gallery\|\|reduced\|\|out\|\|!currentReady\)return/)
})
