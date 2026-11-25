// Samsung's native-theme preference requires advertising both supported themes.
// This is not an opt-out from Samsung's separate "Force Dark Only" setting.
export function documentColorSchemes(theme,userAgent='') {
  return /SamsungBrowser\//i.test(userAgent) ? 'light dark' : theme==='dark' ? 'dark' : 'only light'
}

// Browser-owned controls and metadata must follow the same explicit app theme.
// Keep DOM updates independent of storage: some devices deny localStorage.
export function applyDocumentTheme(theme,doc=document) {
  const dark=theme==='dark'
  doc.documentElement.dataset.appTheme=dark?'dark':'light'
  const scheme=doc.querySelector('meta[name="color-scheme"]')
  if(scheme)scheme.content=documentColorSchemes(theme,doc.defaultView?.navigator?.userAgent||'')
  const chrome=doc.querySelector('meta[name="theme-color"]')
  if(chrome)chrome.content=dark?'#1c1b19':'#f5f3ef'
}
