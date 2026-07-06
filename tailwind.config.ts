import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10243e",
        paper: "#f7f3e8",
        forest: "#9a6617",
        lime: "#f0dfb2",
        trust: "#147a5b",
      },
      boxShadow: {
        soft: "0 12px 32px rgba(16, 36, 62, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
