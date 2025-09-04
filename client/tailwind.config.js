/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./widget.html",
    "./admin.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        chat: {
          bg: '#f8fafc',
          user: '#3b82f6',
          bot: '#ffffff',
          border: '#e2e8f0',
        }
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'typing': 'typing 1.4s infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        typing: {
          '0%, 60%': { opacity: '1' },
          '30%': { opacity: '0.5' },
        }
      }
    },
  },
  plugins: [],
}