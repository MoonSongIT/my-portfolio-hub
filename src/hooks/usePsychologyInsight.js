// 수익성 고도화 인사이트 계산을 위한 커스텀 훅
import { useMemo } from 'react'
import { useJournalStore } from '../store/journalStore'
import {
  calcPsychologyStats,
  findRepeatedMistakes,
  findBestPatterns,
  getPsychologyHistory,
  calcPsychologyMaturityScore,
  buildStockPsychologyMatrix,
} from '../utils/calculator'

export const usePsychologyInsight = () => {
  const entries = useJournalStore(s => s.entries)

  const stats = useMemo(() => calcPsychologyStats(entries), [entries])
  const mistakes = useMemo(() => findRepeatedMistakes(entries), [entries])
  const bestPatterns = useMemo(() => findBestPatterns(entries), [entries])
  const maturityScore = useMemo(() => calcPsychologyMaturityScore(entries), [entries])
  const matrix = useMemo(() => buildStockPsychologyMatrix(entries), [entries])

  const getHistory = (psychology, action) =>
    getPsychologyHistory(entries, psychology, action)

  return { stats, mistakes, bestPatterns, maturityScore, matrix, getHistory }
}
