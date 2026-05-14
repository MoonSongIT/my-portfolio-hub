# everything-claude-code 설치 방법

> v1.10.0 기준 | Windows 환경 | 2026년 4월 작성

Windows에서 플러그인 마켓플레이스의 EPERM 권한 문제를 우회하여 설치하는 방법입니다.

---

## 사전 준비

- Claude Code v2.1.0 이상 설치 (`claude --version` 으로 확인)
- Git 설치
- Node.js / npm 설치

---

## 1단계 — settings.json 비용 최적화 (1분)

`C:\Users\dohay\.claude\settings.json` 파일을 열고 아래 내용을 추가합니다.

```json
{
  "model": "sonnet",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50",
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku"
  }
}
```

| 설정 | 효과 |
|------|------|
| model: sonnet | 기본 모델을 Sonnet으로 변경 (약 60% 비용 절감) |
| MAX_THINKING_TOKENS: 10000 | 숨은 thinking 비용 약 70% 절감 |
| CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: 50 | 긴 세션 품질 개선 |
| CLAUDE_CODE_SUBAGENT_MODEL: haiku | 서브 에이전트 비용 약 80% 절감 |

---

## 2단계 — 플러그인 설치 (PowerShell 관리자 권한)

> ⚠️ Windows에서는 플러그인 마켓플레이스의 atomic rename이 EPERM 오류로 실패합니다.
> 아래 방법으로 우회합니다.

### ① GitHub에서 직접 클론

PowerShell (관리자 권한) 에서 실행:

```powershell
git clone https://github.com/affaan-m/everything-claude-code.git "C:\Users\dohay\everything-claude-code"
```

### ② .git 폴더 없는 깨끗한 복사본 생성

.git 폴더가 있으면 플러그인 설치 시 EACCES 오류가 발생하므로 제거합니다.

```powershell
# .claude 폴더 권한 수정
icacls "C:\Users\dohay\.claude" /grant "dohay:(OI)(CI)F" /T

# .git 없는 깨끗한 복사본 생성
robocopy "C:\Users\dohay\everything-claude-code" "C:\Users\dohay\ecc-clean" /E /XD .git
```

### ③ 마켓플레이스 등록

```powershell
claude plugin marketplace add "C:\Users\dohay\ecc-clean"
```

성공 메시지: `✓ Successfully added marketplace: everything-claude-code`

---

## 3단계 — Claude Code에서 플러그인 활성화

Claude Code 터미널에서 실행:

```
/plugin install everything-claude-code@ecc
```

설치 화면에서 **Enter** → `Install for you (user scope)` 선택

성공 메시지: `✓ Installed everything-claude-code. Run /reload-plugins to apply.`

마지막으로 플러그인 적용:

```
/reload-plugins
```

---

## 동작 확인

Claude Code에서 아래 명령어로 확인:

```
/help
```
→ ecc 관련 명령어들이 목록에 보이면 성공

```
/instinct-status
```
→ Continuous Learning 관련 메시지가 나오면 정상 작동

---

## 처음 사용할 코어 스킬 5개

| 스킬 | 역할 |
|------|------|
| search-first | 코딩 전 리서치 워크플로 (가장 중요) |
| tdd-workflow | 테스트 주도 개발 |
| strategic-compact | 적절한 시점에 /compact 자동 제안 |
| verification-loop | build, test, lint, typecheck, security 한 번에 검증 |
| security-review | OWASP Top 10 기반 보안 체크리스트 |

---

## 주요 워크플로

- **새 기능 개발**: `/plan` → `/tdd` → `/code-review`
- **버그 수정**: `/tdd` → 수정 → `/code-review`
- **프로덕션 출시 전**: `/security-scan` → `/e2e` → `/test-coverage`

---

## 주의사항

1. 156개 스킬 한 번에 다 설치하지 말 것 — 코어 5개부터 시작
2. 구현 도중 `/compact` 금지 — 변수명/파일 경로 손실
3. MCP 서버는 프로젝트당 10개 이하로 유지
4. `plugin.json`에 "hooks" 필드 직접 추가 금지 — "Duplicate hooks file" 오류 발생

---

## 참고 링크

- [everything-claude-code GitHub](https://github.com/affaan-m/everything-claude-code)
- [AgentShield 보안 스캐너](https://github.com/affaan-m/agentshield)
- [Token Optimization 공식 문서](https://github.com/affaan-m/everything-claude-code/blob/main/docs/token-optimization.md)
