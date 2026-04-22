/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1c2541',
        accent: '#3a86ff',
        'accent-dark': '#2563eb',
      },
    },
  },
  plugins: [],
};
