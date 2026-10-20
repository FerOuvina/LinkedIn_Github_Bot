import { useEffect, useState } from "react";
import CopyBlock from "../copyBlock.jsx";
import { api } from "../../lib/api.js";

/** What the wizard still needs from you, in the order it matters. */
function outstanding(health) {
  const todo = [];

  if (health.envMissing.length > 0) {
    todo.push({
      label: `${health.envMissing.length} environment variable(s) not set`,
      detail: health.envMissing.join(", "),
    });
  }

  if (!health.gh?.installed) {
    todo.push({
      label: "GitHub CLI not installed",
      detail: "Needed to save your credentials as Actions secrets.",
    });
  } else if (!health.gh.onPath) {
    todo.push({
      label: "GitHub CLI is not on your PATH",
      detail: `Found at ${health.gh.path}. Restart your terminal so it can be found.`,
    });
  } else if (!health.gh.authenticated) {
    todo.push({
      label: "GitHub CLI is not signed in",
      detail: "Run gh auth login.",
    });
  }

  return todo;
}

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

  const gh = health?.gh;
  const ghReady = Boolean(gh?.installed && gh?.authenticated);
  const todo = health ? outstanding(health) : [];

  // The scan shells out to `gh`, so it takes a moment. Without a placeholder
  // the cards below appear all at once and the whole page jumps.
  const scanning = !health && !error;

  return (
    <section>
      <p className="mb-8 text-ash">
        The setup server is running. Let's confirm it can see everything it
        needs.
      </p>

      {error && (
        <div className="panel mb-6 border-crimson p-4 text-crimson">
          Could not reach the setup server: {error}
        </div>
      )}

      {scanning && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {["checking node.js…", "checking github cli…", "reading environment variables…"].map(
            (label) => (
              <div
                key={label}
                className="flex animate-pulse items-center gap-3 border-2 border-edge p-4"
              >
                <span className="material-symbols-outlined text-edge">hourglass_top</span>
                <div className="flex-1">
                  <p className="ff-mono text-[11px] uppercase tracking-[0.2em] text-ash">
                    {label}
                  </p>
                  <div className="mt-2 h-3 w-1/3 bg-shell" />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {health && (
        <div className="space-y-4">
          {/* ── Node ── */}
          <div
            className={`flex items-center gap-3 border-2 p-4 ${
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
                {nodeOk ? "node.js detected" : "node.js 20 or newer required"}
              </p>
              <p className="mt-1 text-sm text-ash">Running {health.node}</p>
            </div>
          </div>

          {/* ── GitHub CLI ── */}
          <div
            className={`flex items-start gap-3 border-2 p-4 ${
              ghReady ? "border-acid bg-acid/10" : "border-primary bg-primary/10"
            }`}
          >
            <span className="material-symbols-outlined">
              {ghReady ? "check_circle" : "error"}
            </span>

            <div className="flex-1">
              <p className="ff-mono text-[11px] uppercase tracking-[0.2em]">
                {!gh?.installed
                  ? "github cli not installed"
                  : !gh.onPath
                    ? "github cli not on your path"
                    : !gh.authenticated
                      ? "github cli not signed in"
                      : "github cli ready"}
              </p>

              <p className="mt-1 text-sm text-ash">
                {ghReady
                  ? gh.version
                  : "Needed to save your credentials as Actions secrets. You can skip it and save to .env only."}
              </p>

              {!ghReady && (
                <div className="mt-4 space-y-3">
                  {!gh?.installed && (
                    <div>
                      <p className="ff-mono mb-1 text-[10px] text-ash">install</p>
                      <CopyBlock code={`winget install GitHub.cli`} />
                      <p className="mt-2 text-sm text-ash">
                        macOS: <code className="font-mono text-acid">brew install gh</code>
                      </p>
                    </div>
                  )}

                  {gh?.installed && !gh.onPath && (
                    <div>
                      <p className="text-sm text-ash">
                        It is installed at{" "}
                        <code className="font-mono text-acid">{gh.path}</code>, but this
                        terminal was started before that. Close it, open a new one, and
                        run <code className="font-mono text-acid">npm run setup</code>{" "}
                        again.
                      </p>
                    </div>
                  )}

                  {gh?.installed && gh.onPath && !gh.authenticated && (
                    <div>
                      <p className="ff-mono mb-1 text-[10px] text-ash">sign in</p>
                      <CopyBlock code={`gh auth login`} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Summary ── */}
          {todo.length === 0 ? (
            <div className="border-2 border-acid p-4 text-acid">
              <p className="ff-mono text-[11px] uppercase tracking-[0.2em]">
                everything is ready
              </p>
              <p className="mt-1 text-sm">
                Node, the GitHub CLI and every required variable are in place.
                Continue to fill in your credentials.
              </p>
            </div>
          ) : (
            <div className="border-2 border-primary p-4">
              <p className="ff-kicker mb-3">still to do</p>
              <ul className="space-y-2">
                {todo.map((item) => (
                  <li key={item.label} className="text-sm text-ash">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      radio_button_unchecked
                    </span>{" "}
                    <span className="text-bone">{item.label}</span>
                    {item.detail && <span> — {item.detail}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ash">
                You can continue anyway: the wizard will simply skip saving to
                GitHub secrets if the CLI is unusable.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <p className="ff-mono mb-2 text-[10px] text-ash">
          prefer the terminal? the same checks work headlessly:
        </p>
        <CopyBlock code={`npm run preflight`} />
      </div>
    </section>
  );
}