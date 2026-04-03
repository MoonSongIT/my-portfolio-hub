import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'My Portfolio Hub',
        short_name: 'Portfolio Hub',
        description: '매매 심리를 기록하고 AI로 돌아보는 개인 투자 성장 도구',
        theme_color: '#1d4ed8',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        lang: 'ko',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',          // SPA 오프라인 라우팅 필수
        navigateFallbackDenylist: [/^\/api\//],  // API 경로는 제외
        runtimeCaching: [
          {
            // Yahoo Finance API → StaleWhileRevalidate (캐시 우선, 백그라운드 갱신)
            urlPattern: /^https:\/\/query[12]\.finance\.yahoo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'yahoo-finance-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }, // 5분
            },
          },
          {
            // 로컬 API 프록시 → NetworkFirst
            urlPattern: /^http:\/\/localhost:3001\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'local-api-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // 개발 모드에서는 SW 비활성화 (핫 리로드 충돌 방지)
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
      '/api/yahoo-v10': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-v10/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
      '/api/claude': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-chart-recharts': ['recharts'],
          'vendor-chart-lw': ['lightweight-charts'],
          'vendor-zustand': ['zustand', 'immer'],
        },
      },
    },
  },
})
