/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        ink: {
          50: "#f8f8f7",
          100: "#e8e8e4",
          200: "#d1d1cb",
          300: "#a8a89e",
          400: "#7a7a70",
          500: "#5a5a52",
          600: "#3e3e38",
          700: "#2a2a26",
          800: "#1c1c19",
          900: "#121210",
          950: "#080807",
        },
        // Accent (indigo) — primary actions, focus rings, selection
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        suggestion: {
          spelling: "#e85d75",
          grammar: "#f0a848",
          punctuation: "#5b9bd5",
          style: "#9b8bd9",
        },
      },
      maxWidth: {
        prose: "65ch",
      },
    },
  },
  plugins: [],
};
