import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts'
import { useSettingsStore } from '../../store/settingsStore'
import { useJournalStore } from '../../store/journalStore'
import { calculateSMA, calculateBollingerBands, calculateRSI, calculateMACD, resampleOHLCV } from '../../utils/technicalIndicators'
import TimeframeSelector from './TimeframeSelector'
import IndicatorControls from './IndicatorControls'
import PeriodSelector from './PeriodSelector'

// ─── 차트 테마 옵션 ────────────────────────────────────────────────────────

function getThemeOptions(isDark) {
  return {
    layout: {
      textColor: isDark ? '#d1d5db' : '#374151',
      background: { type: 'solid', color: isDark ? '#1f2937' : '#ffffff' },
      panes: {
        separatorColor: isDark ? '#374151' : '#e5e7eb',
        separatorHoverColor: isDark ? '#4b5563' : '#d1d5db',
        enableResize: true,
      },
    },
    grid: {
      vertLines: { color: isDark ? '#374151' : '#f3f4f6' },
      horzLines: { color: isDark ? '#374151' : '#f3f4f6' },
    },
    timeScale: {
      timeVisible: false,
      secondsVisible: false,
      borderColor: isDark ? '#4b5563' : '#e5e7eb',
      rightOffset: 5,            // 최신 캔들 우측 여백 (가독성)
      fixRightEdge: true,        // 최신 데이터가 항상 오른쪽 엣지에 고정 (스크롤 한계)
      fixLeftEdge: false,        // 좌측 드래그로 과거 데이터 로딩 트리거 허용
      rightBarStaysOnScroll: true, // 스크롤 시 우측 바 위치 유지
    },
    rightPriceScale: {
      borderColor: isDark ? '#4b5563' : '#e5e7eb',
    },
    crosshair: { mode: 0 },
  }
}

// ─── 매매 일지 마커 헬퍼 ─────────────────────────────────────────────────────

/**
 * 엔트리 날짜를 chartData의 캔들 시간에 매핑
 * 주봉/월봉일 때는 해당 날짜를 포함하는 캔들(이전 최근 캔들)을 반환
 */
function findCandleTime(entryDate, chartData) {
  if (chartData.find(d => d.time === entryDate)) return entryDate
  const earlier = chartData.filter(d => d.time <= entryDate)
  return earlier.length > 0 ? earlier[earlier.length - 1].time : null
}

/**
 * 매매 일지 엔트리 배열을 lightweight-charts 마커 배열로 변환
 * 같은 캔들에 여러 거래가 있으면 매수/매도별로 하나씩 병합
 */
function buildMarkers(entries, chartData) {
  if (!entries?.length || !chartData?.length) return []

  const grouped = new Map()
  for (const entry of entries) {
    if (!entry.date || !entry.price || !entry.quantity) continue
    const time = findCandleTime(entry.date, chartData)
    if (!time) continue
    if (!grouped.has(time)) grouped.set(time, { buys: [], sells: [] })
    if (entry.action === 'buy') grouped.get(time).buys.push(entry)
    else if (entry.action === 'sell') grouped.get(time).sells.push(entry)
  }

  const markers = []
  for (const [time, { buys, sells }] of grouped) {
    if (buys.length > 0) {
      const qty = buys.reduce((s, e) => s + (e.quantity || 0), 0)
      const psych = buys.length === 1 && buys[0].psychology ? ` | ${buys[0].psychology}` : ''
      markers.push({
        time,
        position: 'belowBar',
        color: '#26a69a',
        shape: 'arrowUp',
        text: `매수 ${qty}주${psych}`,
        size: 1,
      })
    }
    if (sells.length > 0) {
      const qty = sells.reduce((s, e) => s + (e.quantity || 0), 0)
      const psych = sells.length === 1 && sells[0].psychology ? ` | ${sells[0].psychology}` : ''
      markers.push({
        time,
        position: 'aboveBar',
        color: '#ef5350',
        shape: 'arrowDown',
        text: `매도 ${qty}주${psych}`,
        size: 1,
      })
    }
  }

  return markers.sort((a, b) => a.time.localeCompare(b.time))
}

// ─── RSI 과매수/과매도 기준선 ────────────────────────────────────────────────

function addRSILevels(chart, rsiData, paneIndex) {
  if (rsiData.length === 0) return
  const first = rsiData[0].time
  const last = rsiData[rsiData.length - 1].time

  ;[70, 30].forEach(level => {
    const lineSeries = chart.addSeries(LineSeries, {
      color: level === 70 ? 'rgba(239,83,80,0.4)' : 'rgba(38,166,154,0.4)',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, paneIndex)
    lineSeries.setData([
      { time: first, value: level },
      { time: last, value: level },
    ])
  })
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

const DEFAULT_INDICATORS = { bb: false, rsi: false, macd: false }
const DEFAULT_TIMEFRAME = '1D'
const DEFAULT_PERIOD = 'ALL'

const PERIOD_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }

/**
 * 차트 timeScale에 기간 visible range 적용
 * @param {object} chart - lightweight-charts chart 인스턴스
 * @param {string} period - '1M' | '3M' | '6M' | '1Y' | 'ALL'
 * @param {Array}  chartData - 현재 표시 중인 OHLCV 배열
 * @param {object|null} savedRange - 이전 logical range (동적 데이터 추가 시 줌 유지)
 */
function applyPeriod(chart, period, chartData, savedRange = null) {
  if (!chart || !chartData?.length) return
  if (period === 'ALL') {
    if (savedRange) {
      // 동적 데이터 추가 후: 줌 유지 + 최신 데이터를 오른쪽에 고정
      chart.timeScale().scrollToRealTime()
    } else {
      chart.timeScale().fitContent()
    }
    return
  }
  const days = PERIOD_DAYS[period]
  if (!days) return
  const last = chartData[chartData.length - 1].time
  const toDate = new Date(last)
  const fromDate = new Date(toDate)
  fromDate.setDate(toDate.getDate() - days)
  const fmt = d => d.toISOString().split('T')[0]
  try {
    chart.timeScale().setVisibleRange({ from: fmt(fromDate), to: fmt(toDate) })
  } catch {
    chart.timeScale().fitContent()
  }
}

export default function CandlestickChart({
  data = [],
  ticker = '',
  onNeedMoreData = null,
  isFetchingMore = false,
  isMaxRange = false,
}) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const chartDataRef = useRef([])   // period effect에서 chartData 접근용
  const periodRef = useRef(DEFAULT_PERIOD)
  const isFetchingMoreRef = useRef(false)
  const isMaxRangeRef = useRef(false)
  const onNeedMoreDataRef = useRef(null)
  const hasTriggeredRef = useRef(false)
  const savedRangeRef = useRef(null)   // 동적 데이터 추가 시 이전 zoom level 보존
  const prevTickerRef = useRef(null)   // ticker 변경 감지 (range 초기화 용)

  // refs를 매 렌더마다 최신 props로 동기화 (stale closure 방지)
  isFetchingMoreRef.current = isFetchingMore
  isMaxRangeRef.current = isMaxRange
  onNeedMoreDataRef.current = onNeedMoreData
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME)
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS)
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const { theme } = useSettingsStore()
  const isDark = theme === 'dark'
  const entries = useJournalStore(s => s.entries)

  // 지표 토글
  const handleIndicatorToggle = useCallback((key, value) => {
    setIndicators(prev => ({ ...prev, [key]: value }))
  }, [])

  // 차트 빌드 함수 (data, isDark, indicators 변경 시 재생성)
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return
    hasTriggeredRef.current = false  // 새 데이터 로드 시 트리거 플래그 리셋

    // ticker가 바뀌면 저장된 range 초기화 (새 종목은 fitContent로 시작)
    const tickerChanged = prevTickerRef.current !== null && prevTickerRef.current !== ticker
    prevTickerRef.current = ticker

    // 이전 차트 정리 전에 현재 logical range 저장 (동적 데이터 추가 시 줌 유지)
    if (chartRef.current && !tickerChanged) {
      try {
        savedRangeRef.current = chartRef.current.timeScale().getVisibleLogicalRange()
      } catch {
        savedRangeRef.current = null
      }
    } else {
      savedRangeRef.current = null
    }

    if (chartRef.current) {
      try { chartRef.current.remove() } catch {}
      chartRef.current = null
    }

    // lightweight-charts 형식으로 변환 + timeframe에 따라 리샘플링
    const dailyData = data
      .filter(d => d.open != null && d.close != null)
      .map(d => ({
        time: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume || 0,
      }))

    // timeframe에 따라 리샘플링
    const chartData = timeframe === '1D' ? dailyData : resampleOHLCV(dailyData, timeframe)

    if (chartData.length === 0) return

    try {
      setError(null)
      const containerWidth = containerRef.current.clientWidth || 800

      // 활성화된 지표 패널 수 계산 (높이 동적 조정)
      const activeCount = Object.values(indicators).filter(Boolean).length
      const mainHeight = activeCount === 0 ? 420 : 280
      const totalHeight = mainHeight + activeCount * 140

      const chart = createChart(containerRef.current, {
        ...getThemeOptions(isDark),
        width: containerWidth,
        height: totalHeight,
      })

      // ── 메인 차트: 캔들스틱 (pane 0) ────────────────────────────────────
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#ff4d4d',
        downColor: '#4d94ff',
        borderVisible: false,
        wickUpColor: '#ff4d4d',
        wickDownColor: '#4d94ff',
      }, 0)
      candleSeries.setData(chartData)

      // ── 매매 일지 마커 ─────────────────────────────────────────────
      if (ticker) {
        const tickerEntries = entries.filter(e => e.ticker === ticker)
        const markers = buildMarkers(tickerEntries, chartData)
        if (markers.length > 0) {
          createSeriesMarkers(candleSeries, markers)
        }
      }

      // 메인 패널 스트레치
      chart.panes()[0].setStretchFactor(activeCount === 0 ? 4 : 3)

      // ── SMA 라인 (pane 0 오버레이) ───────────────────────────────────────
      const addSMA = (period, color) => {
        const smaData = calculateSMA(chartData, period)
        if (smaData.length === 0) return
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1.5,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 0)
        series.setData(smaData)
      }
      addSMA(20, '#FF9800')
      addSMA(60, '#2196F3')
      addSMA(120, '#9C27B0')

      // ── 볼린저 밴드 (pane 0 오버레이) ──────────────────────────────────
      if (indicators.bb) {
        const bbData = calculateBollingerBands(chartData, 20, 2)
        if (bbData.length > 0) {
          const bbOptions = {
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          }
          const upperSeries = chart.addSeries(LineSeries, { ...bbOptions, color: 'rgba(33,150,243,0.6)' }, 0)
          upperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })))

          const middleSeries = chart.addSeries(LineSeries, { ...bbOptions, color: 'rgba(33,150,243,0.9)', lineWidth: 1.5 }, 0)
          middleSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })))

          const lowerSeries = chart.addSeries(LineSeries, { ...bbOptions, color: 'rgba(33,150,243,0.6)' }, 0)
          lowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })))
        }
      }

      // ── 거래량 히스토그램 (pane 0 overlay, 하단 20%) ───────────────────
      const volumeData = chartData
        .filter(d => d.volume != null && d.volume > 0)
        .map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
        }))

      if (volumeData.length > 0) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          priceLineVisible: false,
          lastValueVisible: false,
        }, 0)
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        })
        volumeSeries.setData(volumeData)
      }

      // ── RSI 패널 ─────────────────────────────────────────────────────────
      let paneIndex = 1
      if (indicators.rsi) {
        chart.addPane()
        chart.panes()[paneIndex]?.setStretchFactor(1)

        const rsiData = calculateRSI(chartData, 14)
        if (rsiData.length > 0) {
          const rsiSeries = chart.addSeries(LineSeries, {
            color: '#7E57C2',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
          }, paneIndex)
          rsiSeries.setData(rsiData)
          addRSILevels(chart, rsiData, paneIndex)
        }
        paneIndex++
      }

      // ── MACD 패널 ────────────────────────────────────────────────────────
      if (indicators.macd) {
        chart.addPane()
        chart.panes()[paneIndex]?.setStretchFactor(1)

        const macdData = calculateMACD(chartData, 12, 26, 9)
        if (macdData.length > 0) {
          // MACD 라인
          const macdSeries = chart.addSeries(LineSeries, {
            color: '#2196F3',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          }, paneIndex)
          macdSeries.setData(macdData.map(d => ({ time: d.time, value: d.macd })))

          // Signal 라인
          const signalSeries = chart.addSeries(LineSeries, {
            color: '#FF5722',
            lineWidth: 1.5,
            priceLineVisible: false,
            lastValueVisible: false,
          }, paneIndex)
          signalSeries.setData(macdData.map(d => ({ time: d.time, value: d.signal })))

          // Histogram
          const histSeries = chart.addSeries(HistogramSeries, {
            priceLineVisible: false,
            lastValueVisible: false,
          }, paneIndex)
          histSeries.setData(macdData.map(d => ({
            time: d.time,
            value: d.histogram,
            color: d.histogram >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)',
          })))
        }
        paneIndex++
      }

      chartDataRef.current = chartData
      chartRef.current = chart
      applyPeriod(chart, periodRef.current, chartData, savedRangeRef.current)
      savedRangeRef.current = null

      // 왼쪽 경계 스크롤 감지 → 이전 데이터 로딩 요청 (300ms 디바운스)
      let debounceTimer = null
      const handleRangeChange = (logicalRange) => {
        if (!logicalRange) return
        if (isFetchingMoreRef.current || isMaxRangeRef.current) return
        if (hasTriggeredRef.current) return
        const visibleBars = logicalRange.to - logicalRange.from
        if (logicalRange.from < visibleBars * 0.1) {
          hasTriggeredRef.current = true
          clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            onNeedMoreDataRef.current?.()
          }, 300)
        }
      }
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange)

      return () => {
        clearTimeout(debounceTimer)
        try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange) } catch {}
        try { chart.remove() } catch {}
        chartRef.current = null
      }
    } catch (err) {
      console.error('[CandlestickChart] 차트 생성 실패:', err)
      setError(err.message)
    }
  }, [data, isDark, indicators, timeframe, entries, ticker])

  // 기간 선택 effect — 차트 재생성 없이 visible range만 변경
  useEffect(() => {
    periodRef.current = period
    applyPeriod(chartRef.current, period, chartDataRef.current)
  }, [period])

  // 리사이징 대응 — 별도 effect로 분리하여 중복 등록 방지
  // chartRef를 통해 항상 현재 차트 인스턴스를 참조
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return
      const w = containerRef.current.clientWidth
      if (w > 0) chartRef.current.applyOptions({ width: w })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (error) {
    return (
      <div className="h-[420px] flex flex-col items-center justify-center text-gray-400">
        <p className="text-sm">캔들 차트 로드 실패</p>
        <p className="text-xs mt-1 text-red-400">{error}</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[420px] flex items-center justify-center text-gray-400">
        차트 데이터가 없습니다
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between px-1 pb-2 flex-wrap gap-2">
        {/* 타임프레임 + 기간 선택 */}
        <div className="flex items-center gap-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        {/* 지표 컨트롤 */}
        <IndicatorControls active={indicators} onToggle={handleIndicatorToggle} />
      </div>

      {/* 범례 */}
      <div className="flex items-center flex-wrap gap-3 px-1 pb-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-[#FF9800]" /> MA20
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-[#2196F3]" /> MA60
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-[#9C27B0]" /> MA120
        </span>
        {indicators.bb && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-0.5 bg-[rgba(33,150,243,0.8)]" /> BB(20,2)
          </span>
        )}
        {indicators.rsi && (
          <span className="flex items-center gap-1 text-[#7E57C2]">● RSI(14)</span>
        )}
        {indicators.macd && (
          <>
            <span className="flex items-center gap-1 text-[#2196F3]">● MACD</span>
            <span className="flex items-center gap-1 text-[#FF5722]">● Signal</span>
          </>
        )}
        <span className="flex items-center gap-1 ml-auto text-gray-400">
          양봉&nbsp;<span className="w-3 h-3 rounded-sm bg-[#ff4d4d] inline-block" />
          &nbsp;음봉&nbsp;<span className="w-3 h-3 rounded-sm bg-[#4d94ff] inline-block" />
        </span>
      </div>

      {/* 차트 컨테이너 */}
      <div className="relative">
        {isFetchingMore && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-gray-800/90 rounded-md px-2 py-1 text-xs text-gray-600 dark:text-gray-300 shadow">
            <Loader2 className="w-3 h-3 animate-spin" />
            이전 데이터 로딩 중...
          </div>
        )}
        {isMaxRange && !isFetchingMore && (
          <div className="absolute top-2 left-2 z-10 bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
            최대 조회 범위 (5년)
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%' }} />
      </div>
    </div>
  )
}
