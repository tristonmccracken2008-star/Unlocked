import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2b211a",
        paper: "#f6f0e6",
        forest: "#1f5f43",
        espresso: "#2b211a",
        gold: "#b48a45",
        lime: "#e7d8bd",
        trust: "#2f6f56",
      },
      boxShadow: {
        soft: "0 12px 32px rgba(43, 33, 26, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
