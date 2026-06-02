// 이탈 시 미동기화 레코드 업로드 확인 모달
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Loader2, CloudUpload, AlertCircle } from 'lucide-react'
import { syncService } from '@/services/syncService'

/**
 * @param {{
 *   open: boolean,
 *   pendingCount: number,
 *   onUploaded: () => void,
 *   onLeave: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function PendingUploadModal({ open, pendingCount, onUploaded, onLeave, onCancel }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUploadAndLeave() {
    setUploading(true)
    setError(null)
    try {
      await syncService.uploadAll()
      onUploaded()
    } catch (err) {
      const msg = err?.message || '알 수 없는 오류'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  function handleLeave() {
    setError(null)
    onLeave()
  }

  function handleCancel() {
    setError(null)
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !uploading) handleCancel() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-blue-500" />
            저장되지 않은 변경사항
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            서버에 저장되지 않은 변경사항이{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {pendingCount}개
            </span>{' '}
            있습니다.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            지금 업로드하지 않으면 이 기기에만 저장됩니다.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">서버 업로드에 실패했습니다.</p>
                <p className="text-xs mt-0.5">{error}</p>
                <p className="text-xs mt-1 text-red-500 dark:text-red-400">
                  변경사항은 로컬 저장소에 보존되어 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
            className="sm:order-first"
          >
            취소
          </Button>
          <Button
            variant="ghost"
            onClick={handleLeave}
            disabled={uploading}
          >
            그냥 이동
          </Button>
          <Button
            onClick={handleUploadAndLeave}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                업로드 중...
              </>
            ) : (
              '업로드 후 이동'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
