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
      <li key={r.name} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="material-symbols-outlined text-green-500 text-[20px]">check_circle</span>
        <span>
          <strong>{r.name}:</strong> {r.detail}
        </span>
      </li>
    ) : (
      <li key={r.name} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
        <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
        <span>
          <strong>{r.name}:</strong> {r.detail}
        </span>
      </li>
    );

  return (
    <section>
      <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400 mb-6">
        Checks every credential against its real API, so problems show up here
        rather than tomorrow morning.
      </p>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={check}
          disabled={busy}
          className="rounded-lg bg-primary px-5 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-blue-600 disabled:opacity-50"
        >
          Check credentials
        </button>
        <button
          onClick={tryPost}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Generate a test post
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {health && (
        <ul className="space-y-2 mb-8">{health.results.map(pill)}</ul>
      )}

      {post && (
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {post.ok ? "Test post (nothing was published)" : "Test run failed"}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[#0d1117] p-4 font-mono text-sm text-white">
            {post.ok ? post.stdout : post.stderr || post.stdout}
          </pre>
        </div>
      )}
    </section>
  );
}
