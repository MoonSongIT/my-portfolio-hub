// 관심종목 태그(groups)를 Supabase profiles.watchlist_groups 컬럼에 저장/로드
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'

/**
 * 태그 목록을 서버에 저장한다.
 * @param {Array<{id: string, name: string, color: string, createdAt: string}>} groups
 */
export async function saveGroupsToServer(groups) {
  if (!supabase) return
  const userId = useAuthStore.getState().currentUser?.id
  if (!userId) return

  const { error } = await supabase
    .from('profiles')
    .update({ watchlist_groups: groups })
    .eq('id', userId)

  if (error) console.warn('[groupsApi] saveGroupsToServer failed:', error.message)
}

/**
 * 서버에서 태그 목록을 가져온다.
 * @returns {Array<{id: string, name: string, color: string, createdAt: string}>|null}
 */
export async function loadGroupsFromServer() {
  if (!supabase) return null
  const userId = useAuthStore.getState().currentUser?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('watchlist_groups')
    .eq('id', userId)
    .single()

  if (error) {
    console.warn('[groupsApi] loadGroupsFromServer failed:', error.message)
    return null
  }

  return Array.isArray(data?.watchlist_groups) ? data.watchlist_groups : null
}
