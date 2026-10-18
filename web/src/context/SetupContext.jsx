import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const SetupContext = createContext(null);

/** Holds credentials between wizard steps. Deliberately in memory only. */
export function SetupProvider({ children }) {
  const [values, setValues] = useState({});
  const [linkedIn, setLinkedIn] = useState(null);
  const [connected, setConnected] = useState(false);

  const setValue = useCallback((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const collectLinkedIn = useCallback(async () => {
    const { url, state } = await api.startLinkedIn();
    const popup = window.open(url, "linkedin-oauth", "width=600,height=760");

    if (!popup) {
      throw new Error("Your browser blocked the popup. Allow popups and try again.");
    }

    // The server redirects the popup back here once LinkedIn redirects to it.
    const timer = setInterval(async () => {
      if (popup.closed) {
        clearInterval(timer);
        return;
      }
      try {
        const result = await api.linkedInResult(state);
        clearInterval(timer);
        popup.close();
        setLinkedIn(result);
        setConnected(true);
      } catch {
        /* not ready yet */
      }
    }, 1000);
  }, []);

  const value = useMemo(
    () => ({ values, setValue, linkedIn, connected, collectLinkedIn }),
    [values, setValue, linkedIn, connected, collectLinkedIn]
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error("useSetup must be used inside SetupProvider");
  return ctx;
}
