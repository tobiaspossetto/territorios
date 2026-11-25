import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PMTiles,FetchSource} from 'pmtiles'
import {VectorTile} from '@mapbox/vector-tile'
import Pbf from 'pbf'
import {OfflineArchiveSource} from '../src/offlineArchive.js'

const bytes=await readFile(new URL('../public/zona.pmtiles',import.meta.url))
const fullResponse=()=>new Response(bytes,{status:200,headers:{'Content-Length':String(bytes.length)}})

test('la descarga conserva el contexto nativo de fetch del navegador',async()=>{
  const original=globalThis.fetch
  globalThis.fetch=async function(){assert.equal(this,globalThis);return fullResponse()}
  try {assert.equal((await new OfflineArchiveSource('zone').getBytes(0,7)).data.byteLength,7)}
  finally {globalThis.fetch=original}
})

test('reproduce el fallo del lector HTTP al recibir el archivo completo precacheado',async()=>{
  const original=globalThis.fetch
  globalThis.fetch=async()=>fullResponse()
  try {
    await assert.rejects(new PMTiles(new FetchSource('https://local.test/zona.pmtiles')).getHeader(),/Byte Serving/)
  } finally {globalThis.fetch=original}
})

test('lee nombres de calles del PMTiles real con respuesta completa del caché y una sola descarga',async()=>{
  let requests=0
  const archive=new PMTiles(new OfflineArchiveSource('https://local.test/zona.pmtiles',async(url,options)=>{
    requests++
    assert.equal(options,undefined) // No Range request against the precache.
    return fullResponse()
  }))
  const meta=await archive.getMetadata()
  assert.ok(meta.vector_layers.find(layer=>layer.id==='roads'&&layer.fields.name))
  const territories=JSON.parse(await readFile(new URL('../public/territorios.geojson',import.meta.url),'utf8'))
  const coordinates=territories.features.find(feature=>feature.properties.territorio==='T29').geometry.coordinates.flat(3)
  // Use a vertex of the real selected territory to choose a local vector tile.
  const lng=coordinates[0],lat=coordinates[1],zoom=15,n=2**zoom
  const x=Math.floor((lng+180)/360*n)
  const y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n)
  const tile=await archive.getZxy(zoom,x,y)
  assert.ok(tile)
  const roads=new VectorTile(new Pbf(new Uint8Array(tile.data))).layers.roads
  assert.ok(roads&&Array.from({length:roads.length},(_,i)=>roads.feature(i).properties.name).some(Boolean))
  assert.equal(requests,1)
})

test('un fallo de carga puede reintentarse y una petición cancelada no cancela el archivo compartido',async()=>{
  let requests=0
  const source=new OfflineArchiveSource('zone',async()=>++requests===1?new Response('',{status:503}):fullResponse())
  await assert.rejects(source.getBytes(0,8),/503/)
  assert.equal(new TextDecoder().decode((await source.getBytes(0,7)).data),'PMTiles')
  const controller=new AbortController();controller.abort()
  await assert.rejects(source.getBytes(0,8,controller.signal),{name:'AbortError'})
  assert.equal(requests,2)
})
