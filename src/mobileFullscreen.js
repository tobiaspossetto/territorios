// Ejecutar después de la acción original del toque; no bloquear controles.
export function firstTouchFullscreen(doc, win, nav) {
  if (!win.matchMedia('(max-width: 720px), (pointer: coarse)').matches
    || win.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
    || nav.standalone || !doc.fullscreenEnabled || !doc.documentElement.requestFullscreen) return () => {}
  const cleanup = () => doc.removeEventListener('click', onTouch)
  const onTouch = event => {
    if (!event.isTrusted) return
    cleanup()
    if (doc.fullscreenElement) return
    try {
      Promise.resolve(doc.documentElement.requestFullscreen({navigationUI:'hide'})).catch(() => {})
    } catch { /* Rechazo o falta de soporte: continuar en el navegador. */ }
  }
  doc.addEventListener('click', onTouch, {passive:true})
  return cleanup
}
