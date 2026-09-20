# Accessibility Scanner

A client-facing web application that crawls a website, runs accessibility scanning via axe-core + Playwright, and uses Claude AI to produce a clear, prioritised, actionable accessibility report.

## Features

- **Phase 1 — URL indexing:** Playwright Chromium BFS crawl discovers all same-origin pages up to the configured limit. The crawler identifies itself honestly via its user-agent, pauses one second between navigations to avoid loading the target, and validates every navigation target against `lib/url-guard.ts` before opening it. Links are extracted via `page.evaluate()`, deduplicated, and queued. Returns `{url, title, depth}` per page. The user then reviews and deselects any pages before the scan starts.
- **Phase 2 — Scanning:** axe-core via Playwright with WCAG 2.2 AA rules (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa)
- **Phase 2 — AI analysis:** Claude (`claude-sonnet-4-6`) deduplicates, enriches, and interprets violations into plain language with WCAG mapping, EAA risk assessment, fix complexity, and business impact
- **Phase 3 — Report:** Filterable issue list sorted by severity with expandable detail cards
- **Export:** PDF and JSON download, or email report directly with embedded HTML / PDF / JSON attachments
- **Scheduled scans:** Recurring audits (daily / weekly / monthly / custom cron) with optional Resend email notifications

## Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Configure your API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env.local
```

## Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## Usage

1. **Enter the website URL** and configure max pages (10 / 50 / 100 / 200) and optional crawl depth
2. **Review discovered pages** — deselect any you don't want scanned
3. **Watch live progress** as axe-core scans each page via Playwright
4. **View the report** — filter by severity, WCAG level, EAA risk, or fix effort
5. **Export** as PDF (client deliverable) or JSON (developer/CI use), or **email** the report directly

## Tests

```bash
# Unit tests (Vitest)
npm test

# E2E tests (Playwright)
npx playwright test
```

## Architecture

```
Next.js 15 App Router
├── app/
│   ├── page.tsx                Home: scan config form
│   ├── crawl/[scanId]/         URL preview — confirm scope
│   ├── scan/[scanId]/          Live progress (SSE-driven)
│   ├── report/[scanId]/        Filterable accessibility report
│   └── api/
│       ├── crawl/              POST: Playwright BFS crawl → returns [{url, title, depth}]
│       └── scan/[scanId]/      SSE progress, report, PDF/JSON export
├── lib/
│   ├── browser.ts              Chromium launch + context (honest user-agent, crawl delay)
│   ├── crawler.ts              Playwright BFS link discovery (sequential, SSRF-guarded)
│   ├── scanner.ts              axe-core page scanning (p-queue, concurrency 3, SSRF-guarded)
│   ├── url-guard.ts            Scheme + private-address validation for every scan target
│   ├── turnstile.ts            Cloudflare Turnstile detection + auto-click
│   ├── analyzer.ts             Claude API enrichment + graceful fallback
│   ├── queue.ts                In-memory scan job state + SSE controllers
│   ├── report.ts               JSON persistence to /reports/
│   ├── pdf.tsx                 @react-pdf/renderer PDF generation
│   ├── resend.ts               Shared lazy Resend email client
│   ├── report-email.ts         HTML email templates for report sharing
│   └── types.ts                Shared TypeScript types
├── components/                 React UI components (Tailwind CSS)
└── reports/                    Saved report JSON files (gitignored)
```

**Scan pipeline:**
```
POST /api/crawl              → Playwright BFS crawl → returns URL list
POST /api/scan/start         → queues job, marks as ready
GET  /api/scan/[id]/progress → SSE stream opens
                               → axe-core scans each page (3 concurrent)
                               → Claude enriches all violations
                               → report saved to /reports/[id].json
                               → client redirected to /report/[id]
```

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | React 19 + Tailwind CSS |
| Scanner | Playwright + @axe-core/playwright |
| AI analysis | Anthropic SDK (`claude-sonnet-4-6`) |
| PDF export | @react-pdf/renderer |
| Concurrency | p-queue (3 pages at a time) |
| Testing | Vitest (unit) + Playwright Test (E2E) |

## Scheduled Scans

Create recurring scans from the **Schedules** page (`/schedules`), accessible via the "Schedules →" link on the home page.

Schedules are stored in `schedules.json` (gitignored) and the cron scheduler starts automatically with the dev server via Next.js instrumentation.

### Email notifications (optional)

Add to `.env.local`:

```
RESEND_API_KEY=re_your_key_here
RESEND_FROM=noreply@yourdomain.com
```

Get a free API key at [resend.com](https://resend.com). These env vars are used for both scheduled scan notifications and the "Email Report" button on the report page. Without them, scans run silently with results visible in-app.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude analysis of axe-core violations. Without it every scan falls back to axe-only issues and reports are flagged `analysisFailed`. |
| `RESEND_API_KEY` | No | Sending report emails. Must be set together with `RESEND_FROM`. |
| `RESEND_FROM` | No | Verified sender address for report emails. |
| `BASE_URL` | No | Absolute base for report links in emails. Defaults to `http://localhost:3000`. |

The spelling of `ANTHROPIC_API_KEY` matters — the Anthropic SDK reads that exact
name, and a misspelling degrades silently rather than erroring. The server checks
this at startup (`lib/env-check.ts`) and warns on the console if anything is off.

## Scanning sites you do not own

This scanner identifies itself honestly and does not attempt to evade bot
detection. If a target sits behind Cloudflare, a WAF or similar, the correct
path is consent, not circumvention:

1. Get written permission from the site owner before scanning.
2. Ask them to allowlist the scanner's user-agent
   (`A11yScanner/0.7 (+https://studiomanfred.com/a11y-scanner; accessibility auditing)`),
   or to allowlist the IP the scan runs from.
3. If they decline, do not scan. A blocked crawl is a business conversation,
   not a technical problem.

### When a scan returns HTTP 403

A 403 on the first page almost always means a firewall or bot-protection
service, not a broken site. The scanner will say so rather than retrying
behind a disguise. Options, in order of preference:

| Option | When it fits |
|---|---|
| Owner allowlists the user-agent | You have a signed engagement. Cheapest for them. |
| Owner allowlists the scanning IP | Their WAF filters on IP. Needs a fixed egress address — Vercel Functions do not have one, so run these scans from a host you control. |
| Scan a staging environment | Pre-launch audits, or where production is locked down. Usually the best data anyway, since staging has no CDN caching in the way. |
| Client runs axe themselves | No access at all. Hand them the axe DevTools extension and read the export. |

For prospecting — auditing a site to show someone a problem they have not
hired you to find — a 403 is a clear signal to ask first. That conversation is
also a better opening than an unsolicited report.

Earlier versions shipped `puppeteer-extra-plugin-stealth`, `rebrowser-playwright`
and a Cloudflare Turnstile checkbox-clicker. These were removed in 0.7.0 — see
CHANGELOG and `docs/BACKLOG.md` (DEC-1) for the reasoning.

## Notes

- The in-memory job queue is suitable for local-first use. For multi-user hosted deployment, replace `lib/queue.ts` with a Redis-backed store.
- Reports are saved as JSON in `/reports/` (gitignored) and survive server restarts.
- Schedules are saved as JSON in `schedules.json` (gitignored) and reloaded on server start.
