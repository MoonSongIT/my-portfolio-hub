// CORS 헤더 공통 유틸 — 로컬 개발(localhost)과 배포 환경 모두 허용
export function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allowed = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://my-portfolio-hub-steel.vercel.app',
  ]
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

// OPTIONS preflight 요청 처리 — true 반환 시 handler 즉시 종료
export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(req, res)
    res.status(204).end()
    return true
  }
  return false
}
