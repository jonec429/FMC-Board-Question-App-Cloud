/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#a1b6fb',
          400: '#6d8bf7',
          500: '#4661f1',
          600: '#1e3a8a', // Deep FMC Blue
          700: '#1d357b',
          800: '#1c2d66',
          900: '#1a2654',
        }
      }
    },
  },
  plugins: [],
};
