/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'batchcrick': {
          'navy-dark': '#0a1a2e',
          'navy': '#162b4d',
          'navy-light': '#1e3a5f',
          'teal': '#14b8a6',
          'teal-dark': '#0d9488',
          'teal-light': '#5eead4',
          'sky': '#0ea5e9',
          'sky-light': '#38bdf8',
          'wicket': '#ef4444',
          'four': '#3b82f6',
          'six': '#10b981',
          'wide': '#fbbf24',
          'noball': '#f97316',
          'dot': '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
