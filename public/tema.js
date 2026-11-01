tailwind.config = {
  theme: {
    extend: {
      colors: {
        orange: {
          50: '#fdf0ec',
          100: '#fbe0d6',
          400: '#f08a6c',
          700: '#b8321f',
          800: '#96281a',
        },
        stone: {
          100: '#faf4e8',
          200: '#f0e7d6',
          300: '#dccfb8',
          400: '#a89a84',
          500: '#7d705f',
          600: '#5f5447',
          800: '#3a2f27',
          900: '#2a211b',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        titulo: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
};
