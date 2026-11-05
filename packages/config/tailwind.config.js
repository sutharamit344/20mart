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
        }
      },
      fontFamily: {
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
};

