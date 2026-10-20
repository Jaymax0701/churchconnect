import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Register the service worker automatically and update it when new content is available.
      // 'autoUpdate' silently refreshes the SW on next navigation — a safe default for v1.
      registerType: 'autoUpdate',

      // Inline the SW registration script into the built HTML (no separate registerSW.js chunk).
      injectRegister: 'inline',

      // Manifest is managed via public/manifest.webmanifest — do not let the plugin re-generate it.
      manifest: false,

      // Workbox configuration
      workbox: {
        // Pre-cache the built application shell (JS, CSS, HTML, fonts, icons in /assets/).
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],

        // ──────────────────────────────────────────────────────────────────────
        // Runtime caching — purposefully conservative.
        // Supabase API calls, auth tokens, private member data, and admin
        // responses are intentionally excluded. Only static, public assets
        // are cached at runtime.
        // ──────────────────────────────────────────────────────────────────────
        runtimeCaching: [
          // Google Fonts stylesheets — StaleWhileRevalidate so updates propagate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cc-google-fonts-stylesheets',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts files — CacheFirst (font binaries rarely change)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cc-google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Material Symbols icon font (Google APIs CDN)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/icon.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cc-material-symbols',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Own static assets served from /assets/ (images, icons, etc.)
          // NetworkFirst ensures fresh content is preferred; falls back to cache offline.
          {
            urlPattern: /\/assets\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cc-static-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Serve the offline fallback for any failed navigation request.
        // Uses navigateFallback (the correct Workbox option) pointing to our
        // pre-cached /offline.html page.
        navigateFallback: '/offline.html',

        // Do NOT show offline.html for:
        //   1. Supabase API / Auth / Realtime requests
        //   2. Static file requests (anything with an extension like .js, .png)
        navigateFallbackDenylist: [
          /^https:\/\/.*\.supabase\.co\/.*/,
          /[^/]+\.[^/]+$/,
        ],
      },

      // Dev options — enable SW in development so you can test PWA behaviour locally.
      devOptions: {
        enabled: false, // Set to true temporarily if you need to test SW in dev
        type: 'module',
      },
    }),
  ],
})
