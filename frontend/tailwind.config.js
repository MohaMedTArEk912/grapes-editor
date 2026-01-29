/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
        },
        dark: {
          DEFAULT: '#0f0f23',
          bg: '#0a0a1a',
          panel: '#1a1a2e',
          border: '#2a2a4a',
        }
      }
    },
  },
  plugins: [],
}
