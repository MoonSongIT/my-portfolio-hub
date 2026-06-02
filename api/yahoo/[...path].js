// Yahoo Finance API 프록시 — query1.finance.yahoo.com → /api/yahoo/*
import { setCors, handlePreflight } from '../_cors.js'

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)

  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean)

  const { path: _p, ...queryRest } = req.query
  const qs = new URLSearchParams(queryRest).toString()
  const targetUrl = `https://query1.finance.yahoo.com/${segments.join('/')}${qs ? '?' + qs : ''}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
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
