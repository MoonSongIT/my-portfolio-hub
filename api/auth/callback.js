// OAuth 소셜 로그인 콜백 처리 — Supabase가 hash fragment로 세션 전달, 클라이언트가 자동 파싱
export default function handler(req, res) {
  res.redirect(302, '/')
}
