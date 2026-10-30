import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import "./index.css";
import App from "./App.jsx";
import { activateLocale, getInitialLocale } from "./i18n.js";
import { applyTheme, getInitialTheme } from "./theme.js";
import { messages as en } from "./locales/en.po";
import { messages as es } from "./locales/es.po";

i18n.load({ en, es });
activateLocale(getInitialLocale());
applyTheme(getInitialTheme());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
