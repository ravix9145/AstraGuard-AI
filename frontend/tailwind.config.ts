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
        space: {
          950: "#020818",
          900: "#050e2d",
          800: "#0a1a4a",
          700: "#0d2460",
        },
        accent: {
          cyan: "#00d4ff",
          purple: "#7c3aed",
          amber: "#f59e0b",
          green: "#10b981",
          red: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "star-field": "radial-gradient(ellipse at top, #0d2460 0%, #020818 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
