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

export async function exportAsPDF(elementRef, filename = 'report') {
  const { jsPDF } = await import('jspdf')
  const { dataUrl, cssWidth, cssHeight } = await capture(elementRef, 1)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [cssWidth, cssHeight] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, cssWidth, cssHeight)
  pdf.save(`${filename}.pdf`)
}
