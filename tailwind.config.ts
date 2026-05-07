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
        domi: {
          black: "#121212",
          dark: "#1F1F1F",
          yellow: "#FACC15",
          white: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
