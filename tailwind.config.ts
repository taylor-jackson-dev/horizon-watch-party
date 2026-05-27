import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Watch Party design tokens — Dark Cinema theme (default)
        brand: {
          bg:         "#0f0f0f", // Deep black — main background
          surface:    "#1a1a1a", // Card / panel surface
          elevated:   "#242424", // Elevated surface (modals, dropdowns)
          border:     "#2e2e2e", // Subtle borders
          gold:       "#c9a84c", // Primary accent — cinema gold
          "gold-dim": "#8a6f2e", // Muted gold for secondary elements
          text:       "#f0f0f0", // Primary text
          muted:      "#8a8a8a", // Secondary / muted text
          danger:     "#e53e3e", // Errors, destructive actions
          success:    "#38a169", // Confirmations
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-in-out",
        "slide-up":   "slideUp 0.3s ease-out",
        "float-up":   "floatUp 2s ease-out forwards", // Emoji reaction animation
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        floatUp: {
          "0%":   { transform: "translateY(0)   scale(1)",   opacity: "1" },
          "100%": { transform: "translateY(-80px) scale(1.4)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
