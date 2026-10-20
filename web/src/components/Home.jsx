import { Link } from "wouter";
import { sitePath } from "../lib/api.js";

const TICKER = [
  "commits in",
  "posts out",
  "no copy-paste",
  "runs daily",
  "open source",
  "your keys stay yours",
  "runs on your schedule",
];

const REPO = "https://github.com/FerOuvina/LinkedIn_Github_Bot";

const CARDS = [
  {
    kicker: "01 / pipeline",
    title: "How it works",
    icon: "hub",
    items: [
      ["history", "Scans your repos for the last 24 hours of commits"],
      ["filter_alt", "Drops changelogs, merges and chore noise"],
      ["auto_awesome", "Turns what is left into a post with an LLM"],
      ["send", "Publishes to LinkedIn on a schedule"],
    ],
  },
  {
    kicker: "02 / privacy",
    title: "Your data, your control",
    icon: "shield",
    items: [
      ["dns", "Runs on your machine, not on a server"],
      ["key", "Tokens go straight to the APIs, nowhere else"],
      ["visibility", "Credentials live in .env or GitHub secrets"],
      ["block", "No accounts, no tracking, no telemetry"],
    ],
  },
  {
    kicker: "03 / who",
    title: "Who it's for",
    icon: "groups",
    items: [
      ["code", "Developers shipping things quietly"],
      ["commit", "Open source maintainers"],
      ["record_voice_over", "Developer advocates building a profile"],
      ["person", "Anyone tired of writing updates by hand"],
    ],
  },
  {
    kicker: "04 / notes",
    title: "Good to know",
    icon: "warning",
    items: [
      ["key_vertical", "You bring your own API keys"],
      ["schedule", "LinkedIn tokens expire about every 60 days"],
      ["toll", "Groq models have rate limits"],
      ["deployed_code", "This site is the docs, not the bot"],
    ],
  },
];

function Card({ kicker, title, icon, items }) {
  return (
    <div className="card">
      <div className="mb-5 flex items-start justify-between">
        <span className="material-symbols-outlined text-[28px] text-primary">
          {icon}
        </span>
        <span className="ff-kicker">{kicker}</span>
      </div>

      <h3 className="ff-display mb-5 text-xl text-bone">{title}</h3>

      <ul className="space-y-3">
        {items.map(([itemIcon, label]) => (
          <li key={label} className="flex items-start gap-3 text-sm text-ash">
            <span className="material-symbols-outlined text-[18px] text-cyan">
              {itemIcon}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <div className="scanlines grid-bg min-h-screen bg-void font-body text-bone">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-2 border-edge bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">
              rocket_launch
            </span>
            <span className="ff-mono text-sm">
              github<span className="text-primary">→</span>linkedin
            </span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost hidden px-4 py-2 sm:inline-flex"
            >
              <span className="material-symbols-outlined text-[18px]">code</span>
              source
            </a>
            <Link href="/getting-started" className="btn btn-primary px-4 py-2">
              get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Ticker ─────────────────────────────────────────────── */}
      <div className="overflow-hidden border-b-2 border-edge bg-primary py-1.5 leading-none sm:py-2">
        <div className="flex w-max animate-marquee will-change-transform">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="ff-mono flex items-center whitespace-nowrap px-4 text-[10px] text-void sm:px-6 sm:text-[11px]"
            >
              {item}
              <span className="ml-4 text-void/50 sm:ml-6">◆</span>
            </span>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-8 py-20 text-center lg:py-28">
          <span className="ff-badge">
            <span className="size-1.5 animate-blink bg-primary" />
            v1.0 // live
          </span>

          <h1 className="ff-display max-w-5xl text-5xl sm:text-7xl lg:text-8xl">
            <span
              className="glitch"
              data-text="commits in"
              tabIndex={0}
            >
              commits in
            </span>
            <br />
            <span
              className="glitch text-primary"
              data-text="posts out"
              tabIndex={0}
            >
              posts out
            </span>
          </h1>

          <p className="max-w-2xl text-lg text-ash">
            Your GitHub activity becomes a LinkedIn post every day, without you
            writing a single update. Open source, runs on your machine, keys stay
            yours.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/getting-started" className="btn btn-primary">
              start building
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </Link>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              <span className="material-symbols-outlined text-[18px]">code</span>
              view source
            </a>
          </div>

          <div className="grid w-full max-w-2xl grid-cols-3 gap-px border-2 border-edge bg-edge">
            {[
              ["8", "steps to set up"],
              ["0", "manual updates"],
              ["~2", "min per renewal"],
            ].map(([value, label]) => (
              <div key={label} className="bg-panel px-4 py-6">
                <p className="ff-display text-3xl text-primary">{value}</p>
                <p className="ff-mono mt-1 text-[10px] text-ash">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rule" />

        {/* ── Cards ────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-6 py-16 md:grid-cols-2">
          {CARDS.map((card) => (
            <Card key={card.title} {...card} />
          ))}
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="relative mb-20 overflow-hidden border-2 border-primary bg-panel px-6 py-16 text-center shadow-hard sm:px-12">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="relative flex flex-col items-center gap-6">
            <span className="ff-kicker">ready when you are</span>
            <h2 className="ff-display max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
              stop writing updates
            </h2>
            <p className="max-w-xl text-ash">
              Clone it, run one command, and let the commits do the talking.
            </p>

            <div className="mt-2 flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/getting-started" className="btn btn-acid w-full sm:w-auto">
                get started
              </Link>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost w-full sm:w-auto"
              >
                <span className="material-symbols-outlined text-[18px]">code</span>
                github
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t-2 border-edge bg-void">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-primary">
              rocket_launch
            </span>
            <span className="ff-mono text-xs">github→linkedin</span>
          </a>

          <div className="flex gap-6 text-xs">
            <a href={sitePath("/privacy-policy/")} className="ff-mono hover:text-primary">
              privacy
            </a>
            <a
              href={`${REPO}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className="ff-mono hover:text-primary"
            >
              terms
            </a>
            <Link href="/guide" className="ff-mono hover:text-primary">
              docs
            </Link>
          </div>

          <a
            href="https://github.com/FerOuvina"
            target="_blank"
            rel="noreferrer"
            className="ff-mono text-[10px] text-ash hover:text-primary"
          >
            © 2026 fernando ouviña
          </a>
        </div>
      </footer>
    </div>
  );
}
