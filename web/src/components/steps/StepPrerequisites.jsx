import { useEffect, useState } from "react";
import CopyBlock from "../copyBlock.jsx";
import { api } from "../../lib/api.js";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

const SCAN_LABELS = [
  msg`checking node.js…`,
  msg`checking github cli…`,
  msg`reading environment variables.`,
];

/** What the wizard still needs from you, in the order it matters. */
function outstanding(health, _) {
  const todo = [];

  const missing = health.envMissing.length;
  if (missing > 0) {
    todo.push({
      label: _(msg`${missing} environment variable(s) not set`, { missing }),
      detail: health.envMissing.join(", "),
    });
  }

  if (!health.gh?.installed) {
    todo.push({
      label: _(msg`GitHub CLI not installed`),
      detail: _(msg`Needed to save your credentials as Actions secrets.`),
    });
  } else if (!health.gh.onPath) {
    const path = health.gh.path;
    todo.push({
      label: _(msg`GitHub CLI is not on your PATH`),
      detail: _(
        msg`Found at ${path}. Restart your terminal so it can be found.`,
        { path }
      ),
    });
  } else if (!health.gh.authenticated) {
    todo.push({
      label: _(msg`GitHub CLI is not signed in`),
      detail: _(msg`Run gh auth login.`),
    });
  }

  return todo;
}

export default function StepPrerequisites() {
  const { _ } = useLingui();
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
  const todo = health ? outstanding(health, _) : [];

  // The scan shells out to `gh`, so it takes a moment. Without a placeholder
  // the cards below appear all at once and the whole page jumps.
  const scanning = !health && !error;

  return (
    <section>
      <p className="mb-8 text-ash">
        <Trans>
          The setup server is running. Let's confirm it can see everything it
          needs.
        </Trans>
      </p>

      {error && (
        <div className="panel mb-6 border-crimson p-4 text-crimson">
          <Trans>Could not reach the setup server: {error}</Trans>
        </div>
      )}

      {scanning && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {SCAN_LABELS.map(
            (label) => (
              <div
                key={label}
                className="flex animate-pulse items-center gap-3 border-2 border-edge p-4"
              >
                <span className="material-symbols-outlined text-edge">hourglass_top</span>
                <div className="flex-1">
                  <p className="ff-mono text-[11px] uppercase tracking-[0.2em] text-ash">
                    {_(label)}
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
                {nodeOk ? <Trans>node.js detected</Trans> : <Trans>node.js 20 or newer required</Trans>}
              </p>
              <p className="mt-1 text-sm text-ash">
                <Trans>Running {health.node}</Trans>
              </p>
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
                {!gh?.installed ? (
                  <Trans>github cli not installed</Trans>
                ) : !gh.onPath ? (
                  <Trans>github cli not on your path</Trans>
                ) : !gh.authenticated ? (
                  <Trans>github cli not signed in</Trans>
                ) : (
                  <Trans>github cli ready</Trans>
                )}
              </p>

              <p className="mt-1 text-sm text-ash">
                {ghReady ? (
                  gh.version
                ) : (
                  <Trans>
                    Needed to save your credentials as Actions secrets. You can
                    skip it and save to .env only.
                  </Trans>
                )}
              </p>

              {!ghReady && (
                <div className="mt-4 space-y-3">
                  {!gh?.installed && (
                    <div>
                      <p className="ff-mono mb-1 text-[10px] text-ash">
                        <Trans>install</Trans>
                      </p>
                      <CopyBlock code={`winget install GitHub.cli`} />
                      <p className="mt-2 text-sm text-ash">
                        <Trans>
                          macOS: <code className="font-mono text-acid">brew install gh</code>
                        </Trans>
                      </p>
                    </div>
                  )}

                  {gh?.installed && !gh.onPath && (
                    <div>
                      <p className="text-sm text-ash">
                        <Trans>
                          It is installed at{" "}
                          <code className="font-mono text-acid">{gh.path}</code>, but this
                          terminal was started before that. Close it, open a new one, and
                          run <code className="font-mono text-acid">npm run setup</code>{" "}
                          again.
                        </Trans>
                      </p>
                    </div>
                  )}

                  {gh?.installed && gh.onPath && !gh.authenticated && (
                    <div>
                      <p className="ff-mono mb-1 text-[10px] text-ash">
                        <Trans>sign in</Trans>
                      </p>
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
                <Trans>everything is ready</Trans>
              </p>
              <p className="mt-1 text-sm">
                <Trans>
                  Node, the GitHub CLI and every required variable are in place.
                  Continue to fill in your credentials.
                </Trans>
              </p>
            </div>
          ) : (
            <div className="border-2 border-primary p-4">
              <p className="ff-kicker mb-3">
                <Trans>still to do</Trans>
              </p>
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
                <Trans>
                  You can continue anyway: the wizard will simply skip saving to
                  GitHub secrets if the CLI is unusable.
                </Trans>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <p className="ff-mono mb-2 text-[10px] text-ash">
          <Trans>prefer the terminal? the same checks work headlessly:</Trans>
        </p>
        <CopyBlock code={`npm run preflight`} />
      </div>
    </section>
  );
}