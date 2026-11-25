// A completed visit uses its end date; an ongoing visit uses its start date.
export function lastTerritoryVisit(rows) {
  return rows.flatMap(row => [row.inicio, row.fin]).filter(Boolean).sort().at(-1) || null
}
