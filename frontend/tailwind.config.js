/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          900: '#14532d',
        },
        heritage: {
          page: 'var(--page-bg, #0B1220)',
          card: 'var(--card-bg, #F5EBD7)',
          glow: 'var(--card-glow, #E6D3A8)',
          inner: 'var(--inner-card-bg, #FDFBF7)',
          accent: 'var(--accent, #7A5A3A)',
          'accent-hover': 'var(--accent-hover, #654A2E)',
          'border-tan': 'var(--border-tan, #B89B77)',
          'text-primary': 'var(--text-primary, #111827)',
          'text-secondary': 'var(--text-secondary, #4B5563)',
          badge: 'var(--badge-bg, #E8DCC4)',
        },
      },
      fontFamily: {
        display: ['"Outfit Variable"', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
