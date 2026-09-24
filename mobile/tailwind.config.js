/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        oau: {
          navy: "#002147",
          "navy-dark": "#001633",
          "navy-light": "#0a356e",
          gold: "#d4af37",
          "gold-light": "#f5c542",
          "gold-dark": "#b89628",
        },
      },
    },
  },
  plugins: [],
};
