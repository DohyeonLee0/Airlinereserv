import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#002060",
        brand: {
          DEFAULT: "#0770e3",
          dark: "#0554b5",
          light: "#e8f4fd"
        },
        "deep-space-blue": {
          DEFAULT: "#012a4a",
          500: "#012a4a"
        },
        cerulean: {
          DEFAULT: "#2c7da0",
          400: "#236480",
          500: "#2c7da0",
          700: "#1a5166",
          800: "#123240"
        },
        "yale-blue-2": {
          DEFAULT: "#01497c",
          400: "#013b65",
          500: "#01497c",
          600: "#0277ca"
        },
        "sky-blue-light": {
          DEFAULT: "#89c2d9"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #0770e3 0%, #002060 55%, #001540 100%)"
      }
    }
  },
  plugins: []
};

export default config;
