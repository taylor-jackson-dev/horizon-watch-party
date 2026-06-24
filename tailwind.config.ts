import type { Config } from "tailwindcss";

/** rgb(var(--token) / <alpha-value>) — lets every color take an opacity modifier. */
const v = (token: string) => `rgb(var(--wp-${token}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens (preferred) — all driven by CSS vars so the
        //    theme is runtime-swappable via [data-theme]. See globals.css.
        bg: v("bg"),
        surface: v("surface"),
        elevated: v("elevated"),
        overlay: v("overlay"),
        border: v("border"),
        "border-strong": v("border-strong"),
        gold: v("gold"),
        "gold-bright": v("gold-bright"),
        "gold-dim": v("gold-dim"),
        "on-gold": v("on-gold"),
        text: v("text"),
        muted: v("muted"),
        danger: v("danger"),
        success: v("success"),
        warning: v("warning"),
        glow: v("glow"),

        // ── Legacy alias — existing `brand-*` markup keeps working, now
        //    backed by the same tokens (so it themes for free). Migrate
        //    surfaces to the semantic names over time.
        brand: {
          bg: v("bg"),
          surface: v("surface"),
          elevated: v("elevated"),
          border: v("border"),
          gold: v("gold"),
          "gold-dim": v("gold-dim"),
          text: v("text"),
          muted: v("muted"),
          danger: v("danger"),
          success: v("success"),
        },
      },
      fontFamily: {
        sans: ["var(--wp-font-sans)"],
        display: ["var(--wp-font-display)"],
      },
      borderRadius: {
        token: "var(--wp-radius)",
      },
      boxShadow: {
        // Soft panel elevation with a faint top inner highlight.
        panel:
          "inset 0 1px 0 0 rgb(255 255 255 / 0.03), 0 10px 30px -16px rgb(0 0 0 / 0.7)",
        // Gold accent glow for primary actions / active states.
        glow:
          "0 0 0 1px rgb(var(--wp-gold) / 0.18), 0 8px 26px -10px rgb(var(--wp-gold) / 0.4)",
        // The cinema "screen" — warm halo plus deep drop for the video stage.
        screen:
          "0 0 90px -12px rgb(var(--wp-glow) / 0.28), 0 24px 70px -28px rgb(0 0 0 / 0.85)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "float-up": "floatUp 2s ease-out forwards",
        "glow-pulse": "glowPulse 2.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        floatUp: {
          "0%": { transform: "translateY(0)   scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-80px) scale(1.4)", opacity: "0" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
