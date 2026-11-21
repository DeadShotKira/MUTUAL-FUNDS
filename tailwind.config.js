/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fintech: {
          dark: '#030712',
          card: '#0f172a',
          cardHover: '#1e293b',
          border: '#1e293b',
          borderLight: '#334155',
          accent: '#06b6d4',
          accentGlow: 'rgba(6, 182, 212, 0.25)',
          gold: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e',
          indigo: '#6366f1'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.4)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.4)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.4)',
        'glow-gold': '0 0 25px -5px rgba(245, 158, 11, 0.4)',
        'card-elevated': '0 10px 30px -10px rgba(0, 0, 0, 0.7)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite'
      }
    },
  },
  plugins: [],
}
