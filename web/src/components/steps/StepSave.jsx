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
    <label className="card flex cursor-pointer items-start gap-3 !p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-primary"
      />
      <span>
        <span className="ff-mono block text-[11px] uppercase tracking-[0.2em] text-bone">{label}</span>
        <span className="mt-1 block text-sm text-ash">{help}</span>
      </span>
    </label>
  );

  return (
    <section>
      <p className="mb-6 max-w-2xl text-lg text-ash">
        Choose where to save. Preview first — nothing is written until you
        confirm.
      </p>

      <div className="mb-8 grid max-w-2xl gap-4">
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
          className="btn btn-ghost"
        >
          Preview
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy}
          className="btn btn-acid"
        >
          Save credentials
        </button>
      </div>

      {busy && <p className="mt-4 font-mono text-[11px] text-ash">Working…</p>}

      {error && (
        <div className="panel mt-6 whitespace-pre-line border-crimson p-4 text-crimson">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-6 rounded-lg border p-4 whitespace-pre-line ${
            result.ok
              ? "border-acid text-acid"
              : "border-crimson text-crimson"
          }`}
        >
          {result.message}
          {result.envUpdated?.length > 0 && (
            <p className="mt-2 font-mono text-[11px] text-ash">
              Updated in .env: {result.envUpdated.join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
