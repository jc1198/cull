/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // v2 dark system. Canvas and console share a value — they separate by
        // the console's top border and drop shadow, not by fill.
        canvas:  '#272727',
        surface: '#474747', // elevated: priority cards, reasoning card
        accent:      '#BAA9FF', // on dark
        accentLight: '#2100B2', // on light surfaces

        // All text is #ffffff or accent at full strength. Hierarchy comes from
        // size and weight — there is no muted token and no opacity ramp.
        primary: '#FFFFFF',
        border:  '#FFFFFF',
      },
      fontFamily: {
        sans: ['"Kantumruy Pro"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Selection effect variable: 0/0, radius 4, spread 1
        selection: '0 0 4px 1px #BAA9FF',
        console:   '0 -4px 2px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
}
