// PNG / PDF 내보내기 유틸리티

export async function exportAsPNG(elementRef, filename = 'report') {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(elementRef, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })
  const link = document.createElement('a')
  link.download = `${filename}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export async function exportAsPDF(elementRef, filename = 'report') {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')

  const canvas = await html2canvas(elementRef, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
  pdf.save(`${filename}.pdf`)
}
