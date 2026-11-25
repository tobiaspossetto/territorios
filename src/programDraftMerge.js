const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const key=(item,index)=>String(item.id??index)

// Combinar solamente los campos editados respecto del borrador base.
// Los movimientos del mapa llegan por otra transacción y no deben perderse.
export function mergeProgramDraft(latest,incoming,base) {
  const mergeRows=(remote,local,original,details=false)=>{
    const remoteById=new Map(remote.map((row,index)=>[key(row,index),row]))
    const baseById=new Map(original.map((row,index)=>[key(row,index),row]))
    const localIds=new Set(local.map(key))
    const result=local.flatMap((row,index)=>{
      const id=key(row,index),before=baseById.get(id),current=remoteById.get(id)
      if(!before)return [row]
      if(!current)return equal(row,before)?[]:[row]
      const merged={...current}
      for(const field of Object.keys(row)){
        if(!details&&field==='detalles')continue
        if(!equal(row[field],before[field]))merged[field]=row[field]
      }
      if(!details)merged.detalles=mergeRows(current.detalles||[],row.detalles||[],before.detalles||[],true)
      return [merged]
    })
    // Conservar filas agregadas desde otra sesión; respetar las borradas aquí.
    remote.forEach((row,index)=>{const id=key(row,index);if(!localIds.has(id)&&!baseById.has(id))result.push(row)})
    return result
  }
  return mergeRows(latest||[],incoming||[],base||[])
}
