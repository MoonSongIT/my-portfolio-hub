// 증시 일정 브라우저 알림 스케줄러 — requestPermission / scheduleNotifications / cancelAll

const TIMING_TITLES = {
  on_day:      (title) => `📅 오늘 증시 일정: ${title}`,
  day_before:  (title) => `📅 내일 증시 일정 알림: ${title}`,
  week_before: (title) => `📅 이번 주 증시 일정 알림: ${title}`,
}

function toDateStr(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** event.date 기준으로 days 만큼 이동한 날짜 문자열 반환 */
function offsetDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/** 브라우저 알림 권한 요청. 반환값: 'granted' | 'denied' | 'unsupported' */
export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

/**
 * 오늘 알림을 보내야 할 이벤트를 필터링해 setTimeout으로 스케줄링한다.
 * @param {object[]} events - 전체 캘린더 이벤트 배열
 * @param {{ enabled: boolean, timing: string, impactFilter: string }} settings
 * @returns {number[]} setTimeout ID 배열 (cancelAll에 전달)
 */
export function scheduleNotifications(events, settings) {
  if (!settings.enabled) return []
  if (!('Notification' in window)) return []
  if (Notification.permission !== 'granted') return []

  const now = new Date()
  const today = toDateStr(now)
  const NOTIFY_HOUR = 9 // 오전 9시 알림

  // timing → 이벤트 날짜 기준 날짜 offset (day)
  const OFFSET = { on_day: 0, day_before: -1, week_before: -7 }
  const offset = OFFSET[settings.timing] ?? 0

  const scheduleIds = []

  for (const event of events) {
    if (!event.date) continue

    // 임팩트 필터
    if (settings.impactFilter !== 'all' && event.impact !== settings.impactFilter) continue

    // 알림을 보내야 하는 날짜 = event.date + offset
    const notifyDate = offsetDate(event.date, offset)
    if (notifyDate !== today) continue

    // 오늘 오전 9시를 목표 시각으로 설정
    const target = new Date(`${today}T${String(NOTIFY_HOUR).padStart(2, '0')}:00:00`)
    const delay = target.getTime() - now.getTime()
    // 9시가 이미 지났으면 1초 후 즉시 발송
    const effectiveDelay = delay > 0 ? delay : 1_000

    const id = setTimeout(() => {
      const titleFn = TIMING_TITLES[settings.timing] ?? TIMING_TITLES.on_day
      const title = titleFn(event.title)

      const bodyParts = [event.date]
      if (event.name && event.ticker) bodyParts.push(`${event.name} (${event.ticker})`)
      else if (event.ticker) bodyParts.push(event.ticker)
      if (event.memo) bodyParts.push(event.memo)

      try {
        new Notification(title, {
          body: bodyParts.join(' · '),
          icon: '/vite.svg',
          tag: `calendar-${event.id ?? event.date}`,
        })
      } catch {
        // Notification 생성 실패는 무시 (권한 박탈 등)
      }
    }, effectiveDelay)

    scheduleIds.push(id)
  }

  return scheduleIds
}

/** 등록된 setTimeout ID를 모두 취소한다. */
export function cancelAll(scheduleIds) {
  for (const id of scheduleIds) {
    clearTimeout(id)
  }
}
