import express from 'express'
import cors from 'cors'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env 파일에서 직접 환경변수 로드 (@dotenvx 프리로더 충돌 방지)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env')
    const content = readFileSync(envPath, 'utf-8')
    const vars = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
    }
    return vars
  } catch {
    return {}
  }
}

const env = loadEnv()
// process.env에 값이 있으면 우선 사용, 없으면 .env 파일 fallback
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY

const app = express()
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeySet: !!ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  })
})

// 허용된 모델 목록 (임의 모델 호출 방지)
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
])

// Claude API 프록시 엔드포인트 (JSON 응답, 180s timeout)
app.post('/api/claude', async (req, res) => {
  const { systemPrompt, messages, maxTokens = 4096, model: reqModel } = req.body
  const model = ALLOWED_MODELS.has(reqModel) ? reqModel : 'claude-sonnet-4-6'
  const apiKey = req.headers['x-user-api-key'] || ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 미설정' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
      signal: AbortSignal.timeout(180_000),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: errText })
    }

    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const server = app.listen(3001, () => console.log('🤖 Claude 프록시 서버: http://localhost:3001'))
server.timeout = 180_000
