import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Identifiant unique de ce build : intégré au code de l'appli, et écrit dans
// dist/version.json que le serveur annonce aux téléphones connectés. Un téléphone
// qui voit une version différente de la sienne sait qu'il doit se mettre à jour.
const BUILD_ID = new Date().toISOString();

export default defineConfig({
  base: process.env.VITE_BASE ?? '/sk-tracking/',
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    {
      name: 'sk-build-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'Skull King Scorekeeper',
        short_name: 'Skull King',
        description: 'Track scores for the Skull King card game',
        theme_color: '#1c2541',
        background_color: '#0b132b',
        display: 'standalone',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css|worker)$/i,
            handler: 'StaleWhileRevalidate',
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 50 } },
          },
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /\.pdf$/i],
      },
    }),
  ],
});
