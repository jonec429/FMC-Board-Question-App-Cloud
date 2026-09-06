/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'sans-serif'],
      },
      colors: {
        blue: {
          600: '#1e3a8a',
          700: '#1d357b',
        },
        midnight: {
          950: '#02040a',
          900: '#070b14',
          800: '#0d1322',
          700: '#151d32',
          600: '#1f2b48',
          500: '#324268',
        }
      },
    },
  },
  plugins: [],
};
