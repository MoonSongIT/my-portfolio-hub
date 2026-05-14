// 유진투자증권 HTS Excel 거래내역을 파싱해 매매일지에 일괄 가져오는 모달
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useJournalStore } from '../../store/journalStore'
import { parseHtsWorkbook } from '../../utils/htsParser'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import AccountSelector from '../account/AccountSelector'
import { formatCurrency } from '../../utils/formatters'

export default function HtsImportModal({ open, onClose }) {
  const { findEntryByExternalId, addEntriesBulk } = useJournalStore()
  const [accountId, setAccountId] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setParsedRows([])

    try {
      const results = await parseHtsWorkbook(file)
      const allEntries = results.flatMap(r => r.entries)
      if (allEntries.length === 0) {
        setParseError('파싱된 거래 내역이 없습니다. 파일 형식을 확인해주세요.')
        return
      }
      const withId = allEntries.map(e => ({
        ...e,
        externalId: `eugene-hts::${e.date}::${e.ticker}::${e.action}::${e.price}::${e.quantity}`,
      }))
      setParsedRows(withId)
    } catch (err) {
      setParseError(`파일을 읽을 수 없습니다. ${err?.message ?? ''}`)
    }
  }

  const isDuplicate = (row) => !!findEntryByExternalId(row.externalId)

  const newRows = parsedRows.filter(r => !isDuplicate(r))

  const handleImport = async () => {
    if (!accountId) {
      toast.error('계좌를 선택해주세요.')
      return
    }
    if (newRows.length === 0) {
      toast.info('가져올 신규 항목이 없습니다.')
      return
    }
    setImporting(true)
    try {
      const entries = newRows.map(r => ({
        ...r,
        accountId,
        psychology: '기타',
        fee: (r.commission || 0) + (r.tax || 0),
        pnl: r.action === 'sell' ? (r.realizedPnl != null ? r.realizedPnl : null) : null,
      }))
      const count = addEntriesBulk(entries)
      toast.success(`${count}건을 가져왔습니다.`)
      handleClose()
    } catch (err) {
      toast.error(`가져오기 실패: ${err?.message ?? ''}`)
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setParsedRows([])
    setParseError(null)
    setAccountId('')
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>HTS 거래내역 가져오기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* 계좌 선택 */}
          <div>
            <p className="text-sm text-gray-500 mb-1">가져올 계좌를 선택하세요.</p>
            <AccountSelector
              value={accountId}
              onChange={setAccountId}
              showAllOption={false}
            />
          </div>

          {/* 파일 선택 */}
          <div>
            <p className="text-sm text-gray-500 mb-1">유진투자증권 HTS 거래내역 Excel 파일(.xlsx/.xls)을 선택하세요.</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
            />
          </div>

          {/* 파싱 에러 */}
          {parseError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
              {parseError}
            </p>
          )}

          {/* 미리보기 테이블 */}
          {parsedRows.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-1.5">
                총 {parsedRows.length}건 파싱됨 —
                <span className="text-blue-600 dark:text-blue-400 font-medium"> 신규 {newRows.length}건</span>
                {parsedRows.length - newRows.length > 0 && (
                  <span className="text-gray-400"> / 중복 {parsedRows.length - newRows.length}건 (회색)</span>
                )}
              </p>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['날짜', '종목코드', '종목명', '매수/매도', '가격', '수량'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {parsedRows.map((row, i) => {
                      const dup = isDuplicate(row)
                      return (
                        <tr
                          key={i}
                          className={dup ? 'opacity-40 bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}
                        >
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2 font-mono">{row.ticker}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              row.action === 'buy'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            }`}>
                              {row.action === 'buy' ? '매수' : '매도'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.price, 'KRW')}</td>
                          <td className="px-3 py-2 text-right">{row.quantity.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={importing}>취소</Button>
          <Button
            onClick={handleImport}
            disabled={importing || newRows.length === 0}
          >
            {importing ? '가져오는 중…' : `가져오기 ${newRows.length}건`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
