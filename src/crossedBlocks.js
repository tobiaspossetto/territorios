export function crossedBlocks(data,{mode,selected,explicit=false,excluded=[]}) {
  if(!data||mode==='metrica')return null
  const features=data.features.filter(({properties:p})=>{
    const number=String(p.manzana)
    if(selected&&p.territorio===selected&&explicit)return excluded.includes(number)
    return Array.isArray(p.manzanas_activas)&&!p.manzanas_activas.map(String).includes(number)
  })
  return features.length?{type:'FeatureCollection',features}:null
}

export function crossedBlockLayers(layer,selected) {
  if(Array.isArray(selected)) {
    const filter=['in',['get','territorio'],['literal',selected]]
    return [{...layer,filter},{...layer,id:`${layer.id}-near`,minzoom:15.5,filter:['!',filter]}]
  }
  return [
    {...layer,filter:['==',['get','territorio'],selected||'']},
    {...layer,id:`${layer.id}-near`,minzoom:15.5,filter:['!=',['get','territorio'],selected||'']},
  ]
}
