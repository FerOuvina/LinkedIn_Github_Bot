import { Link } from "wouter";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { sitePath } from "../lib/api.js";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

const COMMITS_IN = msg`commits in`;
const POSTS_OUT = msg`posts out`;

const TICKER = [
  COMMITS_IN,
  POSTS_OUT,
  msg`no copy-paste`,
  msg`runs daily`,
  msg`open source`,
  msg`your keys stay yours`,
  msg`runs on your schedule`,
];

const REPO = "https://github.com/FerOuvina/LinkedIn_Github_Bot";

const CARDS = [
  {
    kicker: msg`01 / pipeline`,
    title: msg`How it works`,
    icon: "hub",
    items: [
      ["history", msg`Scans your repos for the last 24 hours of commits`],
      ["filter_alt", msg`Drops changelogs, merges and chore noise`],
      ["auto_awesome", msg`Turns what is left into a post with an LLM`],
      ["send", msg`Publishes to LinkedIn on a schedule`],
    ],
  },
  {
    kicker: msg`02 / privacy`,
    title: msg`Your data, your control`,
    icon: "shield",
    items: [
      ["dns", msg`Runs on your machine, not on a server`],
      ["key", msg`Tokens go straight to the APIs, nowhere else`],
      ["visibility", msg`Credentials live in .env or GitHub secrets`],
      ["block", msg`No accounts, no tracking, no telemetry`],
    ],
  },
  {
    kicker: msg`03 / who`,
    title: msg`Who it's for`,
    icon: "groups",
    items: [
      ["code", msg`Developers shipping things quietly`],
      ["commit", msg`Open source maintainers`],
      ["record_voice_over", msg`Developer advocates building a profile`],
      ["person", msg`Anyone tired of writing updates by hand`],
    ],
  },
  {
    kicker: msg`04 / notes`,
    title: msg`Good to know`,
    icon: "warning",
    items: [
      ["key_vertical", msg`You bring your own API keys`],
      ["schedule", msg`LinkedIn tokens expire about every 60 days`],
      ["toll", msg`Groq models have rate limits`],
      ["deployed_code", msg`This site is the docs, not the bot`],
    ],
  },
];

function Card({ kicker, title, icon, items }) {
  const { _ } = useLingui();

  return (
    <div className="card">
      <div className="mb-5 flex items-start justify-between">
        <span className="material-symbols-outlined text-[28px] text-primary">
          {icon}
        </span>
        <span className="ff-kicker">{_(kicker)}</span>
      </div>

      <h3 className="ff-display mb-5 text-xl text-bone">{_(title)}</h3>

      <ul className="space-y-3">
        {items.map(([itemIcon, label]) => (
          <li key={label.id} className="flex items-start gap-3 text-sm text-ash">
            <span className="material-symbols-outlined text-[18px] text-cyan">
              {itemIcon}
            </span>
            <span>{_(label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const { _ } = useLingui();

  return (
    <div className="scanlines grid-bg min-h-screen bg-void font-body text-bone">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-2 border-edge bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
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

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost hidden px-4 py-2 sm:inline-flex"
            >
              <span className="material-symbols-outlined text-[18px]">code</span>
              <Trans>source</Trans>
            </a>
            <Link href="/getting-started" className="btn btn-primary px-4 py-2">
              <Trans>get started</Trans>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Ticker ─────────────────────────────────────────────── */}
      <div className="overflow-hidden border-b-2 border-edge bg-primary py-1.5 leading-none sm:py-2">
        <div className="flex w-max animate-marquee will-change-transform">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span
              key={`${item.id}-${i}`}
              className="ff-mono flex items-center whitespace-nowrap px-4 text-[10px] text-void sm:px-6 sm:text-[11px]"
            >
              {_(item)}
              <span className="ml-4 text-void/50 sm:ml-6">→</span>
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
              data-text={_(COMMITS_IN)}
              tabIndex={0}
            >
              {_(COMMITS_IN)}
            </span>
            <br />
            <span
              className="glitch text-primary"
              data-text={_(POSTS_OUT)}
              tabIndex={0}
            >
              {_(POSTS_OUT)}
            </span>
          </h1>

          <p className="max-w-2xl text-lg text-ash">
            <Trans>
              Your GitHub activity becomes a LinkedIn post every day, without
              you writing a single update. Open source, runs on your machine,
              keys stay yours.
            </Trans>
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/getting-started" className="btn btn-primary">
              <Trans>start building</Trans>
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
              <Trans>view source</Trans>
            </a>
          </div>

          <div className="grid w-full max-w-2xl grid-cols-3 gap-px border-2 border-edge bg-edge">
            {[
              ["8", msg`steps to set up`],
              ["0", msg`manual updates`],
              ["~2", msg`min per renewal`],
            ].map(([value, label]) => (
              <div key={label.id} className="bg-panel px-4 py-6">
                <p className="ff-display text-3xl text-primary">{value}</p>
                <p className="ff-mono mt-1 text-[10px] text-ash">{_(label)}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rule" />

        {/* ── Cards ────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-6 py-16 md:grid-cols-2">
          {CARDS.map((card) => (
            <Card key={card.kicker.id} {...card} />
          ))}
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="relative mb-20 overflow-hidden border-2 border-primary bg-panel px-6 py-16 text-center shadow-hard sm:px-12">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="relative flex flex-col items-center gap-6">
            <span className="ff-kicker">
              <Trans>ready when you are</Trans>
            </span>
            <h2 className="ff-display max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
              <Trans>stop writing updates</Trans>
            </h2>
            <p className="max-w-xl text-ash">
              <Trans>
                Clone it, run one command, and let the commits do the talking.
              </Trans>
            </p>

            <div className="mt-2 flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/getting-started" className="btn btn-acid w-full sm:w-auto">
                <Trans>get started</Trans>
              </Link>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost w-full sm:w-auto"
              >
                <span className="material-symbols-outlined text-[18px]">code</span>
                <Trans>github</Trans>
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
              <Trans>privacy</Trans>
            </a>
            <a
              href={`${REPO}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className="ff-mono hover:text-primary"
            >
              <Trans>terms</Trans>
            </a>
            <Link href="/guide" className="ff-mono hover:text-primary">
              <Trans>docs</Trans>
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
