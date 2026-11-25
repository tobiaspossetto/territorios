// Keep semantic colors (program assignments and metric scale) unchanged.
// Only contrast and neutral surfaces vary between themes.
export function mapAppearance(theme) {
  const dark = theme === 'dark'
  return {
    dark,
    stroke: dark ? '#d6b96d' : '#8a6a12',
    label: dark ? '#f4e8c6' : '#4a3a08',
    labelHalo: dark ? '#17202b' : 'rgba(255,255,255,.95)',
    blockLabel: dark ? '#f3f5f8' : '#0f1520',
    blockBorder: dark ? 'rgba(222,198,136,.6)' : 'rgba(138,106,18,.45)',
    neutralFill: dark ? '#5b6471' : '#ddd9d2',
    neutralStroke: dark ? '#a7b2c0' : '#aaa49b',
    metricStroke: dark ? 'rgba(226,237,250,.6)' : 'rgba(20,30,60,.5)',
    cross: dark ? '#ff9a9a' : '#c65f5f',
    crossHalo: dark ? 'rgba(20,26,36,.9)' : 'rgba(255,255,255,.65)',
  }
}
