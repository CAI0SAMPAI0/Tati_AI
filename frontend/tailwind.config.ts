import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './providers/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          dim: 'var(--primary-dim)',
          glow: 'var(--primary-glow)',
        },
        bg: {
          DEFAULT: 'var(--bg)',
          secondary: 'var(--bg-secondary)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          hover: 'var(--surface-hover)',
        },
        card: 'var(--card)',
        border: {
          DEFAULT: 'var(--border)',
          focus: 'var(--border-focus)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
        input: 'var(--input-bg)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        line: 'var(--border)',
        primarySoft: 'var(--primary-soft)',
        bgSecondary: 'var(--bg-secondary)',
        catPurple: 'var(--cat-purple)',
        catGreen: 'var(--cat-green)',
        catOrange: 'var(--cat-orange)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Sora', 'sans-serif'],
        body: ['var(--font-body)', 'DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.8125rem', { lineHeight: '1.5' }],
        base: ['0.9375rem', { lineHeight: '1.6' }],
        lg: ['1.0625rem', { lineHeight: '1.5' }],
        xl: ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        '3xl': ['1.875rem', { lineHeight: '1.2' }],
        '4xl': ['2.25rem', { lineHeight: '1.1' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '6.5': '1.625rem',
        '7.5': '1.875rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '17': '4.25rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
        hub: '12px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
        card: 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        ease: 'var(--ease)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
