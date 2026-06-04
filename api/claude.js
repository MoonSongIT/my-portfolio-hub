// api/claude.js — Vercel Serverless Function
export default async function handler(req, res) {
  // CORS 헤더 — X-User-Api-Key 헤더 허용 추가
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { systemPrompt, messages, maxTokens = 4096 } = req.body

  if (!systemPrompt || !messages?.length) {
    return res.status(400).json({ error: '필수 파라미터 누락 (systemPrompt, messages)' })
  }

  // 사용자 제공 키 우선, 없으면 서버 환경변수 fallback
  const apiKey = req.headers['x-user-api-key'] || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 미설정 — 설정에서 API 키를 등록해주세요.' })
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
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
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
