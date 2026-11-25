import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' -> rutas relativas (sirve local y en el subpath de GitHub Pages)
export default defineConfig(({ command }) => ({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')),
    __APP_LOCAL__: JSON.stringify(command !== 'build'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // activación y recarga automática coordinadas
      injectRegister: null,
      includeAssets: ['icono.png', 'logo-furgon.png'],
      manifest: {
        name: 'Territorios · Congregación Este',
        short_name: 'Territorios',
        description: 'Gestión de territorios de predicación',
        theme_color: '#242120',
        background_color: '#f7f5f2',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // precachea shell + base offline (pmtiles) + glyphs (pbf). Los .geojson
        // (territorios/manzanas) NO van acá: cambian con cada "actualiza y
        // deploy" y precacheados quedaban pegados a la versión del SW activo
        // hasta que este se actualizara -> con un link a un territorio nuevo
        // el celu podía mostrar datos viejos hasta recargar. Van con
        // NetworkFirst más abajo en vez de precache.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,pmtiles,pbf}'],
        // Download the collage only when selected, rather than also precaching it for Auto.
        globIgnores: ['**/collage-carga.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        skipWaiting: true,      // activa el SW nuevo al toque
        clientsClaim: true,     // toma control de la pestaña sin esperar
        // Cachea los tiles/glyphs de MapTiler: el mapa base no cambia, así que se
        // sirven del disco y no consumen cuota. Caché aparte del de la app: los
        // deploys de datos/código actualizan igual.
        runtimeCaching: [
          {
            urlPattern: /\/splash-scenes\/[^/?]+\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'splash-scenes-v2',
              expiration: {maxEntries:20,maxAgeSeconds:60*60*24*45},
              cacheableResponse: {statuses:[0,200]},
            },
          },
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maptiler-tiles-v2',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 45 },  // 45 días
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // datos de territorios: con conexión, siempre la última versión
            // (red primero); sin conexión, la última copia guardada
            urlPattern: /\/(territorios\.geojson|manzanas\.geojson|meta\.json)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'territorios-data-v2',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },   // SW solo en build/prod -> dev y validación local sin cambios
    }),
  ],
}))
