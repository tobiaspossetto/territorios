export function territorySelection(data,primary,requested=[]) {
  const available=new Map((data?.features||[]).map(feature=>[feature.properties.territorio,feature]))
  return [...new Set([primary,...requested])].filter(id=>available.has(id)).map(id=>available.get(id))
}

export const territorySelectionFilter=ids=>['in',['get','territorio'],['literal',ids]]
