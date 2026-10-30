import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { THEMES, applyTheme, getInitialTheme, setTheme } from "../theme.js";

const THEME = msg`Theme`;
const LABELS = {
  system: msg`auto`,
  dark: msg`dark`,
  light: msg`light`,
};

export default function ThemeSwitcher({ className = "" }) {
  const { _ } = useLingui();
  const [choice, setChoice] = useState(getInitialTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getInitialTheme() === "system") applyTheme("system");
    };
    const onStorage = (event) => {
      if (event.key !== "theme") return;
      const next = getInitialTheme();
      setChoice(next);
      applyTheme(next);
    };

    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div
      role="group"
      aria-label={_(THEME)}
      className={`flex items-stretch border-2 border-edge ${className}`}
    >
      {THEMES.map((theme) => {
        const active = choice === theme;

        return (
          <button
            key={theme}
            type="button"
            onClick={() => {
              setTheme(theme);
              setChoice(theme);
            }}
            aria-pressed={active}
            title={_(LABELS[theme])}
            className={`ff-mono px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
              active ? "bg-cyan text-void" : "text-ash hover:text-bone"
            }`}
          >
            {_(LABELS[theme])}
          </button>
        );
      })}
    </div>
  );
}
