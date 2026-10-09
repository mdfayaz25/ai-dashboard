/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        night: { DEFAULT: '#0B1220', 2: '#111A2E', 3: '#1A2540', line: '#22304F' },
        brand: {
          50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9', 400: '#22D3EE',
          500: '#06B6D4', 600: '#0891B2', 700: '#0E7490', 800: '#155E75', 900: '#164E63',
        },
        violet: { 400: '#A78BFA', 500: '#8B5CF6' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(11 18 32 / .05), 0 0 0 1px rgb(11 18 32 / .02)',
        lift: '0 16px 40px -16px rgb(11 18 32 / .25)',
        pop: '0 30px 70px -24px rgb(11 18 32 / .45)',
      },
      keyframes: {
        caret: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } },
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: { caret: 'caret 1s steps(1) infinite', 'fade-up': 'fade-up .4s cubic-bezier(.2,.8,.2,1) both', shimmer: 'shimmer 2.2s linear infinite' },
    },
  },
  plugins: [],
};
