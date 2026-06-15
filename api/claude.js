// api/claude.js — Vercel Serverless Function
// 허용 모델 화이트리스트 — 클라이언트가 임의 모델을 주입하지 못하도록 제한
const ALLOWED_MODELS = new Set([
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
])
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export default async function handler(req, res) {
  // CORS 헤더 — X-User-Api-Key 헤더 허용 추가
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // /api/claude/validate → /api/claude?action=validate (vercel.json rewrite)
  if (req.query.action === 'validate') return handleValidate(req, res)

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { systemPrompt, messages, maxTokens = 4096, model, tools } = req.body

  if (!systemPrompt || !messages?.length) {
    return res.status(400).json({ error: '필수 파라미터 누락 (systemPrompt, messages)' })
  }

  // 사용자 제공 키 우선, 없으면 서버 환경변수 fallback
  const apiKey = req.headers['x-user-api-key'] || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 미설정 — 설정에서 API 키를 등록해주세요.' })
  }

  // 허용 모델만 통과 — 미허용·미지정 시 기본값으로 보정 (임의 모델 주입 방지)
  const resolvedModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL

  // web_search 등 서버 도구는 클라이언트가 지정한 배열만 전달 (없으면 미포함)
  const requestBody = {
    model: resolvedModel,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  }
  if (Array.isArray(tools) && tools.length > 0) requestBody.tools = tools

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[Claude API Error] Status ${response.status}:`, err)
      return res.status(response.status).json({
        error: `Claude API Error: ${response.status}`,
        details: err.substring(0, 200)
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('[API Handler Error]:', err.message)
    res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      message: err.message
    })
  }
}

// ── 키 유효성 검증 (POST /api/claude/validate) ────────────────────────────
async function handleValidate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const apiKey = req.body?.apiKey || req.headers['x-user-api-key']
  if (!apiKey) {
    return res.status(400).json({ valid: false, reason: 'API 키가 전달되지 않았습니다.' })
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })

    if (response.ok) return res.json({ valid: true })

    if (response.status === 401) {
      return res.status(200).json({ valid: false, reason: '유효하지 않은 API 키입니다.' })
    }

    const err = await response.text()
    return res.status(200).json({
      valid: false,
      reason: `API 오류 (${response.status}): ${err.substring(0, 100)}`,
    })
  } catch (err) {
    return res.status(500).json({ valid: false, reason: `네트워크 오류: ${err.message}` })
  }
}
