import forms from "@tailwindcss/forms";
import containerQueries from "@tailwindcss/container-queries";

const palette = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: palette("void"),
        panel: palette("panel"),
        shell: palette("shell"),
        edge: palette("edge"),
        bone: palette("bone"),
        ash: palette("ash"),
        // Future Funk: hot pink primary, cyan and acid as secondaries.
        primary: palette("primary"),
        crimson: palette("crimson"),
        cyan: palette("cyan"),
        acid: palette("acid"),
        violet: palette("violet"),
      },
      fontFamily: {
        display: ["Archivo Black", "Impact", "sans-serif"],
        body: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 rgb(var(--primary))",
        "hard-cyan": "4px 4px 0 0 rgb(var(--cyan))",
        "hard-acid": "4px 4px 0 0 rgb(var(--acid))",
        "hard-acid-lg": "6px 6px 0 0 rgb(var(--acid))",
        glow: "0 0 24px rgb(var(--primary) / 0.45)",
        "glow-cyan": "0 0 24px rgb(var(--cyan) / 0.35)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 1px)" },
          "40%": { transform: "translate(2px, -1px)" },
          "60%": { transform: "translate(-1px, 2px)" },
          "80%": { transform: "translate(1px, -2px)" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        sweep: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "toast-bar": {
          "0%": { transform: "scaleX(1)" },
          "100%": { transform: "scaleX(0)" },
        },
      },
      animation: {
        marquee: "marquee 22s linear infinite",
        glitch: "glitch 0.25s infinite",
        blink: "blink 1s steps(1) infinite",
        sweep: "sweep 6s linear infinite",
        "toast-in": "toast-in 0.28s ease-out both",
        "toast-bar": "toast-bar 4.5s linear forwards",
      },
    },
  },
  plugins: [forms, containerQueries],
};
