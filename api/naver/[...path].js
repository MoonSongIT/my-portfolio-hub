// Naver Finance 모바일 API 프록시 — m.stock.naver.com → /api/naver/*
import { setCors, handlePreflight } from '../_cors.js'

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)

  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean)

  const { path: _p, ...queryRest } = req.query
  const qs = new URLSearchParams(queryRest).toString()
  const targetUrl = `https://m.stock.naver.com/${segments.join('/')}${qs ? '?' + qs : ''}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://m.stock.naver.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    })

    const contentType = response.headers.get('content-type') || 'application/json'
    const text = await response.text()
    res.setHeader('Content-Type', contentType)
    res.status(response.status).send(text)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
