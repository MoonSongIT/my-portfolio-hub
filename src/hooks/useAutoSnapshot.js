import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

const TRIGGER_HOUR   = 15
const TRIGGER_MINUTE = 30
const COUNTDOWN_SEC  = 30

const STORAGE_KEY = 'autoSnapshot_lastTriggered'

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isTodayAlreadyTriggered() {
  return localStorage.getItem(STORAGE_KEY) === getTodayStr()
}

function markTodayTriggered() {
  localStorage.setItem(STORAGE_KEY, getTodayStr())
}

function isWeekday() {
  const day = new Date().getDay()
  return day >= 1 && day <= 5
}

// 15:30 이후 ~ 17:00 이전이면 트리거 가능 (앱을 늦게 켜도 당일 안에 팝업 표시)
function isSnapshotTime() {
  const now = new Date()
  const total = now.getHours() * 60 + now.getMinutes()
  const trigger = TRIGGER_HOUR * 60 + TRIGGER_MINUTE
  return total >= trigger && total < trigger + 90
}

export function useAutoSnapshot() {
  const currentUser  = useAuthStore(s => s.currentUser)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [countdown, setCountdown]   = useState(COUNTDOWN_SEC)
  const autoRunRef   = useRef(null)
  const executeFnRef = useRef(null)

  const openDialog = useCallback((execFn) => {
    executeFnRef.current = execFn
    setCountdown(COUNTDOWN_SEC)
    setDialogOpen(true)

    autoRunRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(autoRunRef.current)
          setDialogOpen(false)
          executeFnRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleConfirm = useCallback(() => {
    clearInterval(autoRunRef.current)
    setDialogOpen(false)
    executeFnRef.current?.()
  }, [])

  const handleDismiss = useCallback(() => {
    clearInterval(autoRunRef.current)
    setDialogOpen(false)
    markTodayTriggered() // 취소해도 오늘은 다시 묻지 않음
  }, [])

  useEffect(() => {
    if (!currentUser) return

    const check = async () => {
      if (!isWeekday()) return
      if (!isSnapshotTime()) return
      if (isTodayAlreadyTriggered()) return

      markTodayTriggered()

      const { snapshotToday } = await import('../api/dailyPnlService')
      openDialog(() => snapshotToday())
    }

    // 마운트 즉시 1회 체크 (앱을 15:30 이후에 켜도 당일 팝업 표시)
    check()

    // 다음 분 0초부터 매 분마다 체크 (정각 체크로 15:30 포착)
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000
    let intervalId

    const timeoutId = setTimeout(() => {
      check()
      intervalId = setInterval(check, 60_000)
    }, msToNextMinute)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
      clearInterval(autoRunRef.current)
    }
  }, [currentUser, openDialog])

  return { dialogOpen, countdown, handleConfirm, handleDismiss }
}
