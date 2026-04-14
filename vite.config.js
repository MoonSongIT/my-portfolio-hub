import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import YahooFinanceClass from 'yahoo-finance2'

export default defineConfig(({ mode }) => {
  // vitest 환경에서는 yahoo-finance2 임포트 스킵
  if (mode === 'test') {
    return {
      test: {
        environment: 'node',
        include: ['src/**/*.test.js'],
      },
      resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
      },
    }
  }
  // .env 파일의 모든 변수를 로드 (VITE_ 접두사 없는 것 포함)
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.ANTHROPIC_API_KEY

  return {
  plugins: [
    react(),
    // yahoo-finance2 기반 재무 데이터 프록시 (크럼 인증 자동 처리)
    {
      name: 'yahoo-finance2-proxy',
      configureServer(server) {
        // v3: new YahooFinanceClass() 인스턴스 생성
        const yf = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

        server.middlewares.use('/api/yf2/quoteSummary', async (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost')
            const ticker = url.searchParams.get('ticker')
            if (!ticker) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              return res.end(JSON.stringify({ error: 'ticker 파라미터 필요' }))
            }

            const result = await yf.quoteSummary(ticker, {
              modules: ['summaryProfile', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'price'],
            })

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result))
          } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ _error: err.message }))
          }
        })
      },
    },
    // Claude API 로컬 프록시 미들웨어 (개발 서버 내장)
    {
      name: 'claude-api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/claude', async (req, res, next) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            })
            return res.end()
          }

          if (req.method !== 'POST') return next()

          let body = ''
          req.on('data', (chunk) => { body += chunk.toString() })
          req.on('end', async () => {
            try {
              const { systemPrompt, messages, maxTokens = 4096 } = JSON.parse(body)

              if (!systemPrompt || !messages?.length) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: '필수 파라미터 누락 (systemPrompt, messages)' }))
              }

              if (!apiKey) {
                console.error('[Claude Proxy] ANTHROPIC_API_KEY 미설정!')
                res.writeHead(500, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: 'API 키 미설정. .env 파일에 ANTHROPIC_API_KEY를 확인하세요.' }))
              }

              console.log(`[Claude Proxy] 요청 → model: claude-sonnet-4-6, messages: ${messages.length}`)

              const upstream = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-6',
                  max_tokens: maxTokens,
                  system: systemPrompt,
                  messages,
                }),
              })

              const data = await upstream.json()

              if (!upstream.ok) {
                console.error(`[Claude Proxy] API 오류 ${upstream.status}:`, JSON.stringify(data).substring(0, 200))
                res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: `Claude API Error: ${upstream.status}`, details: data }))
              }

              console.log(`[Claude Proxy] 성공 ✅ stop_reason: ${data.stop_reason}`)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(data))
            } catch (err) {
              console.error('[Claude Proxy] 예외 발생:', err.message)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: '프록시 오류', message: err.message }))
            }
          })
        })
      },
    },
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
      '/api/naver': {
        target: 'https://m.stock.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/naver/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Referer': 'https://m.stock.naver.com',
        },
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
  }
})
