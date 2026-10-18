import { useState } from "react";
import { Link } from "wouter";
import { useSetup } from "../../context/SetupContext.jsx";

export default function StepLinkedIn() {
  const { connected, linkedIn, collectLinkedIn } = useSetup();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await collectLinkedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (connected) {
    return (
      <section>
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300 mb-6">
          <p className="font-semibold">LinkedIn connected</p>
          {linkedIn?.authorUrn && (
            <p className="text-sm mt-1 font-mono">{linkedIn.authorUrn}</p>
          )}
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          The token is held by the setup server and will be written in the next
          step. Remember that LinkedIn tokens expire after about 60 days, so you
          will need to come back and reconnect then.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400 mb-6">
        This asks LinkedIn for permission to post on your behalf. You need your
        own LinkedIn app first, with both <strong>Sign In with LinkedIn</strong>{" "}
        and <strong>Share on LinkedIn</strong> requested and approved.{" "}        <Link
          className="text-primary hover:underline"
          to="/guide"
        >
          Read the setup guide
        </Link>{" "}
        for the full walkthrough — it opens alongside this wizard.
      </p>

      <button
        onClick={connect}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg bg-[#0A66C2] px-6 py-3 font-bold text-white transition hover:bg-[#004182] disabled:opacity-50"
      >
        <span className="material-symbols-outlined">lock</span>
        {busy ? "Waiting for LinkedIn…" : "Connect LinkedIn"}
      </button>

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        A popup will open. Approve the app there and this page will pick up the
        result automatically.
      </p>
    </section>
  );
}
