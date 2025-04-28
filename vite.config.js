import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Doprava 3.0',
        short_name: 'Doprava',
        description: 'Kalkulačka pro výpočet dopravy',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
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
    strictPort: true // Toto zajistí, že se použije pouze specifikovaný port
  }
})
