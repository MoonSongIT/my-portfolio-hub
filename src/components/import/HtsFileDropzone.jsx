import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { parseHtsWorkbook } from '../../utils/htsParser'
import { useImportStore } from '../../store/importStore'
import LoadingSpinner from '../common/LoadingSpinner'

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']

function isValidExtension(filename) {
  return ACCEPTED_EXTENSIONS.some((ext) =>
    filename.toLowerCase().endsWith(ext)
  )
}

export default function HtsFileDropzone() {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const setParsedSheets = useImportStore((s) => s.setParsedSheets)

  async function handleFile(file) {
    if (!file) return
    if (!isValidExtension(file.name)) {
      toast.error('.xlsx 또는 .xls 파일만 지원합니다')
      return
    }

    setIsLoading(true)
    try {
      const sheets = await parseHtsWorkbook(file)
      if (sheets.length === 0 || sheets.every((s) => s.entries.length === 0)) {
        toast.error('파싱된 거래 데이터가 없습니다. 파일을 확인해주세요.')
        return
      }
      setParsedSheets(sheets)
      const total = sheets.reduce((acc, s) => acc + s.entries.length, 0)
      toast.success(`${total}건 로드 완료`)
    } catch (err) {
      toast.error('파일 읽기 실패: ' + (err?.message ?? '알 수 없는 오류'))
    } finally {
      setIsLoading(false)
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  function onDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave() {
    setIsDragging(false)
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={[
        'flex flex-col items-center justify-center gap-3',
        'rounded-xl border-2 border-dashed p-12 cursor-pointer',
        'transition-colors select-none',
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50',
      ].join(' ')}
    >
      <Upload className="h-10 w-10 text-gray-400" />
      <p className="text-sm font-medium text-gray-700">
        HTS 거래내역 엑셀 파일을 드래그하거나 클릭해서 선택
      </p>
      <p className="text-xs text-gray-400">.xlsx, .xls 지원</p>
      <input
        ref={inputRef}
        id="hts-file-input"
        name="file"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
