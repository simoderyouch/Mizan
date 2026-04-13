import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Digital Sanctuary Palette ── */
        surface: {
          DEFAULT: "#fcf9f8",
          dim: "#ddd9d8",
          container: {
            DEFAULT: "#f0edec",
            low: "#f6f3f2",
            lowest: "#ffffff",
            high: "#eae7e6",
            highest: "#e5e2e0",
          },
        },
        primary: {
          DEFAULT: "#005cae",
          dark: "#004584",
          container: "#d5e3ff",
          on: "#ffffff",
        },
        secondary: {
          DEFAULT: "#4090ff",
          container: "#d5e3ff",
        },
        accent: "#d5e3ff",
        brand: {
          50: "#eef0ff",
          100: "#dfe3ff",
          500: "#5d62f2",
          600: "#4f56e6",
          700: "#4148cf",
        },
        success: {
          50: "#ecfdf5",
          500: "#10b981",
          600: "#059669",
        },
        "on-surface": {
          DEFAULT: "#1c1b1b",
          variant: "#424751",
        },
        "on-primary": "#ffffff",
        outline: {
          DEFAULT: "#73777f",
          variant: "#c2c6d3",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "2rem",
        xl: "1.5rem",
        lg: "1rem",
      },
      boxShadow: {
        sanctuary: "0 8px 24px rgba(28, 27, 27, 0.04)",
        "sanctuary-lg": "0 16px 48px rgba(28, 27, 27, 0.06)",
        dock: "0 -4px 30px rgba(28, 27, 27, 0.08)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
