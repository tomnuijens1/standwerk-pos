/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // App-shell caching alleen (fase 1): installeerbaar en bestand tegen een korte
      // wifi-hapering op het festivalterrein. Geen offline data-sync/queue — dat is fase 4.
      workbox: {
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Standwerk POS',
        short_name: 'Standwerk',
        description: 'Kassasysteem en voorraadbeheer voor festivals, tours en evenementen',
        theme_color: '#17162B',
        background_color: '#ECEEF3',
        display: 'standalone',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: false,
  },
})
