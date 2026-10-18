import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

/**
 * The setup server only exists on the user's machine. On the hosted site it is
 * absent, so we probe once and say so plainly instead of letting every button
 * fail with a network error.
 */
export default function HostedBanner() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    api
      .health()
      .then(() => !cancelled && setStatus("local"))
      .catch(() => !cancelled && setStatus("hosted"));

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "local") return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm text-amber-900 sm:px-6 lg:px-8 dark:text-amber-200">
        <span className="material-symbols-outlined text-[20px]">info</span>
        <p>
          {status === "hosted" ? (
            <>
              You are viewing the hosted copy, so the setup wizard is read-only.
              The checks, OAuth and credential saving all run on your own
              machine. Clone the repository and run{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/50">
                npm run setup
              </code>{" "}
              to use it.
            </>
          ) : (
            <span className="opacity-60">Checking for a local setup server…</span>
          )}
        </p>
      </div>
    </div>
  );
}
