import { useState } from "react";
import { useSetup } from "../../context/SetupContext.jsx";
import { api } from "../../lib/api.js";

export default function StepSave() {
  const { values, linkedIn } = useSetup();
  const [toGithub, setToGithub] = useState(true);
  const [toEnv, setToEnv] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const combined = {
    ...values,
    ...(linkedIn?.accessToken ? { LINKEDIN_ACCESS_TOKEN: linkedIn.accessToken } : {}),
    ...(linkedIn?.authorUrn ? { LINKEDIN_AUTHOR_URN: linkedIn.authorUrn } : {}),
    ...(linkedIn?.refreshToken ? { LINKEDIN_REFRESH_TOKEN: linkedIn.refreshToken } : {}),
  };

  const save = async (apply) => {
    setBusy(true);
    setError("");
    try {
      setResult(await api.save(combined, { apply, github: toGithub, env: toEnv }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const checkbox = (checked, onChange, label, help) => (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer dark:border-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-900"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{help}</span>
      </span>
    </label>
  );

  return (
    <section>
      <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400 mb-6">
        Choose where to save. Preview first — nothing is written until you
        confirm.
      </p>

      <div className="grid gap-4 max-w-2xl mb-8">
        {checkbox(
          toGithub,
          setToGithub,
          "Save as GitHub Actions secrets",
          "Needed for the scheduled daily post. Uses the GitHub CLI on your machine."
        )}
        {checkbox(
          toEnv,
          setToEnv,
          "Save to the local .env file",
          "Keeps `npm start` and `npm run preflight` working here. Existing values are preserved."
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => save(false)}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Preview
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy}
          className="rounded-lg bg-primary px-5 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-blue-600 disabled:opacity-50"
        >
          Save credentials
        </button>
      </div>

      {busy && <p className="mt-4 text-slate-500">Working…</p>}

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 whitespace-pre-line text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-6 rounded-lg border p-4 whitespace-pre-line ${
            result.ok
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {result.message}
          {result.envUpdated?.length > 0 && (
            <p className="mt-2 text-sm">
              Updated in .env: {result.envUpdated.join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
