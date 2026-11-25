// Referencias geográficas aportadas por el usuario. No usar índices de componentes
// como claves estables: los tiles pueden agrupar/reordenar las huellas.
export const BUILDING_PLACES = [
  { id:'supermarket', name:'Supermercado', icon:'cart', color:'#e76b64', bounds:[
    [-62.0671615,-31.4348882,-62.0666465,-31.4344694],
    [-62.0668718,-31.4353619,-62.0660806,-31.4346731],
    [-62.0663568,-31.4359112,-62.0656031,-31.4351125],
    [-62.066845,-31.4351514,-62.066617,-31.4349591],
  ] },
  { id:'bank',name:'Banco',icon:'bank',color:'#b596dc',bounds:[[-62.0670059,-31.4343595,-62.066853,-31.4341902]] },
  { id:'police',name:'Policía',icon:'shield',color:'#73a9dd',bounds:[
    [-62.0663595,-31.4342703,-62.0662066,-31.434133],
    [-62.0662415,-31.4342726,-62.0661101,-31.4341742],
    [-62.0661718,-31.4342909,-62.0661208,-31.4342405],
  ] },
  { id:'sport-south',name:'Deporte',icon:'ball',color:'#b99677',bounds:[[-62.0638114,-31.4349843,-62.0633742,-31.4345884]] },
  { id:'sport-t36-field',name:'Defensores de Frontera · Fútbol',icon:'ball',color:'#b99677',coordinates:[-62.06733,-31.4402285],bounds:[] },
  { id:'jw',name:'JW',icon:'jw',color:'#447ac0',bounds:[
    [-62.0686448,-31.4404423,-62.0684999,-31.4402066],
  ] },
  { id:'hospital',name:'Hospital',icon:'hospital',color:'#e76b64',bounds:[
    [-62.0684892,-31.4287409,-62.0670247,-31.4274524],
    [-62.068913,-31.4283267,-62.0682853,-31.4278049],
    [-62.0680252,-31.4275416,-62.0677704,-31.4273242],
  ] },
  { id:'fuel',name:'Estación de servicio',icon:'fuel',color:'#f2bd86',bounds:[
    [-62.0642084,-31.4204852,-62.0638651,-31.4201922],
    [-62.0643452,-31.4206043,-62.0641145,-31.4205264],
    [-62.0644096,-31.4203982,-62.0642915,-31.4201625],
    [-62.0639053,-31.4206088,-62.0637631,-31.420444],
    [-62.0639268,-31.4206363,-62.0638463,-31.4205196],
    [-62.0639348,-31.4206912,-62.0638624,-31.4206455],
  ] },
  { id:'sport-north',name:'Deporte',icon:'ball',color:'#b99677',bounds:[
    [-62.0656836,-31.42542,-62.0652384,-31.4250332],
    [-62.0652571,-31.4250332,-62.0651096,-31.424905],
  ] },
  { id:'factory-south',name:'Fábrica',icon:'factory',color:'#b29170',bounds:[[-62.070466,-31.4486757,-62.0695138,-31.4477078]] },
  { id:'factory-t36',name:'Fábrica',icon:'factory',color:'#b29170',bounds:[
    [-62.0674431,-31.4394652,-62.067081,-31.4391539],
    [-62.06736,-31.4391448,-62.067014,-31.4388702],
    [-62.0674378,-31.4395338,-62.067132,-31.4394125],
    [-62.0675424,-31.4394125,-62.067419,-31.4393004],
  ] },
  {id:'school-east',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-62.0585302,-31.4265872,-62.0579535,-31.426205],
    [-62.0586321,-31.426601,-62.058439,-31.4262142],
    [-62.0586804,-31.4267291,-62.0584175,-31.4265987],
  ]},
  {id:'school-t25',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-62.0626715,-31.4334555,-62.062237,-31.4332198],
    [-62.0623362,-31.4332976,-62.0621082,-31.4329223],
  ]},
  {id:'school-southeast',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-62.0539623,-31.4539796,-62.0537344,-31.4537508],
    [-62.0540857,-31.4538126,-62.0539168,-31.4536318],
    [-62.0538604,-31.4539476,-62.0536137,-31.4535563],
  ]},
  {id:'hospital-east',name:'Hospital',icon:'hospital',color:'#e76b64',bounds:[[-62.0630255,-31.4392821,-62.0626205,-31.4389983]]},
  {id:'hospital-southeast',name:'Hospital',icon:'hospital',color:'#e76b64',bounds:[[-62.0541608,-31.4545104,-62.0538148,-31.4542542]]},
  {id:'electricity',name:'Electricidad',icon:'electricity',color:'#7cad78',bounds:[[-62.062819,-31.4373987,-62.0626581,-31.4372591]]},
  {id:'school-central-south',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-62.0651338,-31.435648,-62.0649299,-31.4355381],
    [-62.0651552,-31.4357487,-62.0649514,-31.4356365],
    [-62.0652437,-31.436021,-62.0649299,-31.4357281],
  ]},
  {id:'school-central-north',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-62.0654905,-31.4348607,-62.0651767,-31.434641],
    [-62.0653269,-31.4351811,-62.0650613,-31.4347715],
  ]},
  {id:'school-north',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-62.0602173,-31.4191966,-62.0596004,-31.4189951],
    [-62.0603138,-31.4190455,-62.0601395,-31.418764],
    [-62.0602629,-31.41878,-62.0601127,-31.418622],
  ]},
  {id:'hospital-north',name:'Hospital',icon:'hospital',color:'#e76b64',bounds:[[-62.0584765,-31.4182879,-62.0583424,-31.4181505]]},
  {id:'police-east',name:'Policía',icon:'shield',color:'#73a9dd',bounds:[[-61.9913569,-31.4042257,-61.9911826,-31.4040128]]},
  {id:'municipality',name:'Municipalidad',icon:'municipality',color:'#e5c65c',bounds:[[-61.9914213,-31.4044158,-61.991255,-31.4042486]]},
  {id:'municipality-central',name:'Municipalidad',icon:'municipality',color:'#e5c65c',bounds:[
    [-62.0655146,-31.4300363,-62.0653215,-31.4297342],
    [-62.0653403,-31.4300684,-62.0651364,-31.4297686],
    [-62.0654985,-31.4301187,-62.0652625,-31.4300134],
    [-62.0653832,-31.4302011,-62.0652786,-31.4300981],
    [-62.0655441,-31.4302492,-62.0653081,-31.4301485],
  ]},
  {id:'school-far-east',name:'Escuela',icon:'school',color:'#a4abb2',bounds:[
    [-61.9936475,-31.4063685,-61.9933257,-31.4061648],
    [-61.9935644,-31.4064853,-61.993382,-31.406396],
  ]},
  {id:'pharmacy',name:'Farmacia',icon:'pill',color:'#e76b64',bounds:[
    [-62.0647609,-31.4274638,-62.0646,-31.4273448],
    [-62.064769,-31.4273448,-62.0647046,-31.4272487],
    [-62.0647341,-31.4273654,-62.0646214,-31.4272578],
  ]},
]

export const BUILDING_TARGETS = BUILDING_PLACES.flatMap(place=>place.bounds.map((bounds,i)=>({id:`${place.id}-${i}`,placeId:place.id,color:place.color,bounds})))

export function polygonBounds(polygon) {
  const points=polygon[0]
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]
}

export function boundsMatch(a,b) {
  const overlap=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]))
  const areaA=(a[2]-a[0])*(a[3]-a[1]),areaB=(b[2]-b[0])*(b[3]-b[1])
  return overlap/(areaA+areaB-overlap||1)>.78
}

export function locateBuildingPlaces(features) {
  const found=new Map()
  for(const feature of features) {
    if(!['Polygon','MultiPolygon'].includes(feature.geometry?.type))continue
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates
    for(const polygon of polygons) {
      const bounds=polygonBounds(polygon)
      const target=BUILDING_TARGETS.find(t=>boundsMatch(bounds,t.bounds))
      if(!target)continue
      const rawHeight=Number(feature.properties?.render_height ?? feature.properties?.height)
      const height=Number.isFinite(rawHeight)&&rawHeight>0?rawHeight:6
      found.set(target.id,{type:'Feature',id:target.id,geometry:{type:'Polygon',coordinates:polygon},properties:{placeId:target.placeId,color:target.color,height:height+.35}})
    }
  }
  return [...found.values()]
}

export function placeCenter(place) {
  if(place.coordinates)return place.coordinates
  const b=place.bounds
  return [b.reduce((s,p)=>s+(p[0]+p[2])/2,0)/b.length,b.reduce((s,p)=>s+(p[1]+p[3])/2,0)/b.length]
}
