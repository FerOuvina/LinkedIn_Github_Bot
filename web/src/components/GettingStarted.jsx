import { Link } from "wouter";
import { useEffect, useState } from "react";
import StepPrerequisites from "./steps/StepPrerequisites";
import StepCloneRepo from "./steps/StepCloneRepo";
import StepCredentials from "./steps/StepCredentials";
import StepLinkedIn from "./steps/StepLinkedIn";
import StepSave from "./steps/StepSave";
import StepSchedule from "./steps/StepSchedule";
import StepPrompt from "./steps/StepPrompt";
import StepVerify from "./steps/StepVerify";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import ThemeSwitcher from "./ThemeSwitcher.jsx";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

// Every step must have a component: an undefined one crashes the wizard.
const STEPS = [
  { id: 1, title: msg`Check your machine`, sidebar: msg`Prerequisites`, component: StepPrerequisites },
  { id: 2, title: msg`Clone and start`, sidebar: msg`Clone Repository`, component: StepCloneRepo },
  { id: 3, title: msg`API credentials`, sidebar: msg`API Credentials`, component: StepCredentials },
  { id: 4, title: msg`Connect LinkedIn`, sidebar: msg`Connect LinkedIn`, component: StepLinkedIn },
  { id: 5, title: msg`Save credentials`, sidebar: msg`Save Credentials`, component: StepSave },
  { id: 6, title: msg`Edit the prompt`, sidebar: msg`Edit Prompt`, component: StepPrompt },
  { id: 7, title: msg`Choose your times`, sidebar: msg`Post Schedule`, component: StepSchedule },
  { id: 8, title: msg`Verify`, sidebar: msg`Verify & Test`, component: StepVerify },
];

function GettingStarted() {
  const steps = STEPS;
  const { _ } = useLingui();
  const [currentStep, setCurrentStep] = useState(0);
  const [toast, setToast] = useState(false);
  const totalSteps = steps.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);
  const step = steps[currentStep];
  const StepComponent = step.component;
  const isLastStep = currentStep === totalSteps - 1;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(false), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="scanlines grid-bg flex h-screen flex-col overflow-hidden bg-void font-body text-bone md:flex-row">
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-b-2 border-edge bg-void md:w-72 md:border-b-0 md:border-r-2">
        <div className="sticky top-0 z-10 border-b-2 border-edge bg-void p-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-primary">
              smart_toy
            </span>
            <div>
              <h1 className="ff-mono text-sm">setup_console</h1>
              <p className="ff-mono mt-1 text-[10px] text-ash">github→linkedin</p>
            </div>
          </div>
          <LanguageSwitcher className="mt-4 w-fit" />
          <ThemeSwitcher className="mt-2 w-fit" />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3">
          {steps.map((s, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(index)}
                className={`flex w-full items-center gap-3 border-l-4 px-3 py-3 text-left transition ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-shell"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-acid"
                        : "text-edge"
                  }`}
                >
                  {isActive
                    ? "radio_button_checked"
                    : isCompleted
                      ? "check_circle"
                      : "radio_button_unchecked"}
                </span>

                <span
                  className={`ff-mono text-[11px] ${
                    isActive ? "text-bone" : "text-ash"
                  }`}
                >
                  {String(s.id).padStart(2, "0")} {_(s.sidebar)}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sticky bottom-0 border-t-2 border-edge bg-void p-4 md:px-6 md:py-5">
          <Link href="/" className="btn btn-ghost w-full">
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            <Trans>exit</Trans>
          </Link>
        </div>
      </aside>

      {/* ── Content ────────────────────────────────────────────── */}
      <section className="relative flex h-full flex-1 flex-col overflow-hidden">
        <article className="w-full flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-6 py-8 pb-32 md:py-12">
            <div className="mb-10 flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <span className="ff-kicker">
                  <Trans>step {String(currentStep + 1).padStart(2, "0")} / {totalSteps}</Trans>
                </span>
                <span className="ff-mono text-[11px] text-cyan">
                  {progress}%
                </span>
              </div>

              <div className="h-2 w-full border-2 border-edge bg-void">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <h2 className="ff-display mb-8 text-3xl text-bone sm:text-4xl">
              {_(step.title)}
            </h2>

            <div className="max-w-2xl text-lg text-ash">
              <StepComponent />
            </div>
          </div>
        </article>

        <footer className="flex w-full justify-between border-t-2 border-edge bg-void p-4 md:px-8 md:py-5">
          <button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            className="btn btn-ghost"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            <Trans>prev</Trans>
          </button>

          {isLastStep ? (
            <button
              onClick={() => setToast(true)}
              disabled={toast}
              className="btn btn-acid"
            >
              {toast ? <Trans>done</Trans> : <Trans>finish</Trans>}
              <span className="material-symbols-outlined text-[18px]">
                check_circle
              </span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              className="btn btn-primary"
            >
              <Trans>next</Trans>
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          )}
        </footer>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="animate-toast-in fixed bottom-24 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] border-2 border-acid bg-panel p-4 shadow-hard-acid-lg md:right-8"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[22px] text-acid">
                check_circle
              </span>
              <div className="flex-1">
                <p className="ff-mono text-[10px] uppercase tracking-[0.3em] text-acid">
                  <Trans>setup complete</Trans>
                </p>
                <p className="mt-1 text-sm text-bone">
                  <Trans>
                    Everything is configured. Your next scheduled post will pick
                    it up.
                  </Trans>
                </p>
              </div>
              <button
                onClick={() => setToast(false)}
                aria-label={_(msg`Dismiss notification`)}
                className="font-mono text-lg leading-none text-ash transition hover:text-bone"
              >
                ×
              </button>
            </div>
            <div className="mt-3 h-1 w-full bg-edge">
              <div className="animate-toast-bar h-full w-full origin-left bg-acid" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default GettingStarted;
