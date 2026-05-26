// 매매 심리 카테고리 메타데이터 조회 및 마이그레이션 유틸리티
import { PSYCHOLOGY_METADATA, PSYCHOLOGY_MIGRATION_MAP } from '../store/journalStore'

export const getGroupedPsychology = (action) => {
  const metadata = PSYCHOLOGY_METADATA[action]
  if (!metadata) return []
  return Object.entries(metadata).map(([groupKey, groupData]) => ({
    groupKey,
    groupName: groupKey,
    emoji: groupData.emoji,
    color: groupData.color,
    description: groupData.description,
    categories: groupData.categories,
  }))
}

export const getPsychologyInfo = (action, value) => {
  const metadata = PSYCHOLOGY_METADATA[action]
  if (!metadata) return null
  for (const group of Object.values(metadata)) {
    const cat = group.categories.find(c => c.value === value)
    if (cat) return { ...cat, emoji: group.emoji, color: group.color }
  }
  return null
}

export const migratePsychologyValue = (action, value) => {
  const map = PSYCHOLOGY_MIGRATION_MAP[action]
  return map?.[value] ?? value
}
