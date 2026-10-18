import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const ModeContext = createContext("local");

/**
 * "local" when the setup server answers, "hosted" when it does not.
 *
 * On GitHub Pages there is no server, so the interactive wizard has nothing to
 * talk to. Rather than showing six inputs and buttons that all fail, the
 * hosted site renders a read-only version of the same steps.
 */
export function ModeProvider({ children }) {
  const [mode, setMode] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) setMode("hosted");
    }, 4000); // don't make the page wait on a server that isn't there

    api
      .health()
      .then(() => !cancelled && setMode("local"))
      .catch(() => !cancelled && setMode("hosted"))
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export const useMode = () => useContext(ModeContext);
