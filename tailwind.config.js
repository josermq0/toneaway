/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: '#081321', panel: '#14263a', accent: '#23D9D2', warning: '#F6A352' },
    fontFamily: { sans: ['Inter', 'system-ui', 'Arial', 'sans-serif'] },
  } },
  plugins: [],
};
