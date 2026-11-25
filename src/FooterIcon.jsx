import { IconCalendar, IconMap, IconChart, IconGuide, IconAdmin } from './icons.jsx'

const outlineIcons = { programa: IconCalendar, mapa: IconMap, metrica: IconChart, guia: IconGuide, admin: IconAdmin }

// A pale interior and violet contour distinguish selection without a solid blob.
export default function FooterIcon({ name, selected }) {
  const Outline = outlineIcons[name]
  if (name === 'metrica' && selected) return (
    <svg className="footer-icon-selected" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="13" width="3" height="8" rx=".5" />
      <rect x="10.5" y="4" width="3" height="17" rx=".5" />
      <rect x="17.5" y="9" width="3" height="12" rx=".5" />
    </svg>
  )
  return <Outline className={selected ? 'footer-icon-selected' : undefined} aria-hidden="true" />
}
