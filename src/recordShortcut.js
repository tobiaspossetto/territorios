// Resume only unfinished work. Completed visits must never prefill a new visit.
export function startedTerritoryRecord(rows, territorio) {
  return (rows || []).filter(row => row.territorio === territorio && row.inicio && !row.fin)
    .sort((a,b) => String(b.inicio).localeCompare(String(a.inicio)) || (b.createdOrder || 0) - (a.createdOrder || 0))[0] || null
}
