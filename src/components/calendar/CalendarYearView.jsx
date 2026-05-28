// 증시 일정 연간 히트맵 뷰 — 52주×7일 이벤트 밀도 그리드

import { useMemo } from 'react'

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAY_LABELS   = ['월','화','수','목','금','토','일']

/** Date → 로컬 'YYYY-MM-DD' 문자열 */
function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 이벤트 밀도에 따른 셀 Tailwind 클래스 */
function densityClass(count) {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
  if (count === 1) return 'bg-blue-200 dark:bg-blue-900 hover:bg-blue-300 dark:hover:bg-blue-800'
  if (count <= 3)  return 'bg-blue-400 dark:bg-blue-600 hover:bg-blue-500 dark:hover:bg-blue-500'
  return 'bg-blue-600 dark:bg-blue-400 hover:bg-blue-700 dark:hover:bg-blue-300'
}

/**
 * year 전체 날짜를 week 단위(컬럼)로 구성.
 * 각 주는 월(0)~일(6) 순서로 7칸.
 * Jan 1이 목요일이면 앞 3칸(월~수)은 null 패딩.
 */
function buildGrid(year) {
  const jan1    = new Date(year, 0, 1)
  const dec31   = new Date(year, 11, 31)
  const msPerDay = 86400000

  // Mon=0, ..., Sun=6
  const jan1Offset = (jan1.getDay() + 6) % 7
  const totalDays  = Math.round((dec31 - jan1) / msPerDay) + 1

  // 셀 배열 구성
  const cells = Array(jan1Offset).fill(null)
  for (let i = 0; i < totalDays; i++) {
    cells.push(new Date(year, 0, i + 1))
  }
  const numWeeks = Math.ceil(cells.length / 7)
  while (cells.length < numWeeks * 7) cells.push(null)

  // 주 단위(컬럼) 그룹
  const weeks = Array.from({ length: numWeeks }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7)
  )

  // 각 월의 첫 번째 주 인덱스
  const monthCols = {}
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1)
    const dayIdx  = Math.round((first - jan1) / msPerDay)
    const weekIdx = Math.floor((jan1Offset + dayIdx) / 7)
    if (monthCols[weekIdx] === undefined) monthCols[weekIdx] = m
  }

  return { weeks, monthCols, numWeeks }
}

export default function CalendarYearView({ events, currentDate, onCellClick }) {
  const year = currentDate.getFullYear()

  const densityMap = useMemo(() => {
    const map = {}
    events.forEach(e => {
      const key = (e.date ?? '').slice(0, 10)
      map[key] = (map[key] ?? 0) + 1
    })
    return map
  }, [events])

  const { weeks, monthCols } = useMemo(() => buildGrid(year), [year])

  const todayStr = toLocalDateStr(new Date())

  return (
    <div className="p-4 bg-white dark:bg-gray-900 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {/* 요일 레이블 (왼쪽) — 홀수 인덱스만 표시해 가독성 확보 */}
        <div className="flex flex-col pt-5 mr-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="h-[14px] mb-[2px] text-[10px] text-gray-400 dark:text-gray-500 w-5 flex items-center justify-end pr-0.5"
            >
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>

        {/* 히트맵 본체 */}
        <div>
          {/* 월 레이블 행 */}
          <div className="flex mb-1 h-5">
            {weeks.map((_, wi) => (
              <div
                key={wi}
                className="w-[14px] mr-[2px] text-[10px] text-gray-500 dark:text-gray-400 leading-none"
              >
                {monthCols[wi] !== undefined ? MONTH_LABELS[monthCols[wi]] : ''}
              </div>
            ))}
          </div>

          {/* 셀 그리드 */}
          <div className="flex">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col mr-[2px]">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="w-[14px] h-[14px] mb-[2px]" />
                  }
                  const dateStr = toLocalDateStr(day)
                  const count   = densityMap[dateStr] ?? 0
                  const isToday = dateStr === todayStr
                  return (
                    <div
                      key={di}
                      title={`${day.getMonth() + 1}/${day.getDate()}${count > 0 ? ` · ${count}건` : ''}`}
                      onClick={() => onCellClick?.(day)}
                      className={[
                        'w-[14px] h-[14px] mb-[2px] rounded-sm cursor-pointer transition-colors',
                        densityClass(count),
                        isToday ? 'ring-1 ring-yellow-400' : '',
                      ].filter(Boolean).join(' ')}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 밀도 범례 */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 dark:text-gray-500">
        <span>적음</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
        <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-900" />
        <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-600" />
        <div className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-400" />
        <span>많음</span>
      </div>
    </div>
  )
}
