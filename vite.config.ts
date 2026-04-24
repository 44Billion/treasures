import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // https: false, // Set to true for production testing
  },
  build: {
    target: 'esnext',
    // Enable source maps for better debugging
    sourcemap: false, // Disable in production for smaller builds
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/]
    },
    rollupOptions: {},
  },
  plugins: [
    react(),
    // Add bundle analyzer in analyze mode
    ...(mode === 'analyze' ? [
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      })
    ] : []),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Exclude the large cities-data chunk from precaching
        // It will be loaded on-demand when needed and cached by the browser
        globIgnores: ['**/cities-data-*.js', '**/citiesData-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit for large bundles
        cleanupOutdatedCaches: true, // Automatically cleanup old caches
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Cache navigation requests (HTML pages) for offline access
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'favicon-16x16.png', 'favicon-32x32.png', 'icon-192x192.png', 'icon-192x192-maskable.png', 'icon-512x512.png', 'icon-512x512-maskable.png'],
      manifest: {
        name: 'Treasures - Decentralized Geocaching',
        short_name: 'Treasures',
        description: 'Hide and discover geocaches on the decentralized Nostr network. Treasures is a free, open-source geocaching app. Share locations, log finds, and explore the world!',
        theme_color: '#299e5e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['games', 'travel', 'lifestyle', 'social'],

        scope_extensions: [
          {
            origin: 'treasures.to'
          },
          {
            origin: '*.treasures.to'
          },
          {
            origin: 'https://treasures.to'
          },
          {
            origin: 'https://*.treasures.to'
          },
          {
            origin: 'http://treasures.to'
          },
          {
            origin: 'http://*.treasures.to'
          }
        ],
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
}));
