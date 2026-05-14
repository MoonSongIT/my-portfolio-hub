import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'

export default function AutoSnapshotDialog({ open, countdown, onConfirm, onDismiss }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>📈 오늘 손익 저장</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            장 마감 시간이 되었습니다.<br />
            오늘 보유 종목의 손익을 저장하시겠습니까?
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-bold text-base">
              {countdown}
            </span>
            <span>초 후 자동 저장됩니다.</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDismiss}>오늘은 건너뛰기</Button>
          <Button onClick={onConfirm}>지금 저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
