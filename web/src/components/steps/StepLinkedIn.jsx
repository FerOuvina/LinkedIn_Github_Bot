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
        <div className="panel mb-6 border-acid p-4 text-acid">
          <p className="ff-mono text-[11px] uppercase tracking-[0.2em]">LinkedIn connected</p>
          {linkedIn?.authorUrn && (
            <p className="mt-1 font-mono text-xs text-bone">{linkedIn.authorUrn}</p>
          )}
        </div>
        <p className="text-ash">
          The token is held by the setup server and will be written in the next
          step. Remember that LinkedIn tokens expire after about 60 days, so you
          will need to come back and reconnect then.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p className="mb-6 max-w-2xl text-lg text-ash">
        This asks LinkedIn for permission to post on your behalf. You need your
        own LinkedIn app first, with both <strong>Sign In with LinkedIn</strong>{" "}
        and <strong>Share on LinkedIn</strong> requested and approved.{" "}        <Link
          className="text-primary underline decoration-2 underline-offset-4 hover:text-cyan"
          to="/guide"
        >
          Read the setup guide
        </Link>{" "}
        for the full walkthrough — it opens alongside this wizard.
      </p>

      <button
        onClick={connect}
        disabled={busy}
        className="btn btn-primary"
      >
        <span className="material-symbols-outlined">lock</span>
        {busy ? "Waiting for LinkedIn…" : "Connect LinkedIn"}
      </button>

      {error && (
        <div className="panel mt-6 border-crimson p-4 text-crimson">
          {error}
        </div>
      )}

      <p className="mt-6 text-sm text-ash">
        A popup will open. Approve the app there and this page will pick up the
        result automatically.
      </p>
    </section>
  );
}
