import { useEffect, useRef } from 'react'
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
  const { theme } = useSettingsStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    // lightweight-charts 형식으로 변환 (date → time)
    const chartData = data
      .filter(d => d.open != null && d.close != null)
      .map(d => ({
        time: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

    if (chartData.length === 0) return

    // 차트 생성
    const chart = createChart(containerRef.current, {
      layout: {
        textColor: isDark ? '#d1d5db' : '#374151',
        background: { type: 'solid', color: isDark ? '#1f2937' : '#ffffff' },
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#f3f4f6' },
        horzLines: { color: isDark ? '#374151' : '#f3f4f6' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: isDark ? '#4b5563' : '#e5e7eb',
      },
      rightPriceScale: {
        borderColor: isDark ? '#4b5563' : '#e5e7eb',
      },
      width: containerRef.current.clientWidth,
      height: 420,
    })

    // 캔들스틱 시리즈
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })
    candleSeries.setData(chartData)

    // SMA 20일선 (주황)
    const sma20Data = calculateSMA(chartData, 20)
    if (sma20Data.length > 0) {
      const sma20Series = chart.addSeries(LineSeries, {
        color: '#FF9800',
        lineWidth: 2,
        title: 'SMA 20',
        priceLineVisible: false,
        lastValueVisible: false,
      })
      sma20Series.setData(sma20Data)
    }

    // SMA 60일선 (파랑)
    const sma60Data = calculateSMA(chartData, 60)
    if (sma60Data.length > 0) {
      const sma60Series = chart.addSeries(LineSeries, {
        color: '#2196F3',
        lineWidth: 2,
        title: 'SMA 60',
        priceLineVisible: false,
        lastValueVisible: false,
      })
      sma60Series.setData(sma60Data)
    }

    // SMA 120일선 (보라)
    const sma120Data = calculateSMA(chartData, 120)
    if (sma120Data.length > 0) {
      const sma120Series = chart.addSeries(LineSeries, {
        color: '#9C27B0',
        lineWidth: 2,
        title: 'SMA 120',
        priceLineVisible: false,
        lastValueVisible: false,
      })
      sma120Series.setData(sma120Data)
    }

    // 거래량 히스토그램 (별도 패널)
    const volumePane = chart.addPane()
    const volumeSeries = volumePane.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    const volumeData = data
      .filter(d => d.volume != null)
      .map(d => ({
        time: d.date,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)',
      }))
    if (volumeData.length > 0) {
      volumeSeries.setData(volumeData)
    }

    // 시간축 전체 맞춤
    chart.timeScale().fitContent()

    // 창 리사이징 처리
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    chartRef.current = chart

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [data, isDark])

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
              <span className="inline-block w-6 h-0.5 bg-[#FF9800]" /> SMA 20
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-0.5 bg-[#2196F3]" /> SMA 60
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-0.5 bg-[#9C27B0]" /> SMA 120
            </span>
          </div>
          <div ref={containerRef} style={{ width: '100%' }} />
        </>
      )}
    </div>
  )
}
