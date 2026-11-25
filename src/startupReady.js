export function startupReady(state) {
  const appReady=Boolean(state.data&&state.map&&state.publicConfig)
  return appReady
}
export const SPLASH_MINIMUM_MS=2000

export function splashRemaining(startedAt,now) {
  return Math.max(0,SPLASH_MINIMUM_MS-(now-startedAt))
}
