import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { useSettingsStore } from '../../store/settingsStore'

// SMA(단순이동평균) 계산
function calculateSMA(data, period) {
  return data
    .map((candle, index) => {
      if (index < period - 1) return null
      const sum = data
        .slice(index - period + 1, index + 1)
        .reduce((acc, c) => acc + c.close, 0)
      return { time: candle.time, value: sum / period }
    })
    .filter(Boolean)
}

export default function CandlestickChart({ data = [], ticker = '', timeframe = '1D' }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const [error, setError] = useState(null)
  const { theme } = useSettingsStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    // 이전 차트 인스턴스 정리
    if (chartRef.current) {
      try { chartRef.current.remove() } catch {}
      chartRef.current = null
    }

    // lightweight-charts v5 형식으로 변환 (date → time)
    const chartData = data
      .filter(d => d.open != null && d.close != null)
      .map(d => ({
        time: d.date,
        open:  d.open,
        high:  d.high,
        low:   d.low,
        close: d.close,
      }))

    if (chartData.length === 0) return

    try {
      setError(null)

      // 컨테이너 너비
      const containerWidth = containerRef.current.clientWidth || containerRef.current.offsetWidth || 800

      // ── 차트 생성 ───────────────────────────────────────
      const chart = createChart(containerRef.current, {
        layout: {
          textColor:  isDark ? '#d1d5db' : '#374151',
          background: { type: 'solid', color: isDark ? '#1f2937' : '#ffffff' },
        },
        grid: {
          vertLines: { color: isDark ? '#374151' : '#f3f4f6' },
          horzLines: { color: isDark ? '#374151' : '#f3f4f6' },
        },
        timeScale: {
          timeVisible:    false,
          secondsVisible: false,
          borderColor: isDark ? '#4b5563' : '#e5e7eb',
        },
        rightPriceScale: {
          borderColor: isDark ? '#4b5563' : '#e5e7eb',
          scaleMargins: { top: 0.05, bottom: 0.25 },  // 하단 25%를 거래량 영역으로
        },
        crosshair: {
          mode: 0,   // Normal
        },
        width:  containerWidth,
        height: 420,
      })

      // ── 캔들스틱 시리즈 ─────────────────────────────────
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor:       '#26a69a',
        downColor:     '#ef5350',
        borderVisible: false,
        wickUpColor:   '#26a69a',
        wickDownColor: '#ef5350',
      })
      candleSeries.setData(chartData)

      // ── 이동평균선 ──────────────────────────────────────
      const addSMA = (period, color) => {
        const smaData = calculateSMA(chartData, period)
        if (smaData.length === 0) return
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1.5,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        series.setData(smaData)
      }
      addSMA(20,  '#FF9800')   // 주황
      addSMA(60,  '#2196F3')   // 파랑
      addSMA(120, '#9C27B0')   // 보라

      // ── 거래량 히스토그램 (같은 pane, 별도 priceScale로 하단 오버레이) ──
      const volumeData = data
        .filter(d => d.volume != null && d.volume > 0)
        .map(d => ({
          time:  d.date,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
        }))

      if (volumeData.length > 0) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat:     { type: 'volume' },
          priceScaleId:    'volume',           // 별도 price scale
          priceLineVisible: false,
          lastValueVisible: false,
        })
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },  // 하단 20% 영역에 표시
        })
        volumeSeries.setData(volumeData)
      }

      // ── 시간축 전체 맞춤 ────────────────────────────────
      chart.timeScale().fitContent()

      // ── 창 리사이징 대응 ────────────────────────────────
      const handleResize = () => {
        if (!containerRef.current) return
        const w = containerRef.current.clientWidth || containerRef.current.offsetWidth
        if (w > 0) chart.applyOptions({ width: w })
      }
      window.addEventListener('resize', handleResize)
      chartRef.current = chart

      return () => {
        window.removeEventListener('resize', handleResize)
        try { chart.remove() } catch {}
        chartRef.current = null
      }
    } catch (err) {
      console.error('[CandlestickChart] 차트 생성 실패:', err)
      setError(err.message)
    }
  }, [data, isDark])

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove() } catch {}
        chartRef.current = null
      }
    }
  }, [])

  if (error) {
    return (
      <div className="h-[420px] flex flex-col items-center justify-center text-gray-400">
        <p className="text-sm">캔들 차트 로드 실패</p>
        <p className="text-xs mt-1 text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {data.length === 0 ? (
        <div className="h-[420px] flex items-center justify-center text-gray-400">
          차트 데이터가 없습니다
        </div>
      ) : (
        <>
          {/* 범례 */}
          <div className="flex items-center gap-4 px-1 pb-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5 bg-[#FF9800]" /> MA20
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5 bg-[#2196F3]" /> MA60
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5 bg-[#9C27B0]" /> MA120
            </span>
            <span className="flex items-center gap-1 ml-auto text-gray-400">
              양봉&nbsp;
              <span className="w-3 h-3 rounded-sm bg-[#26a69a] inline-block" />
              &nbsp;음봉&nbsp;
              <span className="w-3 h-3 rounded-sm bg-[#ef5350] inline-block" />
            </span>
          </div>
          {/* 차트 컨테이너 */}
          <div ref={containerRef} style={{ width: '100%', minHeight: '420px' }} />
        </>
      )}
    </div>
  )
}
