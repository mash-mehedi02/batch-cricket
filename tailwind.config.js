/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cricbuzz-green': '#2d5016',
        'cricbuzz-blue': '#1e40af',
        'cricbuzz-dark': '#1a1a1a',
        'cricbuzz-light': '#f5f5f5',
        'primary-teal': '#0d9488',
        'primary-cyan': '#06b6d4',
        'primary-green': '#009270',
        'primary-navy': '#0A2540',
        'accent-blue': '#4F9CF9',
        'bg-light': '#F8FAFC',
      },
      screens: {
        'xs': '475px',
      },
      touchAction: {
        'pan-x': 'pan-x',
        'pan-y': 'pan-y',
      },
    },
  },
  plugins: [],
}

