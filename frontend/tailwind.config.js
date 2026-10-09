import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/*
 * Console theme: the operations console (`.surya-console`) uses a warm cream-and-navy palette,
 * while the landing and auth pages keep Tailwind's stock colours. Every themed colour is a CSS
 * variable, so the console's existing utility classes (bg-slate-900, text-emerald-400, ...) are
 * re-pointed in one place instead of being rewritten across every page.
 */
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const ACCENTS = ['emerald', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose', 'red', 'orange', 'amber', 'yellow'];

// Neutrals, from page background (950) to strongest text (50).
const CONSOLE_SLATE = {
  950: '#F3EADB', // page
  900: '#FDFBF7', // cards
  800: '#E9DFCC', // tan borders, pills
  700: '#DACBAF',
  600: '#9A8C77',
  500: '#6B665E',
  400: '#57534D',
  300: '#3E3B37',
  200: '#292725',
  100: '#191919',
  50: '#0B1220', // navy
};

// Accents swap light and dark ends so tinted panels stay light and text stays legible on cream.
const ACCENT_SWAP = { 50: '950', 100: '900', 200: '800', 300: '800', 400: '700', 500: '600', 600: '500', 700: '400', 800: '200', 900: '100', 950: '50' };

const rgb = (hex) => {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

const themed = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const themedColors = { white: themed('white') };
const stockVars = { '--c-white': rgb('#ffffff') };
const consoleVars = { '--c-white': rgb(CONSOLE_SLATE[50]) };
for (const family of ['slate', ...ACCENTS]) {
  themedColors[family] = {};
  for (const shade of SHADES) {
    themedColors[family][shade] = themed(`${family}-${shade}`);
    stockVars[`--c-${family}-${shade}`] = rgb(colors[family][shade]);
    consoleVars[`--c-${family}-${shade}`] = rgb(
      family === 'slate' ? CONSOLE_SLATE[shade] : colors[family][ACCENT_SWAP[shade]],
    );
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...themedColors,
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': stockVars, '.surya-console': { ...consoleVars, colorScheme: 'light' } });
    }),
  ],
}
