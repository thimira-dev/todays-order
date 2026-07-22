import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest', // custom src/sw.js — adds push notification handlers
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt', // wait for user confirmation before activating a new SW
      injectRegister: false, // registered manually in index.html — avoids double registration
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
      manifest: {
        name: 'Bakery Run',
        short_name: 'Bakery',
        theme_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
