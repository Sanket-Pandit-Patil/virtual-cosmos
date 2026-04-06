/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        cosmos: {
          void: "#0a0c10",
          mist: "#12161f",
          accent: "#5eead4",
          dim: "#64748b",
        },
      },
    },
  },
  plugins: [],
};
