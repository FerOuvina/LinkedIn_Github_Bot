import forms from "@tailwindcss/forms";
import containerQueries from "@tailwindcss/container-queries";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#07070a",
        panel: "#101017",
        shell: "#17171f",
        edge: "#26262f",
        bone: "#f4f4f5",
        ash: "#8b8b9e",
        // Future Funk: hot pink primary, cyan and acid as secondaries.
        primary: "#ff2e88",
        crimson: "#ff0044",
        cyan: "#00e5ff",
        acid: "#ccff00",
        violet: "#7b2dff",
      },
      fontFamily: {
        display: ["Archivo Black", "Impact", "sans-serif"],
        body: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 #ff2e88",
        "hard-cyan": "4px 4px 0 0 #00e5ff",
        "hard-acid": "4px 4px 0 0 #ccff00",
        glow: "0 0 24px rgba(255,46,136,0.45)",
        "glow-cyan": "0 0 24px rgba(0,229,255,0.35)",
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
      },
      animation: {
        marquee: "marquee 22s linear infinite",
        glitch: "glitch 0.25s infinite",
        blink: "blink 1s steps(1) infinite",
        sweep: "sweep 6s linear infinite",
      },
    },
  },
  plugins: [forms, containerQueries],
};
