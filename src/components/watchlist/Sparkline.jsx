/**
 * Sparkline — 미니 가격 추이 SVG 차트
 * 관심종목 카드에 표시되는 5~20일 종가 라인
 */

export default function Sparkline({ data, width = 88, height = 36, positive }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-20 bg-gray-200 dark:bg-gray-700 rounded" />
  }

  const prices = data.map(d => d.close).filter(v => v != null && !isNaN(v))
  if (prices.length < 2) return null

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pad = 2 // vertical padding (px)

  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * width
      const y = pad + ((max - p) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const color = positive ? '#10b981' : '#ef4444'
  const fillId = `spark-fill-${positive ? 'pos' : 'neg'}`

  // 마지막 포인트 좌표 (dot 표시용)
  const lastX = width
  const lastY = pad + ((max - prices[prices.length - 1]) / range) * (height - pad * 2)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 채움 영역 */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${fillId})`}
      />

      {/* 라인 */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 마지막 점 */}
      <circle
        cx={lastX}
        cy={lastY}
        r="2"
        fill={color}
      />
    </svg>
  )
}
