import { useState } from "react";
import { api } from "../../lib/api.js";

export default function StepVerify() {
  const [health, setHealth] = useState(null);
  const [post, setPost] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setBusy(true);
    setError("");
    setPost(null);
    try {
      setHealth(await api.preflight());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tryPost = async () => {
    setBusy(true);
    setError("");
    try {
      setPost(await api.dryRun());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pill = (r) =>
    r.ok ? (
      <li key={r.name} className="flex items-start gap-2 text-sm text-bone/80">
        <span className="material-symbols-outlined text-[20px] text-acid">check_circle</span>
        <span>
          <strong>{r.name}:</strong> {r.detail}
        </span>
      </li>
    ) : (
      <li key={r.name} className="flex items-start gap-2 text-sm text-crimson">
        <span className="material-symbols-outlined text-[20px] text-crimson">error</span>
        <span>
          <strong>{r.name}:</strong> {r.detail}
        </span>
      </li>
    );

  return (
    <section>
      <p className="mb-6 max-w-2xl text-lg text-ash">
        Checks every credential against its real API, so problems show up here
        rather than tomorrow morning.
      </p>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={check}
          disabled={busy}
          className="btn btn-primary"
        >
          Check credentials
        </button>
        <button
          onClick={tryPost}
          disabled={busy}
          className="btn btn-ghost"
        >
          Generate a test post
        </button>
      </div>

      {error && (
        <div className="panel mb-6 border-crimson p-4 text-crimson">
          {error}
        </div>
      )}

      {health && (
        <ul className="mb-8 space-y-3">{health.results.map(pill)}</ul>
      )}

      {post && (
        <div>
          <p className="ff-kicker mb-3">
            {post.ok ? "Test post (nothing was published)" : "Test run failed"}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap border-2 border-edge bg-void p-4 font-mono text-[13px] leading-relaxed text-bone">
            {post.ok ? post.stdout : post.stderr || post.stdout}
          </pre>
        </div>
      )}
    </section>
  );
}
