import { useEffect, useState } from "react";
import { Link } from "wouter";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { rewriteRelativeUrls, extractHeadings } from "../lib/markdown.js";

const GUIDES = [
  { file: "LINKEDIN_SETUP.md", title: "LinkedIn setup", blurb: "Create your LinkedIn app and get a token" },
];

export default function Guide() {
  const [state, setState] = useState({ loading: true, html: "", headings: [], error: "" });

  useEffect(() => {
    const file = GUIDES[0].file;

    fetch(`/docs/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the guide (${res.status})`);
        return res.text();
      })
      .then((markdown) => {
        const raw = marked.parse(markdown);
        const { html, headings } = extractHeadings(rewriteRelativeUrls(raw));
        // Sanitise last: the guide is repo content, but the renderer must
        // never be the reason untrusted HTML reaches the page.
        const clean = DOMPurify.sanitize(html);
        setState({ loading: false, html: clean, headings, error: "" });
      })
      .catch((err) => setState({ loading: false, html: "", headings: [], error: err.message }));
  }, []);

  return (
    <div className="min-h-screen bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-white">
      <header className="border-b border-gray-200 dark:border-border-dark bg-white/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-primary">rocket_launch</span>
            GitHub → LinkedIn
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={`/docs/${GUIDES[0].file}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium dark:border-border-dark"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              Raw markdown
            </a>
            <Link
              href="/getting-started"
              className="flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20"
            >
              Setup wizard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row">
        <aside className="hidden w-56 shrink-0 md:block">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            On this page
          </p>
          <nav className="sticky top-24 space-y-1">
            {state.headings
              .filter((h) => h.level === 2)
              .map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className="block rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {h.text}
                </a>
              ))}
          </nav>
        </aside>

        <article className="prose-slate min-w-0 flex-1">
          {state.loading && <p className="text-slate-500">Loading the guide…</p>}

          {state.error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
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
