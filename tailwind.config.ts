import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17191c",
        accent: "#f15a24",
        "accent-hover": "#d94716",
        paper: "#f3f4f5",
      },
    },
  },
  plugins: [],
};

export default config;
