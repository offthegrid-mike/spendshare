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
        warning: token('warning'),
        'warning-soft': token('warning-soft'),
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
        },
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
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'menu-in': 'menu-in 150ms cubic-bezier(.16,1,.3,1)',
        'fade-in': 'fade-in 180ms cubic-bezier(.16,1,.3,1)',
        expand: 'expand 200ms cubic-bezier(.16,1,.3,1)',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
}
