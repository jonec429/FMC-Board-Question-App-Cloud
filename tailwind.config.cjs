/** @type {import('tailwindcss').Config} */
module.exports = {
  // Global Scanner: Look everywhere!
  content: [
    "./**/*.{js,ts,jsx,tsx,mdx}",
    "!./node_modules/**/*",
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
      },
    },
  },
  plugins: [],
};
