# GitHub → LinkedIn Bot

Turns your daily GitHub commits into a LinkedIn post, on a schedule.

Each morning the bot scans your most active repos, scores commits by how
significant they look, asks an LLM to turn the keepers into a short post, and
publishes it to LinkedIn. Nothing to write by hand.

## How it works

1. Lists your repos and fetches each one's commits from the last 24 hours.
2. Ranks repos by commit count and keeps the top 3.
3. Scores each commit message — `feat:` +5, `fix:` +4, `chore/docs/ci` −2,
   and so on — and drops anything scoring below 1.
4. Sends the survivors to an LLM with a prompt asking for a LinkedIn post.
5. Appends your GitHub and portfolio links, then publishes it.

Only one fetch per repo, requests run concurrently with a 10s timeout and
bounded retries, and the publish is never retried (a retry could post twice).

## Setup

You need Node 24 (see `.nvmrc`) and a `.env` file with:

| Variable | What it's for |
| --- | --- |
| `HUB_USER` | Your GitHub username |
| `GITHUB_TOKEN` | Any GitHub token with public repo read access |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth token that permits posting (`ugcPosts`) |
| `LINKEDIN_AUTHOR_URN` | Your `urn:li:person:...` identifier |
| `HUGGINGFACE_API_KEY` | Key for the LLM |

Two throwaway helper scripts — `scripts/getLinkedInToken.js` and
`scripts/getLinkedInUser.js` — walk through the LinkedIn OAuth flow and print
your author URN. They're gitignored; delete them once you have the values.

### Local run

```bash
npm install
npm start              # publishes
npm start -- --dry-run # prints the post instead of publishing
```

The script exits non-zero if anything fails, so a broken run is obvious rather
than silent.

### GitHub Actions

`.github/workflows/linkedin-post.yml` runs this daily at 18:00 UTC and can
also be triggered manually. Add the five variables above as repository
secrets and you're done.

## Tests

```bash
npm test
```

91 tests covering commit scoring, the GitHub and HTTP layers, the CLI exit
codes, and the workflow configuration.

## Project layout

```
scripts/
  dailySummary.js   CLI entry point; owns the exit code
  mainScript.js     orchestration
  github.js         repo scanning, caching, concurrency
  http.js           timeout + retry wrapper
  commitScoring.js  score rules and filtering
```

## Security

Credentials come from environment variables and GitHub Secrets — nothing is
committed. The scripts that handle secrets are gitignored, but they contain
plaintext values on disk, so don't commit them.

## Ideas

- Let people connect their own GitHub and LinkedIn accounts via a small web app.
- Make tone, length, and posting frequency configurable.
