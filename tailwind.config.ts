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
        bg: "#0B1220",
        surface: "#0F1A2B",
        border: "rgba(255,255,255,0.08)",
        text: {
          primary: "#F6F8FF",
          secondary: "rgba(246,248,255,0.72)",
          muted: "rgba(246,248,255,0.55)",
        },
        accent: {
          DEFAULT: "#3B82F6",
          hover: "#2563EB",
        },
        success: "#22C55E",
        danger: "#EF4444",
      },
      maxWidth: {
        content: "1200px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
