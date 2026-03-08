# Accessibility Scanner

A client-facing web application that crawls a website, runs accessibility scanning via axe-core + Playwright, and uses Claude AI to produce a clear, prioritised, actionable accessibility report.

## Features

- **Phase 1 — URL indexing:** Crawl a website and preview discovered pages before scanning
- **Phase 2 — Scanning:** axe-core via Playwright with WCAG 2.2 AA rules (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa)
- **Phase 2 — AI analysis:** Claude (`claude-sonnet-4-6`) deduplicates, enriches, and interprets violations into plain language with WCAG mapping, EAA risk assessment, fix complexity, and business impact
- **Phase 3 — Report:** Filterable issue list sorted by severity with expandable detail cards
- **Export:** PDF and JSON
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
5. **Export** as PDF (client deliverable) or JSON (developer/CI use)

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
│       ├── crawl/              POST: Playwright BFS crawl
│       └── scan/[scanId]/      SSE progress, report, PDF/JSON export
├── lib/
│   ├── crawler.ts              Playwright BFS link discovery
│   ├── scanner.ts              axe-core page scanning (p-queue, concurrency 3)
│   ├── analyzer.ts             Claude API enrichment + graceful fallback
│   ├── queue.ts                In-memory scan job state + SSE controllers
│   ├── report.ts               JSON persistence to /reports/
│   ├── pdf.tsx                 @react-pdf/renderer PDF generation
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
| Framework | Next.js 15 (App Router) + TypeScript |
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

Get a free API key at [resend.com](https://resend.com). Without these vars, scans run silently with results visible in-app.

## Notes

- The in-memory job queue is suitable for local-first use. For multi-user hosted deployment, replace `lib/queue.ts` with a Redis-backed store.
- Reports are saved as JSON in `/reports/` (gitignored) and survive server restarts.
- Schedules are saved as JSON in `schedules.json` (gitignored) and reloaded on server start.
