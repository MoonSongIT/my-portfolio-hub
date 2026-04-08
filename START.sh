#!/bin/bash
# My Portfolio Hub 개발 환경 시작 스크립트

cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 My Portfolio Hub 개발 환경 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 환경변수 로드
export $(cat .env | grep "^ANTHROPIC_API_KEY\|^VITE_API_BASE_URL" | xargs)

echo "✅ 환경변수 로드 완료"
echo "  - API 키: $(echo $ANTHROPIC_API_KEY | head -c 20)..."
echo "  - API URL: $VITE_API_BASE_URL"
echo ""

# 터미널 1: 프록시 서버
echo "🔄 터미널 1: 프록시 서버 시작 (포트 3001)..."
node dev-server.js &
PROXY_PID=$!

sleep 2

# 터미널 2: 개발 서버
echo "🔄 터미널 2: 개발 서버 시작 (포트 5173/5176)..."
npm run dev &
DEV_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 모든 서버 시작됨!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 접속 주소: http://localhost:5173/ai-chat"
echo "   (또는 http://localhost:5176/ai-chat)"
echo ""
echo "📊 프록시 서버: http://localhost:3001/api/claude"
echo "🔐 API 키: 설정됨"
echo ""
echo "⚠️  종료하려면 Ctrl+C 입력"
echo ""

# 프로세스 유지
wait $PROXY_PID $DEV_PID
