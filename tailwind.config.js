/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'midnight-blue': '#001F3F',
        'neon-blue': '#007BFF',
        'coral-orange': '#FF6B35',
        'dark-blue': '#0A192F',
        'light-blue': '#112240',
        'highlight-blue': '#233554',
      },
    },
  },
  plugins: [],
};
