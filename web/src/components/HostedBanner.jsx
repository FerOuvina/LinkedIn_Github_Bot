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
    <div className="border-b-2 border-acid bg-acid/10">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm text-acid sm:px-6 lg:px-8">
        <span className="material-symbols-outlined text-[20px]">info</span>
        <p>
          {status === "hosted" ? (
            <>
              You are viewing the hosted copy, so the setup wizard is read-only.
              The checks, OAuth and credential saving all run on your own
              machine. Clone the repository and run{" "}
              <code className="border border-acid/40 bg-void px-1.5 py-0.5 font-mono text-acid">
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
