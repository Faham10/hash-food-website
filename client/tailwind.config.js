/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0b0b0f',
        panel: '#121217',
        fire: '#ff6a00',
        flame: '#ff2d2d',
        amber: '#ffb703',
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 50px rgba(255, 106, 0, .22)',
      },
    },
  },
  plugins: [],
};
