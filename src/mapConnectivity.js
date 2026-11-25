// HEAD bypasses the service worker's GET cache: a cached map is not proof of a network.
export async function confirmMapConnection(url,{signal,fetcher=globalThis.fetch}={}) {
  try {
    const response=await fetcher(url,{method:'HEAD',cache:'no-store',signal})
    return response.ok
  } catch { return false }
}
