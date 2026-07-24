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

export const IconSun = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const IconMoon = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12.8A8 8 0 1 1 11.2 3 6.2 6.2 0 0 0 21 12.8Z" />
  </svg>
)

export const IconTap = (p) => (
  <svg {...base} {...p}>
    <path d="M9 11V6a2 2 0 0 1 4 0v5" />
    <path d="M13 11V9a2 2 0 0 1 4 0v3" />
    <path d="M17 12a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3l-2.3-4a2 2 0 0 1 3.4-2L9 12" />
  </svg>
)

export const IconZoom = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16" y1="16" x2="21" y2="21" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)

export const IconPin = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

export const IconSearch = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
)

// Logo WhatsApp (relleno, color de marca propio — no hereda currentColor)
export const IconWhatsapp = (p) => (
  <svg viewBox="0 0 32 32" width="26" height="26" {...p}>
    <path fill="#25D366" d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.6c1.7.9 3.6 1.4 5.5 1.4h.3c6.6 0 12-5.4 12-12S22.6 3 16 3Z" />
    <path fill="#fff" d="M12.4 9.1c-.3-.6-.5-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.8 5.9 5.1 2.9 1.1 3.5.9 4.2.9.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.7-.4-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.4-.2-1.5-.6-2.9-1.8-1.1-.9-1.8-2.1-2-2.5-.2-.3 0-.5.1-.7.2-.2.3-.4.5-.6.2-.2.2-.3.4-.6.1-.2.1-.4 0-.6-.1-.2-.8-1.9-1-2.4Z" />
  </svg>
)

// Logo skyline (mismo del splash) para el título
export const IconLogo = (p) => (
  <svg viewBox="0 0 200 88" width="34" height="18" fill="none" stroke="currentColor"
    strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" {...p}>
    <g opacity="0.45" strokeWidth="2">
      <path d="M100 78 L72 52 M100 78 L86 44 M100 78 L100 38 M100 78 L114 44 M100 78 L128 52" />
    </g>
    <path d="M55 78 H146" />
    <rect x="62" y="60" width="10" height="18" />
    <rect x="74" y="50" width="9" height="28" />
    <path d="M85 78 V44 L91 30 L97 44 V78 Z" />
    <rect x="99" y="54" width="10" height="24" />
    <rect x="111" y="48" width="9" height="30" />
    <rect x="122" y="62" width="12" height="16" />
  </svg>
)
