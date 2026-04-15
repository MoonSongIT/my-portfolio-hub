import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { useSettingsStore } from '../../store/settingsStore'
import { calculateSMA, calculateBollingerBands, calculateRSI, calculateMACD, resampleOHLCV } from '../../utils/technicalIndicators'
import TimeframeSelector from './TimeframeSelector'
import IndicatorControls from './IndicatorControls'

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
    },
    rightPriceScale: {
      borderColor: isDark ? '#4b5563' : '#e5e7eb',
    },
    crosshair: { mode: 0 },
  }
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

export default function CandlestickChart({ data = [], ticker = '' }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME)
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS)
  const { theme } = useSettingsStore()
  const isDark = theme === 'dark'

  // 지표 토글
  const handleIndicatorToggle = useCallback((key, value) => {
    setIndicators(prev => ({ ...prev, [key]: value }))
  }, [])

  // 차트 빌드 함수 (data, isDark, indicators 변경 시 재생성)
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    // 이전 차트 정리
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
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      }, 0)
      candleSeries.setData(chartData)

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

      chart.timeScale().fitContent()
      chartRef.current = chart

      return () => {
        try { chart.remove() } catch {}
        chartRef.current = null
      }
    } catch (err) {
      console.error('[CandlestickChart] 차트 생성 실패:', err)
      setError(err.message)
    }
  }, [data, isDark, indicators, timeframe])

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
        {/* 타임프레임 */}
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />

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
          양봉&nbsp;<span className="w-3 h-3 rounded-sm bg-[#26a69a] inline-block" />
          &nbsp;음봉&nbsp;<span className="w-3 h-3 rounded-sm bg-[#ef5350] inline-block" />
        </span>
      </div>

      {/* 차트 컨테이너 */}
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  )
}
