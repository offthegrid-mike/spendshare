/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Brand = fresh emerald/teal "money" palette
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
        'app-surface':
          'radial-gradient(1200px 600px at 100% -10%, #d1fae5 0%, rgba(209,250,229,0) 55%), radial-gradient(1000px 500px at -10% 0%, #cffafe 0%, rgba(207,250,254,0) 50%)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16,24,40,0.04), 0 4px 16px -4px rgba(16,24,40,0.08)',
        'card-hover':
          '0 2px 4px 0 rgba(16,24,40,0.06), 0 12px 28px -6px rgba(16,24,40,0.16)',
        brand: '0 6px 20px -6px rgba(5,150,105,0.5)',
      },
    },
  },
  plugins: [],
}
