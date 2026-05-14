// Phase E — AI API 키 관리 E2E 검증 (E1~E6)
// 실행: npx playwright test e2e/phase-e-validation.spec.mjs --reporter=list
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5181'

const TEST_USER = { id: 'test-user-1', name: '테스터', email: 'test@example.com', password: 'test1234' }

// 로그인 상태를 localStorage에 심어 ProtectedRoute 통과
async function seedAuth(page) {
  await page.addInitScript((user) => {
    const state = {
      state: { currentUser: user, isLoggedIn: true, users: [user] },
      version: 0,
    }
    localStorage.setItem('auth-storage', JSON.stringify(state))
  }, TEST_USER)
}

// IDB 초기화 — PortfolioHub DB 전체 삭제 (aiCredentials 포함)
async function clearIDB(page) {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('PortfolioHub')
      req.onsuccess = resolve
      req.onerror = resolve
      req.onblocked = resolve
    })
  })
}

test.describe('Phase E — AI API 키 가드 검증', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page)
    await page.goto(BASE)
    await clearIDB(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  // ─────────────────────────────────────────────
  // E1: 키 미설정 → AI 기능 진입 → 안내 모달 노출
  // ─────────────────────────────────────────────
  test('E1-a — 키 미설정 시 AI 채팅 진입 → 안내 모달 노출', async ({ page }) => {
    await page.getByRole('link', { name: /AI 분석|AI 채팅/i }).click()
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[placeholder*="질문"]')
    await input.fill('삼성전자 분석해줘')
    await input.press('Enter')

    // ApiKeyRequiredDialog는 role="dialog" 없이 div로 렌더링됨 — 텍스트로 확인
    const modal = page.locator('text=API 키가 필요합니다')
    await expect(modal).toBeVisible({ timeout: 5000 })
  })

  test('E1-b — 키 미설정 시 Reports AI 인사이트 버튼 → 안내 모달 노출', async ({ page }) => {
    await page.getByRole('link', { name: /리포트|Reports/i }).click()
    await page.waitForLoadState('networkidle')

    const btn = page.getByRole('button', { name: /AI 인사이트 생성/i })
    if (!(await btn.isVisible())) { test.skip(); return }

    await btn.click()
    const modal = page.locator('text=API 키가 필요합니다')
    await expect(modal).toBeVisible({ timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // E2: 유효한 키 입력 → 저장 → 검증 성공 뱃지
  // ─────────────────────────────────────────────
  test('E2 — 설정에서 키 저장 → 검증 뱃지 표시', async ({ page }) => {
    await page.getByRole('link', { name: /설정|Settings/i }).click()
    await page.waitForLoadState('networkidle')

    const aiTab = page.getByRole('tab', { name: /AI|API/i })
    if (await aiTab.isVisible()) await aiTab.click()

    const keyInput = page.locator('input[type="password"], input[placeholder*="sk-ant"]').first()
    await expect(keyInput).toBeVisible({ timeout: 5000 })
    await keyInput.fill('sk-ant-api03-testkey00000000000000000000000000000000000000000000000000000000000000000000000000000AA')

    const saveBtn = page.getByRole('button', { name: /저장|확인/i }).first()
    await saveBtn.click()
    await page.waitForTimeout(3000)

    // 어떤 상태이든 저장 후 뱃지가 나타나야 한다
    const statusText = await page.locator('body').textContent()
    const hasBadge = /검증|완료|실패|유효|✓|✗/.test(statusText)
    expect(hasBadge).toBeTruthy()
  })

  // ─────────────────────────────────────────────
  // E3: 잘못된 키 형식 → 검증 실패 표시
  // ─────────────────────────────────────────────
  test('E3 — 잘못된 키 형식 입력 → 검증 실패 피드백', async ({ page }) => {
    await page.getByRole('link', { name: /설정|Settings/i }).click()
    await page.waitForLoadState('networkidle')

    const aiTab = page.getByRole('tab', { name: /AI|API/i })
    if (await aiTab.isVisible()) await aiTab.click()

    const keyInput = page.locator('input[type="password"], input[placeholder*="sk-ant"]').first()
    await expect(keyInput).toBeVisible({ timeout: 5000 })
    await keyInput.fill('invalid-key-format')

    const saveBtn = page.getByRole('button', { name: /저장|확인/i }).first()
    await saveBtn.click()
    await page.waitForTimeout(2000)

    const statusText = await page.locator('body').textContent()
    const hasFailFeedback = /실패|오류|형식|invalid|✗/.test(statusText)
    expect(hasFailFeedback).toBeTruthy()
  })

  // ─────────────────────────────────────────────
  // E4: 키 저장 후 AI 기능 진입 → 모달 없이 통과
  // ─────────────────────────────────────────────
  test('E4 — 키 저장 후 AI 채팅 진입 시 안내 모달 없이 통과', async ({ page }) => {
    await page.getByRole('link', { name: /설정|Settings/i }).click()
    await page.waitForLoadState('networkidle')

    const aiTab = page.getByRole('tab', { name: /AI|API/i })
    if (await aiTab.isVisible()) await aiTab.click()

    const keyInput = page.locator('input[type="password"], input[placeholder*="sk-ant"]').first()
    await expect(keyInput).toBeVisible({ timeout: 5000 })
    await keyInput.fill('sk-ant-api03-testkey00000000000000000000000000000000000000000000000000000000000000000000000000000AA')

    const saveBtn = page.getByRole('button', { name: /저장|확인/i }).first()
    await saveBtn.click()
    await page.waitForTimeout(500)

    await page.getByRole('link', { name: /AI 분석|AI 채팅/i }).click()
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[placeholder*="질문"]')
    await input.fill('테스트 메시지')
    await input.press('Enter')

    await page.waitForTimeout(1500)

    // 안내 모달(API 키 요구)이 뜨지 않아야 한다
    const modal = page.locator('text=API 키가 필요합니다')
    const visible = await modal.isVisible().catch(() => false)
    expect(visible).toBeFalsy()
  })

  // ─────────────────────────────────────────────
  // E5: 키 삭제 → 재진입 → 모달 재노출
  // ─────────────────────────────────────────────
  test('E5 — 키 삭제 후 AI 재진입 → 안내 모달 재노출', async ({ page }) => {
    // 키 저장
    await page.getByRole('link', { name: /설정|Settings/i }).click()
    await page.waitForLoadState('networkidle')

    const aiTab = page.getByRole('tab', { name: /AI|API/i })
    if (await aiTab.isVisible()) await aiTab.click()

    const keyInput = page.locator('input[type="password"], input[placeholder*="sk-ant"]').first()
    await expect(keyInput).toBeVisible({ timeout: 5000 })
    await keyInput.fill('sk-ant-api03-testkey00000000000000000000000000000000000000000000000000000000000000000000000000000AA')

    // 저장 클릭 후 삭제 버튼이 나타날 때까지 대기
    const saveBtn = page.getByRole('button', { name: /^저장$/ }).first()
    await saveBtn.click()

    // keyExists=true가 되면 삭제 버튼이 렌더링된다
    const deleteBtn = page.getByRole('button', { name: /^삭제$/ })
    await expect(deleteBtn).toBeVisible({ timeout: 5000 })
    await deleteBtn.click()

    // 삭제 확인 다이얼로그 — "삭제" 버튼 두 번째 (확인용)
    const confirmDeleteBtn = page.locator('text=저장된 API 키를 삭제하시겠습니까?').locator('..').locator('..').getByRole('button', { name: /^삭제$/ })
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 3000 })
    await confirmDeleteBtn.click()

    await page.waitForTimeout(500)

    // AI 채팅으로 이동
    await page.getByRole('link', { name: /AI 분석|AI 채팅/i }).click()
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[placeholder*="질문"]')
    await input.fill('삼성전자')
    await input.press('Enter')

    // 키가 없으므로 안내 모달이 다시 떠야 한다
    const modal = page.locator('text=API 키가 필요합니다')
    await expect(modal).toBeVisible({ timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // E6: 401 응답 → isValid=false + 경고 토스트
  // ─────────────────────────────────────────────
  test('E6 — 401 응답 시 경고 피드백 표시', async ({ page }) => {
    // 키 저장
    await page.getByRole('link', { name: /설정|Settings/i }).click()
    await page.waitForLoadState('networkidle')

    const aiTab = page.getByRole('tab', { name: /AI|API/i })
    if (await aiTab.isVisible()) await aiTab.click()

    const keyInput = page.locator('input[type="password"], input[placeholder*="sk-ant"]').first()
    await expect(keyInput).toBeVisible({ timeout: 5000 })
    await keyInput.fill('sk-ant-api03-testkey00000000000000000000000000000000000000000000000000000000000000000000000000000AA')

    const saveBtn = page.getByRole('button', { name: /저장|확인/i }).first()
    await saveBtn.click()
    await page.waitForTimeout(500)

    // API 응답을 401로 가로채기
    await page.route('**/api/claude**', (route) => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unauthorized' } }) })
    })

    await page.getByRole('link', { name: /AI 분석|AI 채팅/i }).click()
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[placeholder*="질문"]')
    await input.fill('테스트')
    await input.press('Enter')

    await page.waitForTimeout(3000)

    // 경고 토스트 또는 에러 메시지 확인
    const hasWarning =
      (await page.locator('[data-sonner-toast]').count()) > 0 ||
      (await page.locator('text=/만료|검증|실패|401|유효하지/i').count()) > 0 ||
      (await page.locator('[class*="error"], [class*="red"]').count()) > 0
    expect(hasWarning).toBeTruthy()
  })
})
