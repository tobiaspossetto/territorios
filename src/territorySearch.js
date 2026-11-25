export function searchTerritories(data,query='') {
  const items=[...new Map((data?.features||[]).map(({properties:p})=>[p.territorio,{id:p.territorio,zona:p.zona,n:Number(String(p.territorio).replace(/^T/i,''))}])).values()]
    .filter(item=>Number.isFinite(item.n)).sort((a,b)=>a.n-b.n)
  const number=query.trim().replace(/^t\s*/i,'')
  if(!number)return items
  if(!/^\d+$/.test(number))return []
  const normalized=String(Number(number))
  return items.filter(item=>String(item.n).startsWith(normalized))
    .sort((a,b)=>Number(b.n===Number(number))-Number(a.n===Number(number))||a.n-b.n)
}
