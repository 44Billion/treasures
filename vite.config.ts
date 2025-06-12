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
    https: false, // Set to true for production testing
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Critical: Keep React and all React-dependent libraries together
          // This prevents timing issues with React context creation
          if (id.includes('node_modules')) {
            // PRIORITY 1: React core and anything that creates contexts
            // These MUST be in the main vendor chunk to prevent timing issues
            const reactCoreLibraries = [
              'react', 'react-dom', 'react-router', 'react-hook-form', 
              'react-day-picker', 'react-leaflet', 'react-zoom-pan-pinch',
              '@radix-ui', '@tanstack', '@hookform', '@nostrify/react', 
              'next-themes', 'class-variance-authority', 'clsx', 'tailwind-merge'
            ];
            
            if (reactCoreLibraries.some(lib => id.includes(lib))) {
              return 'vendor';
            }
            
            // PRIORITY 2: Separate large non-React dependencies that don't create contexts
            if (id.includes('@nostrify/nostrify') || id.includes('nostr-tools')) {
              return 'vendor-nostr';
            }
            if (id.includes('leaflet') && !id.includes('react-leaflet')) {
              return 'vendor-map';
            }
            if (id.includes('date-fns') || id.includes('qrcode')) {
              return 'vendor-utils';
            }
            
            // PRIORITY 3: All other node_modules (utilities, etc.)
            return 'vendor-misc';
          }
          
          // Feature-based chunks for application code only
          if (id.includes('src/features/auth')) {
            return 'feature-auth';
          }
          if (id.includes('src/features/map')) {
            return 'feature-map';
          }
          if (id.includes('src/features/geocache')) {
            return 'feature-geocache';
          }
          if (id.includes('src/features/offline')) {
            return 'feature-offline';
          }
          if (id.includes('src/features/profile')) {
            return 'feature-profile';
          }
          if (id.includes('src/features/logging')) {
            return 'feature-logging';
          }
          
          // Shared chunks
          if (id.includes('src/shared/components')) {
            return 'shared-components';
          }
          if (id.includes('src/shared/stores')) {
            return 'shared-stores';
          }
          if (id.includes('src/shared')) {
            return 'shared-utils';
          }
          
          // Pages
          if (id.includes('src/pages')) {
            return 'pages';
          }
        }
      }
    },
    // Increase chunk size warning limit since we're optimizing
    chunkSizeWarningLimit: 1000,
    // Enable source maps for better debugging
    sourcemap: false, // Disable in production for smaller builds
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/]
    }
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
        ],
        skipWaiting: false,
        clientsClaim: false,
      },
      includeAssets: ['favicon.ico', 'icon.png', 'apple-touch-icon.png', 'favicon-16x16.png', 'favicon-32x32.png', 'icon-144x144.png', 'icon-192x192.png', 'icon-192x192-maskable.png', 'icon-512x512.png', 'icon-512x512-maskable.png'],
      manifest: {
        name: 'Treasures - Decentralized Geocaching',
        short_name: 'Treasures',
        description: 'Discover and hide geocaches on the decentralized Nostr network. Share locations, find treasures, and explore the world!',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['games', 'travel', 'lifestyle', 'social'],
        permissions: ['geolocation', 'device-orientation'],
        icons: [
          {
            src: 'icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
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
            src: 'icon.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
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
    setupFiles: './src/tests/setup.ts',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@/features": path.resolve(__dirname, "./src/features"),
      "@/app": path.resolve(__dirname, "./src/app"),
    },
  },
}));
