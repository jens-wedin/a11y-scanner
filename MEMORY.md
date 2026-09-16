# Where we left off

Last updated: 2026-09-16

## What this session was

A cold email from a residential-proxy vendor ("spotted puppeteer stealth")
prompted a security review. The review found more than the stealth stack, and
the session turned into working the resulting backlog.

Everything is tracked in [`docs/BACKLOG.md`](docs/BACKLOG.md) — read that first.

## Done (v0.7.0, 11 commits, not yet pushed)

| Item | What |
|---|---|
| SEC-1 | SSRF fixed. `lib/url-guard.ts` validates scheme + resolves DNS + rejects private/reserved addresses. Enforced at crawl entry, every navigation, after redirects, and in `scanPages()`. |
| SEC-3 | `lib/scheduler.ts` had its own unescaped email template, missed by the 0.6.1 fix. Now shares `escapeHtml`. |
| SEC-4 | `PUT /api/schedules/[id]` no longer spreads the request body — fields whitelisted and validated. |
| SEC-5 | `scanId` validated as a UUID before filesystem access. The RED test proved the traversal was live. |
| BUG-1 | `.env.local` held `ANTROPHIC_API_KEY` (misspelled) so AI analysis had silently never worked. Renamed; `lib/env-check.ts` warns at startup; analyzer logs why it falls back. |
| DEP-1 | Next.js 16.1.6 → ^16.3.5 (critical advisory). `npm audit`: 22 vulns → **0**. |
| DEC-1 | **Decision: remove the evasion entirely.** Deleted `lib/turnstile.ts`, dropped stealth plugin + rebrowser alias (34 packages). Honest UA, fixed politeness delay. |
| DOC-1 | README rewritten; added "Scanning sites you do not own". |

All work was TDD. Test count 25 → 79. `tsc --noEmit`, `next build` and
`npm audit` all clean.

## Deployed

- **Project:** `studio-manfred/a11y-scanner` (created this session, GitHub connected)
- **URL:** `a11y-scanner-gcucla1ji-studio-manfred.vercel.app`
- **Protection:** Vercel Authentication (SSO), `all_except_custom_domains`.
  Verified: `POST /api/crawl` → 401, GET routes → 302 to `vercel.com/sso-api`.
- **Env vars:** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM` set in
  production via `vercel env add`.

## Pick up here

1. **OPS-1 is the blocker.** The deployment is a shell — it loads, but a scan
   cannot complete. Four verified reasons: read-only filesystem, module-scope job
   `Map` across separate invocations, in-process `node-cron`, and Chromium not in
   the function bundle. Plus `maxDuration = 300` is too short for a 200-page scan.
   Jens chose "deploy the shell now, fix after", so this is the next real work.
   There is an open architectural question in the backlog: Functions may be the
   wrong runtime for a multi-minute browser crawl — consider Vercel Services.
2. **11 commits are unpushed.** Pushing triggers an auto-deploy via the GitHub
   connection. Ask before pushing.
3. **SEC-2 has two sub-items left:** restrict `to` in the email route to an
   allowlist, and decide whether to add shared-password protection (Pro add-on,
   Jens picks the password) on top of SSO.
4. **DEP-2:** `lib/analyzer.ts` requests `claude-sonnet-4-6`. Verify it still
   resolves — with BUG-1 fixed the analyzer now logs clearly if it does not.
5. **Vercel CLI is outdated** locally (59.5.0 vs 59.19.0).
