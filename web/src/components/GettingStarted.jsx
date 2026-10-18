import { Link } from "wouter";
import { useEffect, useState } from "react";
import StepPrerequisites from "./steps/StepPrerequisites";
import StepCloneRepo from "./steps/StepCloneRepo";
import StepCredentials from "./steps/StepCredentials";
import StepLinkedIn from "./steps/StepLinkedIn";
import StepSave from "./steps/StepSave";
import StepVerify from "./steps/StepVerify";

function GettingStarted() {
  // Every step must have a component: an undefined one crashes the wizard.
  const steps = [
    { id: 1, title: "Check your machine", sidebar: "Prerequisites", component: StepPrerequisites },
    { id: 2, title: "Clone and start", sidebar: "Clone Repository", component: StepCloneRepo },
    { id: 3, title: "API credentials", sidebar: "API Credentials", component: StepCredentials },
    { id: 4, title: "Connect LinkedIn", sidebar: "Connect LinkedIn", component: StepLinkedIn },
    { id: 5, title: "Save credentials", sidebar: "Save Credentials", component: StepSave },
    { id: 6, title: "Verify", sidebar: "Verify & Test", component: StepVerify },
  ];

  const [currentStep, setCurrentStep] = useState(0);

  const totalSteps = steps.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);
  const step = steps[currentStep];
  const StepComponent = steps[currentStep].component;

  const [darkMode, setDarkMode] = useState(false);

  // Initialize theme
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    if (storedTheme === "dark" || (!storedTheme && prefersDark)) {
      document.documentElement.classList.add("dark");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDarkMode(true);
    }
  }, []);

  // Toggle handler
  const toggleDarkMode = () => {
    const isDark = !darkMode;
    setDarkMode(isDark);

    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  return (
    <main className="flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display md:flex-row">
      <aside className="flex flex-col w-full overflow-y-auto bg-white border-b md:w-72 dark:bg-sidebar-dark md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 shrink-0 dark:bg-background-dark">
        <div className="sticky top-0 z-10 p-6 bg-white dark:bg-background-dark dark:border-b-[1px] dark:border-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg size-10 bg-primary/20 text-primary">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-none text-slate-900 dark:text-white">
                Setup Guide
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                GitHub-to-LinkedIn Bot
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-1">
          {steps.map((s, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div
                key={s.id}
                className={`group flex items-center gap-3 px-3 py-3 rounded-lg transition-colors
          ${
            isActive ?
              "bg-primary/10 dark:bg-[#1f2937] border-l-4 border-primary"
            : "opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          }
        `}
              >
                <span
                  className={`material-symbols-outlined text-[20px]
            ${
              isActive ? "text-primary fill-1"
              : isCompleted ? "text-green-500"
              : "text-slate-400 dark:text-slate-600"
            }
          `}
                >
                  {isActive ?
                    "circle"
                  : isCompleted ?
                    "check_circle"
                  : "radio_button_unchecked"}
                </span>

                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium ${
                      isActive ?
                        "text-primary dark:text-white"
                      : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {s.sidebar}
                  </span>
                  {isActive && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Step {s.id}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Dark mode toggle */}
        <div className="sticky bottom-0 z-20 flex justify-between w-full p-4 bg-white border-t dark:bg-background-dark border-slate-200 dark:border-slate-800 md:px-8 md:py-6">
          <Link
            href="/"
            className="flex items-center justify-center px-4 text-sm font-bold text-white transition-all rounded-lg shadow-lg h-9 bg-primary shadow-primary/20 hover:bg-blue-600 hover:scale-105 active:scale-95"
          >
            Go Back
          </Link>
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center transition-colors bg-transparent border border-gray-200 rounded-lg h-9 w-9 dark:border-border-dark hover:bg-gray-100 dark:hover:bg-card-dark"
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined text-[20px]">
              {darkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
      </aside>

      <section className="relative flex flex-col flex-1 h-full overflow-hidden">
        <article className="flex-1 w-full overflow-y-auto">
          <div className="max-w-4xl px-6 py-8 pb-32 mx-auto md:py-12">
            <div className="flex flex-col gap-3 mb-10">
              <div className="flex items-end justify-between">
                <p className="text-sm font-semibold tracking-wider uppercase text-slate-700 dark:text-slate-300">
                  Step {currentStep + 1} of {totalSteps}
                </p>
                <p className="text-sm font-medium text-primary dark:text-slate-300">
                  {progress}% Completed
                </p>
              </div>
              <div
                className="h-2 transition-all duration-500 ease-out rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex flex-col gap-4 mb-8">
              <h2 className="text-3xl font-bold md:text-4xl">
                Step {step.id}: {step.title}
              </h2>
              <div className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
                <StepComponent />
              </div>
            </div>
          </div>
        </article>

        <footer className="sticky bottom-0 z-20 flex justify-between w-full p-4 bg-white border-t dark:bg-background-dark border-slate-200 dark:border-slate-800 md:px-8 md:py-5">
          <button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            className={`flex items-center px-6 py-2.5 text-sm font-medium rounded-lg
    ${
      currentStep === 0 ?
        "text-slate-400 bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
      : "text-slate-700 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
    }
  `}
          >
            <span className="mr-2 material-symbols-outlined">arrow_back</span>
            Previous
          </button>

          <button
            onClick={() =>
              setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))
            }
            className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg shadow-lg shadow-primary/20"
          >
            Continue
            <span className="ml-2 material-symbols-outlined">
              arrow_forward
            </span>
          </button>
        </footer>
      </section>
    </main>
  );
}

export default GettingStarted;
