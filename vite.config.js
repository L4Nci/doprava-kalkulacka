import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        importScripts: ['/clear-api-cache.js'],
        runtimeCaching: [{
          urlPattern: ({ url }) => /^\/(rest|auth)\/v1(?:\/|$)/.test(url.pathname),
          handler: 'NetworkOnly',
          options: { fetchOptions: { cache: 'no-store' } }
        }]
      },
      manifest: {
        name: 'Doprava 3.0',
        short_name: 'Doprava',
        description: 'Kalkulačka pro výpočet dopravy',
        theme_color: '#0077cc',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true, // Toto zajistí, že se použije pouze specifikovaný port
    hmr: {
      timeout: 5000,
      overlay: true
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
