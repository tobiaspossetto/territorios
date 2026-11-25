import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {readPublicStateCache,writePublicStateCache} from '../src/publicStateCache.js'

const source=readFileSync(new URL('../src/firebaseData.js',import.meta.url),'utf8')
const subscription=source.slice(source.indexOf('export function subscribePublicState('),source.indexOf('// One-shot, read-only copy'))
  .replace('export function','function').replaceAll('import.meta.env.VITE_FIREBASE_PROJECT_ID','"test-project"')
const key='territorios-public-v1:test-project'
const cached={summaries:{T29:{activo:true}},programAssignments:[{id:'old',territorio:'T29'}],campaignMode:false,metricsVisible:true,programWeekStart:0,splashType:'collage'}
function target(){const listeners=new Map();return {
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)},
  removeEventListener(name,fn){listeners.get(name)?.delete(fn)},
  async fire(name){await Promise.all([...(listeners.get(name)||[])].map(fn=>fn()))},
  count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0)},
}}
function setup(){
  const values=new Map(),disk={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}
  writePublicStateCache(key,cached,disk)
  const window=target(),document={...target(),hidden:false},snapshots=new Map(),received=[]
  let nextConfig={programAssignments:[{id:'new',territorio:'T35'}]},nextTerritories={T35:{activo:false}},stops=0
  const context={firestore:{},window,document,navigator:{onLine:true},
    readPublicStateCache:k=>readPublicStateCache(k,disk),writePublicStateCache:(k,v)=>writePublicStateCache(k,v,disk),
    normalizeProgramWeekStart:v=>v||0,normalizeSplashType:v=>v==='auto'?'auto':'collage',
    collection:(_,name)=>name,doc:(_,name,id)=>`${name}/${id}`,
    onSnapshot(ref,options,callback){assert.equal(options.includeMetadataChanges,true);snapshots.set(ref,callback);return()=>stops++},
    getDocsFromServer:async()=>({docs:Object.entries(nextTerritories).map(([id,value])=>({id,data:()=>value}))}),
    getDocFromServer:async()=>({exists:()=>true,data:()=>nextConfig}),
  }
  vm.createContext(context)
  const subscribe=vm.runInContext(`${subscription};subscribePublicState`,context)
  const stop=subscribe(value=>received.push(JSON.parse(JSON.stringify(value))),error=>{throw error})
  return {window,document,snapshots,received,stop,disk,setConfig:value=>{nextConfig=value},stops:()=>stops}
}

test('un arranque sin conexión restaura el programa antes de recibir Firebase; su caché vacía no lo borra',()=>{
  const app=setup()
  assert.deepEqual(app.received[0].programAssignments,cached.programAssignments)
  app.snapshots.get('config/public')({metadata:{fromCache:true},exists:()=>false,data:()=>undefined})
  app.snapshots.get('territoriosPublicos')({metadata:{fromCache:true},empty:true,docs:[]})
  assert.equal(app.received.length,1)
  app.stop()
})

test('al reconectar consulta servidor y reemplaza el programa, incluidas eliminaciones',async()=>{
  const app=setup()
  await app.window.fire('online')
  assert.deepEqual(app.received.at(-1).programAssignments,[{id:'new',territorio:'T35'}])
  app.setConfig({programAssignments:[]})
  await app.window.fire('online')
  assert.deepEqual(app.received.at(-1).programAssignments,[])
  assert.deepEqual(readPublicStateCache(key,app.disk).programAssignments,[])
  app.stop()
  assert.equal(app.window.count()+app.document.count(),0)
  assert.equal(app.stops(),2)
})
