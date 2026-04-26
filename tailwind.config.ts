import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0b",
          elevated: "#111114",
          card: "#16161a",
        },
        border: {
          DEFAULT: "#26262d",
          strong: "#3a3a44",
        },
        fg: {
          DEFAULT: "#f4f4f5",
          muted: "#a1a1aa",
          subtle: "#71717a",
        },
        accent: {
          DEFAULT: "#7c5cff",
          hover: "#9277ff",
        },
        profit: "#10b981",
        loss: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
