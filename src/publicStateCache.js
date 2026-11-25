// Public map/program data only. Never persist administrator records or permissions.
export function readPublicStateCache(key, storage) {
  try {
    storage??=globalThis.localStorage
    const saved=JSON.parse(storage?.getItem(key)||'null')
    if(saved?.version!==1||!Array.isArray(saved.state?.programAssignments)
      ||!saved.state.summaries||typeof saved.state.summaries!=='object'||Array.isArray(saved.state.summaries))return null
    return saved.state
  } catch { return null }
}

export function writePublicStateCache(key,state,storage) {
  try { storage??=globalThis.localStorage;storage?.setItem(key,JSON.stringify({version:1,savedAt:Date.now(),state}));return true }
  catch { return false }
}
