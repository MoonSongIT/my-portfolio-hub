// LocalStorage 헬퍼
export const storage = {
  get: (key) => {
    try {
      return JSON.parse(localStorage.getItem(key))
    } catch {
      return null
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.error('LocalStorage set error:', e)
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.error('LocalStorage remove error:', e)
    }
  },

  clear: () => {
    try {
      localStorage.clear()
    } catch (e) {
      console.error('LocalStorage clear error:', e)
    }
  },
}
