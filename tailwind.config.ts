import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#050507",
          elevated: "#0d0e11",
          card: "#13141a",
        },
        border: {
          DEFAULT: "#1f2028",
          strong: "#2c2d37",
        },
        fg: {
          DEFAULT: "#f4f4f5",
          muted: "#a1a1aa",
          subtle: "#71717a",
        },
        accent: {
          DEFAULT: "#5fd0f5",
          hover: "#7ddcf8",
          subtle: "#1a3640",
        },
        profit: "#22c55e",
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
