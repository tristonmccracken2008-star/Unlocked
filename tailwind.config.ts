import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        white: "rgb(var(--color-surface) / <alpha-value>)",
        forest: "rgb(var(--color-forest) / <alpha-value>)",
        espresso: "rgb(var(--color-ink) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        lime: "rgb(var(--color-lime) / <alpha-value>)",
        trust: "rgb(var(--color-trust) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 12px 32px rgba(43, 33, 26, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
