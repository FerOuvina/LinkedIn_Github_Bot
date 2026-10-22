import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

/** Placeholders the wizard fills in when the post is generated. */
const PLACEHOLDERS = [
  { name: "{commits}", description: msg`replaced with the scored commit list` },
  { name: "{hubUser}", description: msg`replaced with your GitHub username` },
];

/** Languages the bot can write. Each selected one becomes a separate post. */
const LANGUAGES = [
  { code: "en", label: msg`English` },
  { code: "es", label: msg`Spanish` },
  { code: "pt", label: msg`Portuguese` },
  { code: "fr", label: msg`French` },
];

/** At most two languages are posted per setup. */
const MAX_LANGUAGES = 2;

export default function StepPrompt() {
  const { _ } = useLingui();
  const [prompt, setPrompt] = useState("");
  const [languages, setLanguages] = useState(["en"]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .prompt()
      .then((result) => {
        setPrompt(result.prompt ?? "");
        setLanguages(result.config?.languages ?? ["en"]);
        setSaved(false);
      })
      .catch((err) => setError(err.message));
  }, []);

  const toggleLanguage = (code) => {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== code);
      }
      if (prev.length >= MAX_LANGUAGES) return prev;
      return [...prev, code];
    });
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.savePrompt(prompt, { languages });
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
        <Trans>
          Edit the prompt the bot sends to the LLM to turn your commits into a
          LinkedIn post. It is stored in the repo as{" "}
          <code className="font-mono text-primary">prompt.md</code>, so it is
          version-controlled and picked up by the scheduled job automatically.
        </Trans>
      </p>

      <div className="mb-6 max-w-2xl">
        <span className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          <Trans>Post languages</Trans>
        </span>
        <div className="flex flex-wrap gap-4">
          {LANGUAGES.map((language) => {
            const checked = languages.includes(language.code);
            const disabled = !checked && languages.length >= MAX_LANGUAGES;
            return (
              <label
                key={language.code}
                className={`flex items-center gap-2 text-sm text-ash ${
                  disabled ? "opacity-40" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleLanguage(language.code)}
                  className="size-4 accent-primary"
                />
                {_(language.label)}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ash">
          <Trans>
            One post per language, up to two. Keep at least one checked; choose
            each language's time in the next step.
          </Trans>
        </p>
      </div>

      <div className="mb-6 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          <Trans>Post prompt template</Trans>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={14}
          className="ff-input font-mono text-sm block w-full border border-edge rounded p-3 focus:border-primary"
          spellCheck={false}
        />
        <p className="mt-2 text-xs text-ash">
          <Trans>
            Use <span className="font-mono">{PLACEHOLDERS.map((p) => p.name).join(", ")}</span> as
            placeholders - they are filled in automatically when the post is
            generated.
          </Trans>
        </p>
        <ul className="mt-1 space-y-1 text-xs text-ash">
          {PLACEHOLDERS.map((p) => (
            <li key={p.name}>
              <span className="font-mono">{p.name}</span>{" - "}
              {_(p.description)}
            </li>
          ))}
          <li>
            <Trans>
              Commits are scored before they reach this prompt -{" "}
              <span className="font-mono">feat:+5</span>,{" "}
              <span className="font-mono">fix:+4</span>,{" "}
              <span className="font-mono">add/implement/support:+2</span>,
              <span className="font-mono">test:-1</span>,{" "}
              <span className="font-mono">chore/merge:-2</span>. Only commits
              scoring 1+ are included, so write the prompt assuming the list is
              already scored. See{" "}
              <span className="font-mono">scripts/commitScoring.js</span>.
            </Trans>
          </li>
        </ul>
      </div>

      {error && <div className="panel mb-6 border-crimson p-4 text-crimson">{error}</div>}

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="btn btn-acid"
        >
          {busy ? <Trans>Working…</Trans> : <Trans>Save prompt</Trans>}
        </button>
      </div>

      {saved && (
        <div className="panel mb-6 border-acid p-4 text-acid">
          <Trans>
            Prompt saved to{" "}
            <code className="font-mono text-primary">prompt.md</code> and settings
            to <code className="font-mono text-primary">post.config.json</code>{" "}
            - commit and push both files for the scheduled job to use them. If
            you changed the language list, the workflow schedule was updated too.
          </Trans>
        </div>
      )}
    </section>
  );
}
