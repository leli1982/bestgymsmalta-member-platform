import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./theme/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        go: "#090909",
        card: "#141414",
        "card-elevated": "#1B1B1B",

        primary: "#fcb415",
        "primary-light": "#FB923C",

        success: "#22C55E",
        warning: "#FACC15",
        error: "#EF4444",

        muted: "#A1A1AA",
        border: "rgba(255,255,255,.08)",

        // keeping old names so existing pages don't break
        bg: "#090909",
        panel: "#141414",
        panel2: "#1B1B1B",
        acid: "#fcb415",
        flame: "#FF3131",
        steel: "#A7A7A7",
      },
      boxShadow: {
        glow: "0 0 35px rgba(252,180,21,.35)",
        card: "0 8px 40px rgba(0,0,0,.35)",
        nav: "0 0 35px rgba(0,0,0,.6)",
        redglow: "0 0 40px rgba(255,49,49,.20)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
        plate:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,.18) 1px, transparent 0)",
      },
      borderRadius: {
        button: "20px",
        card: "28px",
        input: "20px",
        image: "28px",
        hero: "36px",
      },
    },
  },
  plugins: [],
};

export default config;