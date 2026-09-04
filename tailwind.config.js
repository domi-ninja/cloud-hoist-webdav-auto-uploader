/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        canvas: {
          light: "#f4f4f0",
          dark: "#161714",
        },
        ink: {
          light: "#20221e",
          dark: "#f0f1eb",
        },
        muted: {
          light: "#62665d",
          dark: "#aeb2a8",
        },
        accent: "#4f7d45",
      },
    },
  },
  plugins: [],
};
