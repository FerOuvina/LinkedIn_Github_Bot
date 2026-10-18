# LinkedIn credentials setup

LinkedIn access tokens expire about every 60 days. There's no way around that —
LinkedIn retired long-lived tokens — so this is a recurring two-minute job.
This guide covers getting a token the first time and refreshing it after.

## One-time: create the app

1. Go to <https://www.linkedin.com/developers/apps> and click **Create app**.
   Name it anything, e.g. `github-linkedin-bot`, and pick an appropriate logo —
   it appears on the consent screen members see when authorizing your app:

   <img src="img/linkedin-app-logo.jpg" width="120" alt="LinkedIn app logo">

2. Open **Products** and request **both** of these. You need both:

   | Product | Why |
   | --- | --- |
   | **Sign In with LinkedIn using OpenID Connect** | Grants the `openid profile` scopes, so the script can read your name and ID. |
   | **Share on LinkedIn** | Grants `w_member_social` — without it, authorizing fails or the post request is rejected with a 403. |

   They are separate approvals and you must wait for each to be **Approved**
   before authorizing. Skipping **Share on LinkedIn** is the most common reason
   `w_member_social` is missing from the token.

3. Open **Auth → Redirect URLs** and add:

   ```
   http://localhost:3000/callback
   ```

   The value must match `LINKEDIN_REDIRECT_URI` exactly, including the scheme,
   port, and trailing path. If you change it, change both.

4. On the app's **Auth** tab, copy the **Client ID** and **Client secret**.

## Configure your .env

```bash
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/callback
```

The client secret is a real credential. Keep it in `.env` (gitignored) and in
GitHub Secrets — never in a committed file.

## Get your token

```bash
npm run auth:linkedin
```

This opens your browser, you approve the app, and it prints:

```
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_AUTHOR_URN=urn:li:person:...
```

You may also get a third line:

```
LINKEDIN_REFRESH_TOKEN=...
```

**Most apps don't get one.** LinkedIn only issues refresh tokens to a limited
set of approved partner apps ("programmatic refresh tokens"); everyone else
gets an access token with a 60-day life and no way to renew it
programmatically. There's no scope you can request to unlock this — the
standard OpenID `offline_access` scope is rejected by LinkedIn as an unknown
scope. The script detects this and tells you so.

Copy whatever lines it printed. Add them to `.env` for local runs, and as
**GitHub repository secrets** (Settings → Secrets and variables → Actions) for
the scheduled job:

| Secret | Value |
| --- | --- |
| `LINKEDIN_ACCESS_TOKEN` | the access token |
| `LINKEDIN_AUTHOR_URN` | the author URN |

Only add `LINKEDIN_REFRESH_TOKEN` if you actually received one.

## Check it worked

```bash
npm run preflight
```

```
❌ Some credentials need attention:
  ✅ GitHub: authenticated as your-username
  ✅ LinkedIn: authenticated as Your Name
  ✅ Groq: model "<configured model>" is available and the key works
```

`✅ LinkedIn` means the token is live. If it says `EXPIRED_ACCESS_TOKEN`, the
token is dead and you need a new one.

## Renewing after ~60 days

**If you were issued a refresh token** (rare — see above), no browser is
needed:

```bash
npm run auth:linkedin -- --refresh
```

That mints a fresh access token and prints the values to update. Update both
secrets, since the refresh token is replaced too.

**Otherwise, which is the normal case**, just re-run the full flow:

```bash
npm run auth:linkedin
```

It's quick: while you're still signed in to LinkedIn, the consent screen is
skipped and it just redirects back with a new code. Take the new
`LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` and update the secrets.

> If you change the requested scopes, LinkedIn invalidates every previously
> issued token — so re-run the flow after any scope change, and update the
> secrets immediately.

## Troubleshooting

**`state mismatch`** — something modified the callback URL. Just rerun it.

**`Could not listen on port 3000`** — another app is using the port, or the
redirect URI in your LinkedIn app doesn't match `LINKEDIN_REDIRECT_URI`. They
must be identical, and the port has to be free.

**`LinkedIn rejected the code`** — the auth code is single-use and expires in
about 5 minutes. Rerun the flow; don't reuse an old code.

**`redirect_uri` mismatch error from LinkedIn** — the URI registered in the app
and your `.env` differ. Compare them character by character.

**`This redirect URI has not been approved`** — add the exact URI under
Auth → Redirect URLs in the LinkedIn app. It can take a few minutes to
propagate.

**403 on publishing** — the token is missing the `w_member_social` scope. Check
that the **Share on LinkedIn** product was requested and shows **Approved** on
the app's Products tab, then re-run `npm run auth:linkedin` — an old token won't
gain the scope retroactively. If the token is also expired, `npm run preflight`
reports that separately.

**`unauthorized` or a scope error while authorizing** — usually the same cause:
**Share on LinkedIn** isn't approved yet. Newly requested products can take a few
minutes to become usable.
