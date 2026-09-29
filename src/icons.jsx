// Íconos minimalistas (line-icons SVG, heredan color con currentColor)
const base = {
  viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
}

export const IconMap = (p) => (
  <svg {...base} {...p}>
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
)

export const IconChart = (p) => (
  <svg {...base} {...p}>
    <line x1="5" y1="21" x2="5" y2="13" />
    <line x1="12" y1="21" x2="12" y2="4" />
    <line x1="19" y1="21" x2="19" y2="9" />
  </svg>
)

// sendero + destino: mismo motivo del "camino hacia la meta" para Campaña
export const IconPath = (p) => (
  <svg {...base} {...p}>
    <path d="M3.5 19c2.5-.5 3-2.5 5-3.5s2.5 1.5 4.5.8 1.8-3.3 3.8-4.3" />
    <circle cx="18.5" cy="6.5" r="2" />
  </svg>
)


export const IconInfo = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSearch = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
)

export const IconLock = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)

export const IconLockOpen = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 7.4-2" />
  </svg>
)

// planilla/registro (filas tipo tabla)
export const IconList = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 10h16M9 4v16" />
  </svg>
)

export const IconExpand = (p) => (
  <svg {...base} {...p}>
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
)

export const IconCollapse = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4" />
  </svg>
)

export const IconLogout = (p) => (
  <svg {...base} {...p}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="M13 8l4 4-4 4M7.5 12H21" />
  </svg>
)

// Logo WhatsApp (relleno, color de marca propio — no hereda currentColor)
export const IconWhatsapp = (p) => (
  <svg viewBox="0 0 32 32" width="26" height="26" {...p}>
    <path fill="#25D366" d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.6c1.7.9 3.6 1.4 5.5 1.4h.3c6.6 0 12-5.4 12-12S22.6 3 16 3Z" />
    <path fill="#fff" d="M12.4 9.1c-.3-.6-.5-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.8 5.9 5.1 2.9 1.1 3.5.9 4.2.9.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.7-.4-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.4-.2-1.5-.6-2.9-1.8-1.1-.9-1.8-2.1-2-2.5-.2-.3 0-.5.1-.7.2-.2.3-.4.5-.6.2-.2.2-.3.4-.6.1-.2.1-.4 0-.6-.1-.2-.8-1.9-1-2.4Z" />
  </svg>
)

