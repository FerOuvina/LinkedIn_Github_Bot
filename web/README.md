# Setup wizard

The browser UI for `npm run setup`. It is optional: everything it does has a
CLI equivalent, and the bot itself never imports anything from here.

## Running it

```bash
npm run setup          # from the repo root, starts the Node server
```

Then open <http://127.0.0.1:4319>.

## Developing

```bash
npm install
npm run dev            # http://localhost:5173, proxies /api to :4319
npm run build          # writes dist/, which is committed
npm run lint
```

`dist/` is committed on purpose, so a fresh clone can run the wizard without
anyone installing 370 packages. **Rebuild and commit it** whenever you change
anything under `src/` — the server serves the committed copy, not your working
tree.

## How it fits together

| Piece | Does |
| --- | --- |
| `src/lib/api.js` | Every call to the Node server |
| `src/context/SetupContext.jsx` | Holds credentials between steps, in memory |
| `src/lib/markdown.js` | Rewrites relative image paths and builds the ToC |
| `src/components/Guide.jsx` | Renders `docs/*.md` as a page |

The wizard never talks to GitHub, LinkedIn or Groq directly. It calls the local
Node server, which is the only process that handles credentials — and that
server binds to `127.0.0.1` only.

## Steps

1. **Check your machine** — Node version, GitHub CLI, and what is missing.
2. **Clone and start** — the commands to run.
3. **API credentials** — GitHub token and Groq key.
4. **Connect LinkedIn** — OAuth in a popup; tokens go back to the server, never
   through a URL.
5. **Save credentials** — preview first, then write to GitHub secrets and/or
   `.env`.
6. **Verify** — live credential checks, and a test post that publishes nothing.
