// 로컬 개발 환경용 API 프록시 서버
// node dev-server.js 로 실행
// 포트 3001에서 /api/claude 요청을 Anthropic API로 전달

import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// .env 파일 경로 (ESM 환경에서)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '.env')

// .env 파일이 있으면 로드
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log(`[Config] .env 파일 로드됨: ${envPath}`)
} else {
  console.warn(`[Config] .env 파일을 찾을 수 없음: ${envPath}`)
}

// .env 파일에서 직접 API 키 추출 (dotenv가 실패한 경우)
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const keyMatch = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m)
  if (keyMatch && keyMatch[1]) {
    process.env.ANTHROPIC_API_KEY = keyMatch[1].trim()
    console.log('[Config] ANTHROPIC_API_KEY를 .env 파일에서 직접 로드함')
  }
}

// 최종 확인
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[ERROR] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다!')
  console.error('[Hint] .env 파일에 ANTHROPIC_API_KEY=... 을 추가하세요.')
} else {
  console.log('[Config] ANTHROPIC_API_KEY 설정됨 ✅')
}

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// 로깅
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Claude API 프록시
app.post('/api/claude', async (req, res) => {
  const { systemPrompt, messages, maxTokens = 4096 } = req.body

  console.log('[Claude API] 수신된 데이터:', {
    systemPrompt: systemPrompt?.substring(0, 100),
    messages_count: messages?.length,
    maxTokens,
  })

  // 입력 검증
  if (!systemPrompt || !messages?.length) {
    const errMsg = '필수 파라미터 누락 (systemPrompt, messages)'
    console.error('[Validation Error]:', errMsg)
    return res.status(400).json({ error: errMsg })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const errMsg = 'API 키 미설정'
    console.error('[Config Error]:', errMsg)
    return res.status(500).json({ error: errMsg })
  }

  try {
    console.log('[Claude API] 요청 시작', {
      model: 'claude-3-5-sonnet-20241022',
      messages_count: messages.length,
      max_tokens: maxTokens,
      api_key_length: process.env.ANTHROPIC_API_KEY?.length,
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2024-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    })

    // 응답 처리
    const contentType = response.headers.get('content-type')
    const text = await response.text()

    if (!response.ok) {
      console.error(`[Claude API Error] Status ${response.status}:`, text.substring(0, 200))
      return res.status(response.status).json({
        error: `Claude API Error: ${response.status}`,
        details: text.substring(0, 200),
      })
    }

    // JSON 파싱
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('[JSON Parse Error]:', e.message)
      return res.status(500).json({
        error: 'API 응답 파싱 실패',
        message: e.message,
      })
    }

    console.log('[Claude API] 성공', {
      usage: data.usage,
      stop_reason: data.stop_reason,
    })

    res.json(data)
  } catch (err) {
    console.error('[Proxy Server Error]:', err.message)
    res.status(500).json({
      error: '프록시 서버 오류',
      message: err.message,
    })
  }
})

// 기타 라우트 (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n🚀 로컬 API 프록시 서버 시작 (포트 ${PORT})`)
  console.log(`   POST http://localhost:${PORT}/api/claude`)
  console.log(`   API 키: ${process.env.ANTHROPIC_API_KEY ? '✅ 설정됨' : '❌ 미설정'}`)
  console.log('')
})
