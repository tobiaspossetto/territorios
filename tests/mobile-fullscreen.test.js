import test from 'node:test'
import assert from 'node:assert/strict'
import {firstTouchFullscreen} from '../src/mobileFullscreen.js'

function fixture({mobile=true,installed=false,supported=true,reject=false}={}) {
  const listeners=new Map(),calls=[]
  const doc={fullscreenEnabled:supported,fullscreenElement:null,
    documentElement:{requestFullscreen:options=>{calls.push(options);return reject?Promise.reject(new Error('denied')):Promise.resolve()}},
    addEventListener:(name,callback)=>listeners.set(name,callback),
    removeEventListener:(name,callback)=>{if(listeners.get(name)===callback)listeners.delete(name)},
  }
  const win={matchMedia:query=>({matches:query.includes('display-mode')?installed:mobile})}
  return {doc,win,listeners,calls,tap:(isTrusted=true)=>listeners.get('click')?.({isTrusted})}
}
test('pantalla completa solo con el primer toque real, sin cancelar la acción',async()=>{
  const f=fixture()
  const cleanup=firstTouchFullscreen(f.doc,f.win,{})
  assert.equal(f.calls.length,0)
  f.tap(false);assert.equal(f.calls.length,0)
  f.tap();f.tap()
  assert.deepEqual(f.calls,[{navigationUI:'hide'}])
  assert.equal(f.listeners.size,0)
  cleanup()
})
test('no solicitar fullscreen en escritorio, app instalada o sin soporte',()=>{
  for(const options of [{mobile:false},{installed:true},{supported:false}]){
    const f=fixture(options);firstTouchFullscreen(f.doc,f.win,{})();f.tap()
    assert.equal(f.calls.length,0)
  }
})
test('rechazo no rompe la app ni repite la petición y el desmontaje limpia el listener',async()=>{
  const f=fixture({reject:true});firstTouchFullscreen(f.doc,f.win,{})
  f.tap();await Promise.resolve();f.tap()
  assert.equal(f.calls.length,1)
  const g=fixture();const cleanup=firstTouchFullscreen(g.doc,g.win,{})
  cleanup();g.tap();assert.equal(g.calls.length,0)
})
