import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function commitSha(): string | null {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return null;
  }
}

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(commitSha()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'maskable-icon-512x512.png'],
      manifest: {
        name: 'SpendShare',
        short_name: 'SpendShare',
        description: 'Offline-first expense splitting for households and groups',
        theme_color: '#f3f6f4',
        background_color: '#f3f6f4',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // pdf.js is only needed when a user scans a PDF receipt, and scanning
        // requires network anyway — lazy-load it on demand instead of precaching
        // ~400 KB into every install.
        globIgnores: ['**/pdf-*.js'],
        // Firestore is excluded: its SDK manages offline persistence internally.
        // Intercepting Firestore's streaming channels (/Write/channel, /Listen/channel)
        // with a Workbox cache strategy breaks real-time listeners.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**', '**/*.spec.ts', '**/firestore.rules.test.ts'],
  },
});
