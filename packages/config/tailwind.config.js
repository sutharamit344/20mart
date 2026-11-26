/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          orange: {
            DEFAULT: '#FF7A00',
            50: '#FFF7ED',
            100: '#FFEED4',
            200: '#FED7AA',
            300: '#FDBA74',
            400: '#FB923C',
            500: '#FF7A00',
            600: '#E66E00',
            700: '#C25D00',
            800: '#9E4B00',
            900: '#7A3900',
          },
          green: {
            DEFAULT: '#0B5D3B',
            50: '#F0FDF6',
            100: '#DCFCE7',
            200: '#BBF7D0',
            300: '#86EFAC',
            400: '#4ADE80',
            500: '#22C55E',
            600: '#16A34A',
            700: '#0E734A',
            800: '#0B5D3B',
            900: '#074028',
            950: '#042819',
            /** Hover/pressed state for dark-green surfaces and buttons. */
            hover: '#08492E',
          },
          cream: {
            DEFAULT: '#FFF6E9',
            50: '#FFFBF5',
            100: '#FFF6E9',
            200: '#FFEED4',
            300: '#FEDCA9',
          },
          neutral: {
            bg: '#F8F9FA',
            card: '#FFFFFF',
            border: '#E5E7EB',
            subtle: '#F3F4F6',
          }
        },
        /* ── Shared 20Mart design system (storefront + admin). See docs/design/design-system.md ── */
        /** Text. ink = headings/body, ink-500 = secondary, ink-400 = hints/placeholders. */
        ink: {
          DEFAULT: '#111827',
          800: '#1F2937',
          700: '#374151',
          600: '#4B5563',
          500: '#6B7280',
          400: '#9CA3AF',
        },
        /** Borders and dividers. */
        line: {
          DEFAULT: '#E5E7EB',
          subtle: '#EEF0F2',
          strong: '#D1D5DB',
        },
        /** Backgrounds. page = app background, muted = wells/inputs, card = raised content. */
        surface: {
          DEFAULT: '#FFFFFF',
          page: '#F8F9FA',
          muted: '#F3F4F6',
          sunken: '#F1F3F2',
        },
        /** Status colours (never brand colours, so a "success" never reads as a brand accent). */
        success: { DEFAULT: '#15803D', soft: '#ECFDF3', line: '#BBF7D0' },
        warning: { DEFAULT: '#B45309', soft: '#FFFBEB', line: '#FDE68A' },
        danger: { DEFAULT: '#DC2626', soft: '#FEF2F2', line: '#FECACA' },
        info: { DEFAULT: '#0369A1', soft: '#F0F9FF', line: '#BAE6FD' },
      },
      fontSize: {
        /** Smallest allowed text: labels, metadata, table headers. Replaces ad-hoc 10px/11px. */
        '2xs': ['11px', { lineHeight: '16px' }],
      },
      fontFamily: {
        // next/font exposes self-hosted faces via CSS variables (hashed family names); the literal names are fallbacks.
        heading: ['var(--font-heading, Poppins)', 'Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans, Inter)', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        /** Menus, popovers, toasts. */
        'pop': '0 12px 28px -8px rgba(16, 24, 40, 0.16), 0 4px 8px -4px rgba(16, 24, 40, 0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 160ms ease-out',
      }
    },
  },
  plugins: [],
};

