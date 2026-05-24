import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mansa: {
          green: "#00D4AA",
          "green-dark": "#00A882",
          gold: "#FFB800",
          blue: "#3B82F6",
        },
        bg: {
          primary: "#0A0E1A",
          secondary: "#0F1629",
          card: "#141B2E",
          "card-hover": "#1A2236",
          border: "#1E2A42",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        ticker: "ticker 35s linear infinite",
      },
      keyframes: {
        ticker: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
