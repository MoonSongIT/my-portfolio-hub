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
    localStorage.setItem(key, JSON.stringify(value))
  },

  remove: (key) => {
    localStorage.removeItem(key)
  },

  clear: () => {
    localStorage.clear()
  },
}
