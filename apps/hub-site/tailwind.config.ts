import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bgSecondary: 'var(--bg-secondary)',
        surface: 'var(--surface)',
        surfaceHover: 'var(--surface-hover)',
        line: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        primary: 'var(--primary)',
        primarySoft: 'var(--primary-soft)',
        accentSoft: 'var(--primary-dim)',
        input: 'var(--input-bg)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        catPurple: 'var(--cat-purple)',
        catGreen: 'var(--cat-green)',
        catOrange: 'var(--cat-orange)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Sora', 'sans-serif'],
        body: ['var(--font-body)', 'DM Sans', 'sans-serif'],
      },
      borderRadius: {
        hub: '12px',
      },
      boxShadow: {
        card: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
        sm: 'var(--shadow-sm)',
      },
    },
  },
  plugins: [],
};

export default config;
