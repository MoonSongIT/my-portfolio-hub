/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@radix-ui/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',    // 파란색 (금융 앱 표준)
        success: '#10b981',    // 초록색 (수익)
        danger: '#ef4444',     // 빨강색 (손실)
        warning: '#f59e0b',    // 주황색 (주의)
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
