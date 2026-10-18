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
        <p className="text-slate-600 dark:text-slate-400">
          The setup server is already running. Let's confirm it can see
          everything it needs.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          Could not reach the setup server: {error}
        </div>
      )}

      {health && (
        <div className="space-y-4">
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 ${
              nodeOk
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
                : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
            }`}
          >
            <span className="material-symbols-outlined">
              {nodeOk ? "check_circle" : "warning"}
            </span>
            <div>
              <p className="font-semibold">
                {nodeOk ? "Node.js detected" : "Node.js 20 or newer is required"}
              </p>
              <p className="text-sm opacity-80">Running {health.node}</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 rounded-lg border p-4 ${
              ghOk
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
                : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
            }`}
          >
            <span className="material-symbols-outlined">
              {ghOk ? "check_circle" : "warning"}
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                {ghOk
                  ? "GitHub CLI ready"
                  : !health.gh?.installed
                    ? "GitHub CLI not installed"
                    : "GitHub CLI installed but not signed in"}
              </p>
              <p className="text-sm opacity-80">
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
                  <p className="text-sm opacity-80">
                    You can still save to the local .env and skip this, but the
                    scheduled job needs these secrets.
                  </p>
                </div>
              )}
            </div>
          </div>

          {health.envMissing.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="font-semibold mb-2">Not configured yet</p>
              <ul className="list-inside list-disc text-sm">
                {health.envMissing.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm opacity-80">
                The next steps fill these in.
              </p>
            </div>
          )}

          {health.envMissing.length === 0 && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
              All required variables are present. Continue to verify them.
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <p className="mb-2 text-sm text-slate-500">
          Prefer the terminal? The same steps work headlessly:
        </p>
        <CopyBlock code={`npm run preflight`} />
      </div>
    </section>
  );
}
