import { MAPTILER_KEY } from './theme.js'

export async function geocodeAddress(address, zona) {
  if (!MAPTILER_KEY || !address.trim()) return null
  const locality = zona === 'Ciudad Frontera' ? 'Frontera, Santa Fe'
    : ['Josefina', 'Acapulco', 'Estación Frontera'].includes(zona) ? `${zona}, Santa Fe`
      : 'San Francisco, Córdoba'
  const params = new URLSearchParams({ key: MAPTILER_KEY, country: 'ar', language: 'es', autocomplete: 'false', types: 'address', limit: '3', bbox: '-62.18,-31.55,-61.90,-31.30' })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const query = `${address.trim()}, ${locality}, Argentina`
    const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error('No se pudo consultar la dirección')
    const data = await response.json()
    const match = data.features?.find(f => f.place_type?.includes('address') && Array.isArray(f.center) && f.center.length === 2
      && f.center[0] >= -62.18 && f.center[0] <= -61.90 && f.center[1] >= -31.55 && f.center[1] <= -31.30)
    return match?.center || null
  } finally { clearTimeout(timeout) }
}
