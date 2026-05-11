import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#151515",
        mist: "#f6f5f2",
        leaf: "#275d4a",
        brass: "#b28b49"
      }
    }
  },
  plugins: []
};

export default config;
