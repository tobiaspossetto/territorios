import test from 'node:test'
import assert from 'node:assert/strict'
import {confirmMapConnection} from '../src/mapConnectivity.js'

test('confirma la red con HEAD sin caché aunque el navegador indique offline',async()=>{
  const controller=new AbortController()
  let request
  const result=await confirmMapConnection('https://map.example/style.json',{
    signal:controller.signal,
    fetcher:async(url,options)=>{request={url,options};return {ok:true}},
  })
  assert.equal(result,true)
  assert.equal(request.options.method,'HEAD')
  assert.equal(request.options.cache,'no-store')
  assert.equal(request.options.signal,controller.signal)
})
test('conserva el respaldo offline ante errores HTTP, fallos de red y cancelación',async()=>{
  for(const fetcher of [async()=>({ok:false}),async()=>{throw new Error('Network failure')},async()=>{throw new DOMException('Aborted','AbortError')}]){
    assert.equal(await confirmMapConnection('https://map.example/style.json',{fetcher}),false)
  }
})
