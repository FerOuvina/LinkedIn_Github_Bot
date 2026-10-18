import { useEffect, useState } from "react";
import { Link } from "wouter";
import { sitePath } from "../lib/api.js";

export default function GettingStarted() {
  const [darkMode, setDarkMode] = useState(false);

  // Initialize theme
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary/30 selection:text-primary">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-gray-200 dark:border-border-dark bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2 text-primary">
              <span className="material-symbols-outlined text-[20px]">
                rocket_launch
              </span>
            </div>
            <a
              href="https://github.com/FerOuvina/LinkedIn_Github_Bot"
              className="text-lg font-bold tracking-tight"
              target="_blank"
            >
              Github-LinkedIn Automation
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-border-dark bg-transparent hover:bg-gray-100 dark:hover:bg-card-dark transition-colors"
              aria-label="Toggle dark mode"
            >
              <span className="material-symbols-outlined text-[20px]">
                {darkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>

            <button className="hidden sm:flex h-9 items-center justify-center rounded-lg border border-gray-200 dark:border-border-dark bg-transparent px-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-card-dark transition-colors">
              <span className="mr-2 material-symbols-outlined text-[18px]">
                code
              </span>
              <a
                href="https://github.com/FerOuvina/LinkedIn_Github_Bot"
                target="_blank"
              >
                GitHub Repo
              </a>
            </button>

            <Link
              href="/getting-started"
              className="flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all hover:scale-105 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          {/* Hero */}
          <div className="mb-16 flex flex-col items-center text-center gap-6">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <span className="mr-2">✨</span> v1.0 is now live
            </div>

            <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl max-w-4xl leading-[1.1]">
              GitHub <span className="text-primary">→</span> LinkedIn
              <br />
              Automation Dashboard
            </h1>

            <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Turn your commits into content effortlessly. Built for developers
              who want to grow their LinkedIn Profile without the hassle.
              Privacy-focused & Open Source.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {["No credit card required", "Open Source"].map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-2 text-sm text-slate-500"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    check_circle
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:gap-8">
            {/* Card helper */}
            {[
              {
                title: "How it works",
                desc: "A seamless pipeline from your local environment to your professional network.",
                icon: "hub",
                color: "primary",
                items: [
                  ["login", "Connect your GitHub account securely"],
                  ["rule_folder", "Select specific repositories to track"],
                  ["auto_awesome", "Generate engaging posts with AI"],
                  ["schedule_send", "Schedule directly to LinkedIn"],
                ],
              },
              {
                title: "Your data, your control",
                desc: "We prioritize privacy above all else. Your code stays yours.",
                icon: "security",
                color: "emerald",
                items: [
                  ["dns", "Local storage first architecture"],
                  ["visibility", "100% Open source transparency"],
                  ["block", "Absolutely no hidden tracking"],
                  ["key", "Your API keys never leave your device"],
                ],
              },
              {
                title: "Who this is for",
                desc: "Designed for technical builders growing their audience.",
                icon: "group",
                color: "purple",
                items: [
                  ["code_off", "Coders who want to stay relevant"],
                  ["commit", "Open Source Maintainers"],
                  ["record_voice_over", "Developer Advocates"],
                ],
              },
              {
                title: "Important notes",
                desc: "A few things to keep in mind before you start.",
                icon: "warning",
                color: "amber",
                items: [
                  ["api", "Standard LinkedIn API rate limits apply"],
                  ["key_vertical", "Requires your own Huggin Face API key"],
                  ["deployed_code", "Features may change"],
                ],
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark p-8 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <span className="material-symbols-outlined text-[28px]">
                    {card.icon}
                  </span>
                </div>

                <h3 className="mb-3 text-xl font-bold">{card.title}</h3>
                <p className="mb-6 text-slate-600 dark:text-slate-400">
                  {card.desc}
                </p>

                <ul className="space-y-3">
                  {card.items.map(([icon, label]) => (
                    <li
                      key={label}
                      className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">
                        {icon}
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-20 overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#1e293b] relative px-6 py-16 sm:px-12 sm:py-20 text-center shadow-2xl">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(#3b82f6 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <h2 className="text-3xl text-white font-black sm:text-4xl lg:text-5xl max-w-3xl">
                Ready to automate your LinkedIn posts?
              </h2>
              <p className="max-w-xl text-lg text-slate-300">
                Start generating engaging posts from your codebase today.
              </p>

              <div className="mt-4 flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/getting-started"
                  className="flex h-12 w-full sm:w-auto items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white hover:bg-blue-600 transition-all"
                >
                  Continue{" "}
                </Link>
                <button className="flex h-12 w-full sm:w-auto items-center justify-center rounded-lg border border-slate-600 px-6 text-base font-bold text-white hover:bg-white/5 transition-all">
                  <span className="material-symbols-outlined mr-2 text-[20px]">
                    code
                  </span>
                  <a
                    href="https://github.com/FerOuvina/LinkedIn_Github_Bot"
                    target="_blank"
                  >
                    View on GitHub
                  </a>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-border-dark py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              rocket_launch
            </span>
            <a
              href="https://github.com/FerOuvina/LinkedIn_Github_Bot"
              className="text-sm font-semibold"
              target="_blank"
            >
              Github-LinkedIn Automation
            </a>
          </div>

          <div className="flex gap-6 text-sm text-slate-500">
            <a
              href={sitePath("/privacy-policy/")}
              className="hover:text-primary"
            >
              Privacy
            </a>
            <a
              href="https://github.com/FerOuvina/LinkedIn_Github_Bot/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary"
            >
              Terms
            </a>
            <Link href="/guide" className="hover:text-primary">
              Documentation
            </Link>
          </div>

          <a
            href="https://github.com/FerOuvina"
            className="text-sm text-slate-500"
            target="_blank"
          >
            © 2026 Fernando Ouviña.
          </a>
        </div>
      </footer>
    </div>
  );
}
