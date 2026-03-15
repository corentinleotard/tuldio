/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1B4D3E',
          light: '#2D7A5F',
          lightest: '#EDF5F1',
        },
        accent: {
          DEFAULT: '#E8913A',
          light: '#F5C28B',
        },
        surface: {
          DEFAULT: '#F8F7F4',
          card: '#FFFFFF',
        },
        text: {
          DEFAULT: '#1A1A1A',
          secondary: '#6B6B6B',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
