import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' -> rutas relativas (sirve local y en el subpath de GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',   // al redeployar, actualiza solo (no queda pegada versión vieja)
      injectRegister: 'auto',
      includeAssets: ['icono.png'],
      manifest: {
        name: 'Congregación Este, SF',
        short_name: 'Territorios',
        description: 'Mapa de territorios de predicación',
        theme_color: '#0a0f1c',
        background_color: '#0a0f1c',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // precachea shell + datos (geojson) + base offline (pmtiles) + glyphs (pbf)
        globPatterns: ['**/*.{js,css,html,png,svg,geojson,webmanifest,pmtiles,pbf}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },   // SW solo en build/prod -> dev y validación local sin cambios
    }),
  ],
})
