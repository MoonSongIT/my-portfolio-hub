import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'

const { version: APP_VERSION } = JSON.parse(readFileSync('./package.json', 'utf-8'))
import YahooFinanceClass from 'yahoo-finance2'
import { handleDartList } from './server/dartHandler.js'
import { handleEdgarFilings } from './server/edgarHandler.js'
import { handleAgenticRequest } from './server/agenticHandler.js'
import { handleStockUpdate } from './server/stockUpdateHandler.js'
import { handleStockMaster } from './server/stockMaster/index.js'
import { handleAdminUsers } from './server/adminHandler.js'
import { handleDartCalendarDividend, handleDartCalendarEarnings, handleFinnhubCalendarEarnings, handleFinnhubCalendarIpo } from './server/calendarHandler.js'
import { handleSyncUpload, handleSyncDownload } from './server/syncHandler.js'

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
    // DART OpenAPI 프록시 미들웨어 — 한국 공시 조회
    {
      name: 'dart-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/dart/list')) return next()
          const dartKey = req.headers['x-dart-api-key'] || env.DART_API_KEY || ''
          await handleDartList(req, res, dartKey)
        })
      },
    },
    // SEC EDGAR 프록시 미들웨어 — 미국 공시 조회
    {
      name: 'edgar-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/edgar/filings')) return next()
          await handleEdgarFilings(req, res)
        })
      },
    },
    // DART 캘린더 미들웨어 — 배당·실적 일정 조회
    {
      name: 'dart-calendar-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/dart/calendar')) return next()
          const dartKey = req.headers['x-dart-api-key'] || env.DART_API_KEY || ''
          if (req.url.startsWith('/api/dart/calendar/dividend')) {
            await handleDartCalendarDividend(req, res, dartKey)
          } else if (req.url.startsWith('/api/dart/calendar/earnings')) {
            await handleDartCalendarEarnings(req, res, dartKey)
          } else {
            next()
          }
        })
      },
    },
    // Finnhub 캘린더 미들웨어 — 미국 실적·IPO 일정 조회
    {
      name: 'finnhub-calendar-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/finnhub/calendar')) return next()
          const finnhubKey = req.headers['x-finnhub-api-key'] || env.FINNHUB_API_KEY || ''
          if (req.url.startsWith('/api/finnhub/calendar/earnings')) {
            await handleFinnhubCalendarEarnings(req, res, finnhubKey)
          } else if (req.url.startsWith('/api/finnhub/calendar/ipo')) {
            await handleFinnhubCalendarIpo(req, res, finnhubKey)
          } else {
            next()
          }
        })
      },
    },
    // 종목 DB 업데이트 미들웨어 (/api/stock-update) — 하위호환 유지
    {
      name: 'stock-update-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/stock-update')) return next()
          await handleStockUpdate(req, res)
        })
      },
    },
    // 종목 마스터 DB 미들웨어 (/api/stock-master, /api/stock-master/manifest)
    {
      name: 'stock-master-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/stock-master')) return next()
          try {
            await handleStockMaster(req, res)
          } catch (err) {
            console.error('[StockMaster] 핸들러 예외:', err.message)
            if (!res.writableEnded) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                rows: [], count: 0,
                errors: [err.message],
                collectedAt: new Date().toISOString(),
              }))
            }
          }
        })
      },
    },
    // 관리자 API 미들웨어 (/api/admin/users)
    {
      name: 'admin-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/admin')) return next()
          try {
            await handleAdminUsers(req, res, env)
          } catch (err) {
            console.error('[Admin] 핸들러 예외:', err.message)
            if (!res.writableEnded) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: err.message }))
            }
          }
        })
      },
    },
    // 동기화 API 미들웨어 (/api/sync/upload, /api/sync/download)
    {
      name: 'sync-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/sync')) return next()
          try {
            if (req.url.startsWith('/api/sync/upload')) {
              await handleSyncUpload(req, res, env)
            } else if (req.url.startsWith('/api/sync/download')) {
              await handleSyncDownload(req, res, env)
            } else {
              next()
            }
          } catch (err) {
            console.error('[Sync] 핸들러 예외:', err.message)
            if (!res.writableEnded) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: err.message }))
            }
          }
        })
      },
    },
    // Claude Tool Use 아겐틱 루프 미들웨어 (/api/claude/agentic)
    {
      name: 'agentic-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'POST' || !req.url?.startsWith('/api/claude/agentic')) return next()
          const dartKey = req.headers['x-dart-api-key'] || env.DART_API_KEY || ''
          await handleAgenticRequest(req, res, apiKey, dartKey)
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
              'Access-Control-Allow-Headers': 'Content-Type, X-User-Api-Key',
            })
            return res.end()
          }

          if (req.method !== 'POST') return next()

          let body = ''
          req.on('data', (chunk) => { body += chunk.toString() })
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}')

              // /api/claude/validate — 키 유효성 검증
              // Vite 미들웨어에서 req.url은 마운트 경로(/api/claude) 이후 부분
              if (req.url === '/validate' || req.url?.startsWith('/validate')) {
                const keyToValidate = parsed.apiKey || req.headers['x-user-api-key']
                if (!keyToValidate) {
                  res.writeHead(400, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ valid: false, reason: 'API 키가 전달되지 않았습니다.' }))
                }
                try {
                  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': keyToValidate,
                      'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                      model: 'claude-haiku-4-5-20251001',
                      max_tokens: 1,
                      messages: [{ role: 'user', content: 'ping' }],
                    }),
                  })
                  if (upstream.ok) {
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ valid: true }))
                  }
                  if (upstream.status === 401) {
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ valid: false, reason: '유효하지 않은 API 키입니다.' }))
                  }
                  const errText = await upstream.text()
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ valid: false, reason: `API 오류 (${upstream.status}): ${errText.substring(0, 100)}` }))
                } catch (err) {
                  res.writeHead(500, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ valid: false, reason: `네트워크 오류: ${err.message}` }))
                }
              }

              // /api/claude — 일반 AI 호출 (JSON 응답, 180s timeout)
              const { systemPrompt, messages, maxTokens = 4096 } = parsed

              if (!systemPrompt || !messages?.length) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: '필수 파라미터 누락 (systemPrompt, messages)' }))
              }

              // 사용자 제공 키 우선, 없으면 서버 환경변수 fallback
              const userApiKey = req.headers['x-user-api-key'] || apiKey

              if (!userApiKey) {
                console.error('[Claude Proxy] ANTHROPIC_API_KEY 미설정!')
                res.writeHead(500, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: 'API 키 미설정. 설정 페이지에서 API 키를 등록하거나 .env 파일을 확인하세요.' }))
              }

              console.log(`[Claude Proxy] 요청 → model: claude-sonnet-4-6, messages: ${messages.length}`)

              const upstream = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': userApiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-6',
                  max_tokens: maxTokens,
                  system: systemPrompt,
                  messages,
                }),
                signal: AbortSignal.timeout(180_000),
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
            // DART 공시 API → StaleWhileRevalidate (30분 캐시)
            urlPattern: /\/api\/dart\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dart-disclosure-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 30 }, // 30분
            },
          },
          {
            // SEC EDGAR 공시 API → StaleWhileRevalidate (30분 캐시)
            urlPattern: /\/api\/edgar\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'edgar-disclosure-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 30 }, // 30분
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
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
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
      '/api/krx-data': {
        target: 'http://data.krx.co.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/krx-data/, ''),
        headers: {
          'Referer': 'http://data.krx.co.kr',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      '/api/naver-pc': {
        target: 'https://finance.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/naver-pc/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://finance.naver.com',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
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
