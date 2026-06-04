// POST /api/claude/validate — Anthropic API 키 유효성 검증
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key')

  if (req.method === 'OPTIONS') return res.status(200).end()
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

    if (response.ok) {
      return res.json({ valid: true })
    }

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
