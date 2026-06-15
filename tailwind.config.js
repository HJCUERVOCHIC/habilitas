/**
 * Habilitas — Design System v1.0 (Tailwind v3)
 * Todos los tokens provienen de HABILITAS-STACK.md §6.
 * Los tokens semánticos de shadcn (background, primary, border, ...) se mapean
 * a valores Habilitas vía variables CSS en globals.css (formato HSL "H S% L%").
 * @type {import('tailwindcss').Config}
 */
const config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- Tokens semánticos shadcn (mapeados a Habilitas) ---
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // --- Tokens de marca Habilitas (HABILITAS-STACK.md §6) ---
        teal: {
          DEFAULT: '#0A6E6E',
          light: '#0E8F8F',
          mid: '#C2E8E8',
          pale: '#E6F5F5',
        },
        charcoal: '#1A2A2A',
        slate: '#3D5454',
        mist: '#F2F8F8',
        sand: '#F7F3EE',
        amber: {
          DEFAULT: '#C8833A',
          pale: '#FDF0E3',
        },
        green: {
          ok: '#1A7A4A',
          pale: '#E4F5EC',
        },
        red: {
          err: '#C0392B',
          pale: '#FDE8E8',
        },
        // Color de categoría "enfermeria"
        blue: '#2E86AB',
        // Textos (named 'ink' para no colisionar con utilidades text-*)
        ink: {
          main: '#1A2A2A',
          soft: '#5A7070',
          muted: '#8AACAC',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-dm-serif)', 'ui-serif', 'Georgia', 'serif'],
        // DM Serif Display: usar SOLO en hero, section-title, precios,
        // nombre del profesional en el certificado y pantalla de celebración.
        display: ['var(--font-dm-serif)', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-sm': ['1.75rem', { lineHeight: '1.15' }], // 28px — celebración
        'display-md': ['2.125rem', { lineHeight: '1.1' }], // 34px — nombre en certificado
        'display-lg': ['2.375rem', { lineHeight: '1.1' }], // 38px — section title
        'display-3xl': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }], // hero
      },
      spacing: {
        section: '60px', // padding horizontal de secciones grandes
        hero: '72px', // padding vertical de hero y secciones
      },
      borderRadius: {
        lg: 'var(--radius-lg)', // 20px — cards grandes, modales, purchase card
        md: 'var(--radius)', //    12px — cards medias, inputs, badges
        sm: 'calc(var(--radius) - 4px)', // 8px
      },
      boxShadow: {
        sm: '0 2px 8px rgba(10,110,110,.08)', // navbar, cards default
        md: '0 6px 24px rgba(10,110,110,.12)', // hover, modales ligeros
        lg: '0 16px 48px rgba(10,110,110,.16)', // modales overlay, hero card
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

module.exports = config
