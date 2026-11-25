import {polygonBounds} from './buildingPlaces.js'

const contains = ([x,y],ring) => {
  let hit=false
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j]
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit
  }
  return hit
}
const feature=(id,name,coordinates,approximate=false)=>({type:'Feature',id,properties:{id,name,approximate},geometry:{type:'Polygon',coordinates:[coordinates]}})

export function localGreenAreas(blocks) {
  if(!blocks)return []
  const areas=[]
  for(const [territory,block,id,name] of [['T25','2','open-t25','Descampado'],['T36','4','field-t36','Área deportiva']]) {
    const f=blocks.features.find(f=>f.properties.territorio===territory&&String(f.properties.manzana)===block)
    if(f)areas.push({...f,id,properties:{id,name,approximate:territory==='T25'}})
  }
  // Contornos de prueba estimados de las capturas: no son límites catastrales.
  areas.push(feature('field-north','Área deportiva',[
    [-62.06593,-31.42485],[-62.06455,-31.42511],[-62.06508,-31.42643],[-62.06641,-31.42611],[-62.06593,-31.42485],
  ],true))
  areas.push(feature('field-east','Área deportiva',[
    [-62.06395,-31.4345],[-62.06215,-31.43485],[-62.06245,-31.43605],[-62.06422,-31.4357],[-62.06395,-31.4345],
  ],true))
  return areas
}

export function findCentennialPark(pois,landuse) {
  const parkName=/parque\s+(?:cincuentenario|centenario)/i
  const poi=pois.find(f=>Object.values(f.properties||{}).some(v=>typeof v==='string'&&parkName.test(v)))
  if(!poi||poi.geometry?.type!=='Point')return null
  const center=poi.geometry.coordinates
  const name=Object.values(poi.properties).find(v=>typeof v==='string'&&parkName.test(v))
  const candidates=[]
  for(const f of landuse) {
    if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))continue
    const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates
    for(const polygon of polygons) {
      if(!contains(center,polygon[0])||polygon.slice(1).some(h=>contains(center,h)))continue
      const b=polygonBounds(polygon),area=(b[2]-b[0])*(b[3]-b[1])
      if(area>0&&area<.00005)candidates.push({polygon,area,park:/park|recreation/.test(String(f.properties?.class||''))})
    }
  }
  candidates.sort((a,b)=>Number(b.park)-Number(a.park)||a.area-b.area)
  return {center,name,feature:candidates.length?{type:'Feature',id:'park-centennial',properties:{id:'park-centennial',name,approximate:false},geometry:{type:'Polygon',coordinates:candidates[0].polygon}}:null}
}
