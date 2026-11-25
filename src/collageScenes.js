// Selected individual transparent artwork; content hashes keep cached images current.
export const COLLAGE_SCENES = [
  {
    "id": "predicacion",
    "name": "Predicación histórica",
    "src": "splash-scenes/predicacion-9a29292838.webp"
  },
  {
    "id": "publicaciones",
    "name": "Publicaciones",
    "src": "splash-scenes/publicaciones-1683d3be88.webp"
  },
  {
    "id": "prensa",
    "name": "Prensa y cine",
    "src": "splash-scenes/prensa-b5e68ce5e2.webp"
  },
  {
    "id": "biblia",
    "name": "Biblia",
    "src": "splash-scenes/biblia-ae48f555ca.webp"
  },
  {
    "id": "predicadoras",
    "name": "Predicadoras",
    "src": "splash-scenes/predicadoras-d08bff3e00.webp"
  },
  {
    "id": "asamblea",
    "name": "Asamblea",
    "src": "splash-scenes/asamblea-50766e5053.webp"
  },
  {
    "id": "reunion",
    "name": "Reunión al aire libre",
    "src": "splash-scenes/reunion-63a0c5ccd2.webp"
  },
  {
    "id": "carritos",
    "name": "Carritos",
    "src": "splash-scenes/carritos-02f7c165db.webp"
  },
  {
    "id": "comunidad",
    "name": "Comunidad",
    "src": "splash-scenes/comunidad-334da4958c.webp"
  },
  {
    "id": "radio",
    "name": "Radio WBBR",
    "src": "splash-scenes/radio-00cbd4d50d.webp"
  },
  {
    "id": "camioneta",
    "name": "Camioneta",
    "src": "splash-scenes/camioneta-72ff23f844.webp"
  }
]

export function shuffleCollageScenes(random=Math.random) {
  const scenes=[...COLLAGE_SCENES]
  for(let index=scenes.length-1;index>0;index--){
    const target=Math.floor(random()*(index+1))
    ;[scenes[index],scenes[target]]=[scenes[target],scenes[index]]
  }
  return scenes
}
