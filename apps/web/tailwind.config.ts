import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' } } } },
  plugins: [],
} satisfies Config;
