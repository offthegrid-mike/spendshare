/** Maps a semantic token from src/index.css, keeping opacity modifiers working. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Geist Variable"',
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
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        recessed: token('recessed'),
        line: token('line'),
        negative: token('negative'),
        'on-accent': token('on-accent'),
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
          faint: token('ink-faint'),
        },
        accent: {
          DEFAULT: token('accent'),
          ink: token('accent-ink'),
          soft: token('accent-soft'),
          // Legacy teal shades, removed in redesign PR 5.
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
        // Legacy emerald scale, removed in redesign PR 5.
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
      },
      backgroundImage: {
        // Legacy, removed in redesign PR 5.
        'brand-gradient': 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
      },
      keyframes: {
        expand: {
          from: { gridTemplateRows: '0fr', opacity: '0' },
          to: { gridTemplateRows: '1fr', opacity: '1' },
        },
        'menu-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'menu-in': 'menu-in 150ms cubic-bezier(.16,1,.3,1)',
        expand: 'expand 200ms cubic-bezier(.16,1,.3,1)',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
        // Legacy, removed in redesign PR 5.
        card: '0 1px 2px 0 rgba(16,24,40,0.04), 0 4px 16px -4px rgba(16,24,40,0.08)',
        'card-hover':
          '0 2px 4px 0 rgba(16,24,40,0.06), 0 12px 28px -6px rgba(16,24,40,0.16)',
        brand: '0 6px 20px -6px rgba(5,150,105,0.5)',
      },
    },
  },
  plugins: [],
}
