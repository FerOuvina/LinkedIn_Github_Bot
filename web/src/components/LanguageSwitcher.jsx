import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { LOCALES, activateLocale } from "../i18n.js";

const LANGUAGE = msg`Language`;

export default function LanguageSwitcher({ className = "" }) {
  const { i18n, _ } = useLingui();

  return (
    <div
      role="group"
      aria-label={_(LANGUAGE)}
      className={`flex items-stretch border-2 border-edge ${className}`}
    >
      {LOCALES.map(({ code, label }) => {
        const active = i18n.locale === code;

        return (
          <button
            key={code}
            type="button"
            onClick={() => activateLocale(code)}
            aria-pressed={active}
            title={label}
            className={`ff-mono px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
              active
                ? "bg-primary text-void"
                : "text-ash hover:text-bone"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
