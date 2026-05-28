// OAuth 소셜 로그인 콜백 처리 — PKCE code를 클라이언트 라우트로 전달
export default function handler(req, res) {
  const params = new URLSearchParams()
  if (req.query?.code) params.set('code', req.query.code)
  if (req.query?.error) params.set('error', req.query.error)
  if (req.query?.error_description) params.set('error_description', req.query.error_description)

  const qs = params.toString()
  res.redirect(302, qs ? `/auth/callback?${qs}` : '/')
}
