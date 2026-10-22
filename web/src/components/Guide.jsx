import { useEffect, useState } from "react";
import { Link } from "wouter";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { rewriteRelativeUrls, extractHeadings } from "../lib/markdown.js";
import { docsUrl, sitePath } from "../lib/api.js";
import HostedBanner from "./HostedBanner.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

const GUIDES = [
  {
    file: "LINKEDIN_SETUP.md",
    localized: { es: "LINKEDIN_SETUP.es.md" },
    title: "LinkedIn setup",
    blurb: "Create your LinkedIn app and get a token",
  },
];

export default function Guide() {
  const { _, i18n } = useLingui();
  const [state, setState] = useState({ loading: true, html: "", headings: [], error: "" });
  const guideFile = GUIDES[0].localized?.[i18n.locale] ?? GUIDES[0].file;

  useEffect(() => {
    fetch(docsUrl(guideFile))
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            _(msg`Could not load the guide (${res.status})`, { status: res.status })
          );
        }
        return res.text();
      })
      .then((markdown) => {
        const raw = marked.parse(markdown);
        // Relative paths in a guide are relative to docs/, and that whole path
        // has to carry the site base or it resolves off the Pages subpath.
        const { html, headings } = extractHeadings(
          rewriteRelativeUrls(raw, sitePath("/docs/"))
        );
        // Sanitise last: the guide is repo content, but the renderer must
        // never be the reason untrusted HTML reaches the page.
        const clean = DOMPurify.sanitize(html);
        setState({ loading: false, html: clean, headings, error: "" });
      })
      .catch((err) => setState({ loading: false, html: "", headings: [], error: err.message }));
  }, [_, guideFile]);

  return (
    <div className="scanlines grid-bg min-h-screen bg-void font-body text-bone">
      <header className="sticky top-0 z-40 border-b-2 border-edge bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">rocket_launch</span>
            <span className="ff-mono text-sm">github<span className="text-primary">→</span>linkedin</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a
              href={docsUrl(guideFile)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost hidden px-4 py-2 sm:inline-flex"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <Trans>Raw markdown</Trans>
            </a>
            <Link
              href="/getting-started"
              className="btn btn-primary px-4 py-2"
            >
              <Trans>Setup wizard</Trans>
            </Link>
          </div>
        </div>
      </header>

      <HostedBanner />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row">        <aside className="hidden w-56 shrink-0 md:block">
          <p className="ff-kicker mb-3">
            <Trans>On this page</Trans>
          </p>
          <nav className="sticky top-24 space-y-1">
            {state.headings
              .filter((h) => h.level === 2)
              .map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className="ff-mono block border-l-2 border-transparent px-3 py-1.5 text-[11px] text-ash hover:border-primary hover:bg-primary/10 hover:text-bone"
                >
                  {h.text}
                </a>
              ))}
          </nav>
        </aside>

        <article className="prose-slate min-w-0 flex-1">
          {state.loading && (
            <p className="ff-mono text-[11px] text-ash">
              <Trans>loading_guide…</Trans>
            </p>
          )}

          {state.error && (
            <div className="panel border-crimson p-4 text-crimson">
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && (
            <div
              className="guide max-w-none"
              // Sanitised above with DOMPurify.
              dangerouslySetInnerHTML={{ __html: state.html }}
            />
          )}
        </article>
      </main>
    </div>
  );
}
