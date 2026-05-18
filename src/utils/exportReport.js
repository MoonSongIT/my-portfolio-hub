// PNG / PDF 내보내기 유틸리티

function triggerDownload(href, filename) {
  const link = document.createElement('a')
  link.download = filename
  link.href = href
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 부모 체인의 overflow 제한을 일시 해제
function unlockOverflow(el) {
  const saved = []
  let node = el.parentElement
  while (node && node !== document.body) {
    const cs = getComputedStyle(node)
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible') {
      saved.push({ node, overflow: node.style.overflow, overflowX: node.style.overflowX })
      node.style.overflow = 'visible'
      node.style.overflowX = 'visible'
    }
    node = node.parentElement
  }
  return saved
}

function restoreOverflow(saved) {
  saved.forEach(({ node, overflow, overflowX }) => {
    node.style.overflow = overflow
    node.style.overflowX = overflowX
  })
}

async function capture(elementRef, pixelRatio = 2) {
  const { toPng } = await import('html-to-image')

  // 1) 부모 overflow 해제
  const savedParents = unlockOverflow(elementRef)

  // 2) 요소 자체 스타일 백업 및 변경
  const prev = {
    width: elementRef.style.width,
    minWidth: elementRef.style.minWidth,
    overflow: elementRef.style.overflow,
  }
  elementRef.style.width = 'max-content'
  elementRef.style.minWidth = '1280px'
  elementRef.style.overflow = 'visible'

  // 레이아웃 재계산 대기
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const w = elementRef.scrollWidth
  const h = elementRef.scrollHeight

  const dataUrl = await toPng(elementRef, { pixelRatio, width: w, height: h })

  // 3) 원복
  elementRef.style.width = prev.width
  elementRef.style.minWidth = prev.minWidth
  elementRef.style.overflow = prev.overflow
  restoreOverflow(savedParents)

  return { dataUrl, cssWidth: w, cssHeight: h }
}

export async function exportAsPNG(elementRef, filename = 'report') {
  const { dataUrl } = await capture(elementRef, 2)
  triggerDownload(dataUrl, `${filename}.png`)
}

async function captureCover(cssWidth, cssHeight, meta) {
  const { toPng } = await import('html-to-image')
  const cover = document.createElement('div')
  cover.style.cssText = [
    `width:${cssWidth}px`, `height:${cssHeight}px`, 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:24px',
    'background:linear-gradient(135deg,#1e3a5f 0%,#0f1f3d 100%)',
    'font-family:sans-serif', 'position:fixed', 'top:-9999px', 'left:-9999px',
  ].join(';')

  const now = new Date()
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`
  const ret = meta.totalReturn ?? null
  const returnStr = ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '–'

  cover.innerHTML = `
    <div style="color:#93c5fd;font-size:14px;letter-spacing:2px;">PORTFOLIO REPORT</div>
    <div style="color:#f1f5f9;font-size:36px;font-weight:700;letter-spacing:-1px;">투자 성과 리포트</div>
    <div style="width:60px;height:3px;background:#3b82f6;border-radius:2px;"></div>
    <div style="color:#e2e8f0;font-size:48px;font-weight:800;">${returnStr}</div>
    <div style="color:#94a3b8;font-size:15px;">총 수익률</div>
    <div style="color:#64748b;font-size:13px;margin-top:16px;">${dateStr} 기준 · My Portfolio Hub</div>
  `
  document.body.appendChild(cover)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const dataUrl = await toPng(cover, { pixelRatio: 1, width: cssWidth, height: cssHeight })
  document.body.removeChild(cover)
  return dataUrl
}

export async function exportAsPDF(elementRef, filename = 'report', meta = {}) {
  const { jsPDF } = await import('jspdf')
  const { dataUrl, cssWidth, cssHeight } = await capture(elementRef, 1)
  const coverUrl = await captureCover(cssWidth, cssHeight, meta)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [cssWidth, cssHeight] })
  pdf.addImage(coverUrl, 'PNG', 0, 0, cssWidth, cssHeight)
  pdf.addPage([cssWidth, cssHeight])
  pdf.addImage(dataUrl, 'PNG', 0, 0, cssWidth, cssHeight)
  pdf.save(`${filename}.pdf`)
}
