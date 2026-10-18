import { useEffect, useState } from "react";
import CopyBlock from "../copyBlock.jsx";
import { api } from "../../lib/api.js";

export default function StepPrerequisites() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  const nodeMajor = Number(
    health ? parseInt(String(health.node).replace(/^v/, ""), 10) : NaN
  );
  const nodeOk = Number.isFinite(nodeMajor) && nodeMajor >= 20;
  const ghOk = health?.gh?.installed && health?.gh?.authenticated;

  return (
    <section>
      <div className="flex flex-col gap-4 mb-8">
        <p className="text-ash">
          The setup server is already running. Let's confirm it can see
          everything it needs.
        </p>
      </div>

      {error && (
        <div className="panel mb-6 border-crimson p-4 text-crimson">
          Could not reach the setup server: {error}
        </div>
      )}

      {health && (
        <div className="space-y-4">
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 ${
              nodeOk
                ? "border-acid bg-acid/10"
                : "border-primary bg-primary/10"
            }`}
          >
            <span className="material-symbols-outlined">
              {nodeOk ? "check_circle" : "error"}
            </span>
            <div>
              <p className="ff-mono text-[11px] uppercase tracking-[0.2em]">
                {nodeOk ? "Node.js detected" : "Node.js 20 or newer is required"}
              </p>
              <p className="mt-1 text-sm text-ash">Running {health.node}</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 rounded-lg border p-4 ${
              ghOk
                ? "border-acid bg-acid/10"
                : "border-primary bg-primary/10"
            }`}
          >
            <span className="material-symbols-outlined">
              {ghOk ? "check_circle" : "error"}
            </span>
            <div className="flex-1">
              <p className="ff-mono text-[11px] uppercase tracking-[0.2em]">
                {ghOk
                  ? "GitHub CLI ready"
                  : !health.gh?.installed
                    ? "GitHub CLI not installed"
                    : "GitHub CLI installed but not signed in"}
              </p>
              <p className="mt-1 text-sm text-ash">
                {ghOk
                  ? health.gh.version
                  : "Needed to save your credentials as Actions secrets."}
              </p>
              {!ghOk && (
                <div className="mt-3 flex flex-col gap-2">
                  {!health.gh?.installed && (
                    <div>
                      <p className="mb-1 text-sm">Install it:</p>
                      <CopyBlock code={`winget install GitHub.cli`} language="bash" />
                    </div>
                  )}
                  {health.gh?.installed && (
                    <div>
                      <p className="mb-1 text-sm">Sign in:</p>
                      <CopyBlock code={`gh auth login`} language="bash" />
                    </div>
                  )}
                  <p className="mt-1 text-sm text-ash">
                    You can still save to the local .env and skip this, but the
                    scheduled job needs these secrets.
                  </p>
                </div>
              )}
            </div>
          </div>

          {health.envMissing.length > 0 && (
            <div className="panel border-primary p-4">
              <p className="ff-kicker mb-2">Not configured yet</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-ash">
                {health.envMissing.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ash">
                The next steps fill these in.
              </p>
            </div>
          )}

          {health.envMissing.length === 0 && (
            <div className="panel border-acid p-4 text-acid">
              All required variables are present. Continue to verify them.
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <p className="ff-mono mb-2 text-[10px] text-ash">
          Prefer the terminal? The same steps work headlessly:
        </p>
        <CopyBlock code={`npm run preflight`} />
      </div>
    </section>
  );
}
