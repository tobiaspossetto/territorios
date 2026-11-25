// Workbox precaches the complete archive (HTTP 200), not individual HTTP ranges.
// Read that small local file once, then satisfy PMTiles byte requests in memory.
export class OfflineArchiveSource {
  constructor(url,fetcher=(...args)=>globalThis.fetch(...args)) {
    this.url=url
    this.fetcher=fetcher
    this.pending=null
  }
  getKey(){return this.url}
  async getBytes(offset,length,signal) {
    if(signal?.aborted)throw new DOMException('Aborted','AbortError')
    if(!this.pending){
      this.pending=this.fetcher(this.url).then(async response=>{
        if(!response.ok)throw new Error(`Mapa offline no disponible (${response.status})`)
        return response.arrayBuffer()
      }).catch(error=>{this.pending=null;throw error})
    }
    const archive=await this.pending
    if(signal?.aborted)throw new DOMException('Aborted','AbortError')
    return {data:archive.slice(offset,offset+length)}
  }
}
