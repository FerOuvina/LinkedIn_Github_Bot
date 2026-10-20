import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

/** Placeholders the wizard fills in when the post is generated. */
const PLACEHOLDERS = [
  { name: "{commits}", description: "replaced with the scored commit list" },
  { name: "{hubUser}", description: "replaced with your GitHub username" },
];

export default function StepPrompt() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .prompt()
      .then((result) => {
        setPrompt(result.prompt ?? "");
        setSaved(false);
      })
      .catch((err) => setError(err.message));
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.savePrompt(prompt);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <p className="mb-6 max-w-2xl text-lg text-ash">
        Edit the prompt the bot sends to the LLM to turn your commits into a
        LinkedIn post. It is stored in the repo as{" "}
        <code className="font-mono text-primary">prompt.md</code>, so it is
        version-controlled and picked up by the scheduled job automatically.
      </p>

      <div className="mb-6 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          Post prompt template
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={14}
          className="ff-input font-mono text-sm block w-full border border-edge rounded p-3 focus:border-primary"
          spellCheck={false}
        />
        <p className="mt-2 text-xs text-ash">
          Use <span className="font-mono">{PLACEHOLDERS.map((p) => p.name).join(", ")}</span> as
          placeholders — they are filled in automatically when the post is
          generated.
        </p>
        <ul className="mt-1 space-y-1 text-xs text-ash">
          {PLACEHOLDERS.map((p) => (
            <li key={p.name}>
              <span className="font-mono">{p.name}</span>{" — "}
              {p.description}
            </li>
          ))}
        </ul>
      </div>

      {error && <div className="panel mb-6 border-crimson p-4 text-crimson">{error}</div>}

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="btn btn-acid"
        >
          {busy ? "Working…" : "Save prompt"}
        </button>
      </div>

      {saved && (
        <div className="panel mb-6 border-acid p-4 text-acid">
          Prompt saved to{" "}
          <code className="font-mono text-primary">prompt.md</code>{" "}
          — commit and push the file for the scheduled job to use it.
        </div>
      )}
    </section>
  );
}