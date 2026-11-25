const inside = ([x,y],ring) => {
  let result=false
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j]
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result
  }
  return result
}

export function pickBuildingPolygon(geometry, point) {
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates
  const contained=polygons.findIndex(p=>inside(point,p[0])&&!p.slice(1).some(hole=>inside(point,hole)))
  let index=contained
  if(index<0) {
    // Un techo extruido puede tocarse fuera de su huella: elegir el contorno más cercano.
    let closest=Infinity
    polygons.forEach((polygon,i)=>polygon[0].slice(1).forEach((b,j)=>{
      const a=polygon[0][j],dx=(b[0]-a[0])*.85,dy=b[1]-a[1],px=(point[0]-a[0])*.85,py=point[1]-a[1]
      const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)))
      const distance=(px-t*dx)**2+(py-t*dy)**2
      if(distance<closest){closest=distance;index=i}
    }))
  }
  return { geometry:{type:'Polygon',coordinates:polygons[index]}, component:index, grouped:polygons.length>1 }
}
