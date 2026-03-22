# Changelog

All notable changes to this project will be documented in this file.

## [0.6.1] — 2026-03-22

### Fixed

- **HTML injection in email reports:** Escaped all user-controlled fields (`targetUrl`, issue titles, WCAG criteria, severity labels) before interpolating into email HTML templates, preventing malicious page content from injecting HTML into outbound emails
- **Timer leak in EmailReportDialog:** Auto-close `setTimeout` is now tracked in a `useRef` and cancelled on unmount, preventing state updates on an unmounted component

## [0.6.0] — 2026-03-14

### Added

- **Email report sharing:** New "Email Report" button on the report page opens a dialog to send reports via email (Resend). Choose between embedding the full report in the email body, attaching PDF, attaching JSON, or attaching both.
- **Dialog UI component:** Reusable dialog built on `@base-ui/react/dialog` with backdrop, focus trap, and animations
- **Shared Resend client:** Extracted lazy-initialised Resend client into `lib/resend.ts` for reuse across scheduler and report email features
- **Report email templates:** Rich HTML email templates with severity summary cards and issue table (`lib/report-email.ts`)

### Changed

- **Scheduler refactored:** `lib/scheduler.ts` now imports shared Resend client from `lib/resend.ts` instead of maintaining its own

## [0.5.2] — 2026-03-14

### Fixed

- **Radio button accessibility:** Added `aria-label` to `RadioGroupItem` in ScanConfigForm and ScheduleForm — Base UI's `<span role="radio">` doesn't support `htmlFor` label association (WCAG 4.1.2)
- **Heading order on report page:** Added `<h2>` section heading before the issues list to fix h1→h3 skip (WCAG 1.3.1)
- **Empty table header on schedules page:** Added visually hidden "Actions" text to the actions column header

## [0.5.1] — 2026-03-10

### Added

- **Cloudflare Turnstile auto-click:** Detects Turnstile challenge widgets and clicks the checkbox automatically — works for managed-mode challenges without a paid solver service
- **Challenge page detection:** `waitForChallenge()` now actively detects Cloudflare "Just a moment" pages and attempts Turnstile resolution before giving up

### Changed

- **Challenge wait time:** Increased from 15 s to 20 s to allow more time for Turnstile resolution
- **First page timeout:** Increased from 30 s to 45 s for heavily protected sites

## [0.5.0] — 2026-03-10

### Added

- **Stealth browser engine:** `playwright-extra` + `puppeteer-extra-plugin-stealth` adds ~10 evasion techniques (WebGL vendor, Chrome runtime, permissions, navigator.plugins) on top of the existing `rebrowser-playwright` patches
- **Shared browser helper:** New `lib/browser.ts` centralises browser launch and context config — eliminates duplication between crawler and scanner
- **Smarter wait strategy:** First page uses `networkidle` (30 s) so Cloudflare challenge pages can complete; subsequent pages use faster `domcontentloaded` (15 s)
- **Random navigation delay:** 1–3 s random pause between crawler page loads to reduce bot detection
- **Clickable severity cards:** Summary cards (Critical/Serious/Moderate/Minor) on the report page now filter issues when clicked
- **Clickable issue chips:** Severity, WCAG level, EAA risk, and fix effort badges on each IssueCard apply the matching filter when clicked

### Changed

- **rebrowser-patches mode:** Set `REBROWSER_PATCHES_RUNTIME_FIX_MODE=alwaysIsolated` for strongest anti-detection
- **Browser context:** Added realistic screen dimensions, Stockholm timezone, and Swedish language accept header
- **Error messages:** Blocked-site errors now mention possible causes (paywall, Cloudflare) instead of generic text

## [0.4.0] — 2026-03-09

### Added

- **Dark / light mode:** System-aware theme switching via `next-themes`; Sun/Moon toggle button in every page header persists preference across sessions
- **Smooth theme transitions:** 200 ms ease on background and border colours, 150 ms on text — no jarring flash on toggle

### Fixed

- **Font not loading:** Host Grotesk CSS variable was set on `<body>` but consumed by `<html>`; moved font classes to `<html>` so `var(--font-sans)` resolves correctly

## [0.3.0] — 2026-03-08

### Added

- **Running indicator:** Spinning icon and tinted row on the Schedules page while a scan is in progress; page polls every 3 s and clears automatically when the scan finishes (`runningAt` timestamp on the Schedule record)
- **shadcn/ui component library:** All hand-rolled Tailwind UI elements replaced with shadcn/ui primitives (`Button`, `Input`, `Select`, `RadioGroup`, `Checkbox`, `Progress`, `Switch`, `Table`, `Badge`, `Collapsible`, `Separator`) — consistent design tokens, keyboard behaviour, and accessibility semantics across the entire app

### Changed

- **IssueCard:** Severity/WCAG/EAA labels now use `Badge` with colour overrides; expand/collapse section uses `Collapsible` + `CollapsibleTrigger` for reliable keyboard and screen-reader support
- **ScanProgressView:** Custom progress bar replaced with shadcn `Progress` (renders `role="progressbar"` + `aria-valuenow` automatically)
- **UrlPreviewList:** Native checkboxes replaced with shadcn `Checkbox`; action buttons replaced with `Button`
- **FilterBar:** All four native `<select>` elements replaced with shadcn `Select`; search field replaced with `Input`
- **ScanConfigForm / ScheduleForm:** All inputs, radio groups, depth selects, and submit buttons replaced with shadcn equivalents; frequency card-buttons in ScheduleForm retain the accessible sr-only native-radio pattern

## [0.2.0] — 2026-03-08

### Added

- **Scheduled scans:** Recurring accessibility audits (daily, weekly, monthly, or custom cron expression) via `node-cron`, initialized at server start through Next.js instrumentation
- **Schedule management UI:** `/schedules` list page with enable/disable toggle, "Run now" button, last-run summary (issue count + critical badge), and delete
- **Create schedule form:** `/schedules/new` with name, URL, frequency picker, time, max pages, max depth, and optional notification email
- **Email notifications:** Resend API integration — sends a summary email with issue counts and a link to the report when a scheduled scan completes (`RESEND_API_KEY` + `RESEND_FROM` in `.env.local`)
- **Schedules persistence:** Saved to `schedules.json` on disk (gitignored), reloaded on server restart
- **"Schedules →" nav link** on the home page

### Fixed

- **Crawler silent failure:** First-page timeouts and network errors now trigger the headless=false retry (same as bot-protection responses) instead of silently returning an empty URL list
- **Crawl preview empty state:** Replaced the misleading "Loading…" message with a clear "No pages discovered" explanation and a back button when the crawl returns zero URLs

## [0.1.1] — 2026-03-07

### Fixed

- **SSE stability:** Added `force-dynamic` and `maxDuration=300` to the progress route to prevent Next.js from caching or timing out long-running streaming responses
- **SSE stability:** Send immediate `: connected` ping on stream open so the browser never fires `onerror` before the first scan event arrives
- **SSE stability:** Reduced heartbeat interval from 15 s to 5 s for more reliable keepalive on slow sites
- **Analyzer payload:** Trim violation nodes to max 3 per violation and cap HTML snippets at 300 chars before sending to Claude, preventing context-window overflows and timeouts on large sites
- **Bot-protection bypass:** Auto-retry crawl with `headless: false` when site returns 403; scanner inherits same headless flag
- **Session recovery:** Recreate scan job from `sessionStorage` if in-memory queue is cleared (e.g. dev server restart)
- **Error visibility:** Surface 403/bot-protection errors to the user instead of returning an empty URL list

## [0.1.0] — 2026-03-07

### Added

- **Phase 1 — URL Indexing:** Playwright BFS crawler with configurable max pages and depth limit
- **Phase 2 — Scanning:** axe-core accessibility scanning via `@axe-core/playwright` (WCAG 2.2 AA ruleset), running 3 pages concurrently via `p-queue`
- **Phase 2 — AI Analysis:** Claude (`claude-sonnet-4-6`) enrichment of axe-core violations — deduplication, plain-language descriptions, WCAG criterion mapping, EAA compliance risk assessment, fix complexity estimation, business impact summary, code examples and recommended fixes
- **Phase 2 — Fallback:** Graceful degradation to raw axe-core findings if Claude API fails or returns malformed output
- **Phase 3 — Report UI:** Filterable, sortable issue report with severity, WCAG level, EAA risk, and fix effort filters plus free-text search
- **Phase 3 — Issue cards:** Expandable cards showing violation code, recommended fix, affected pages list, and WCAG documentation link
- **Export:** PDF report via `@react-pdf/renderer` and JSON download
- **Live progress:** Server-Sent Events (SSE) stream for real-time scan progress updates
- **In-memory job queue:** Scan job state management suitable for local-first use
- **Report persistence:** Reports saved as JSON files in `/reports/` and survive server restarts
- **Accessible UI:** App passes WCAG 2.x AA audit (zero axe-core violations on all pages)
- **Unit tests:** Vitest tests for queue, crawler utils, and Claude analyzer (including fallback behaviour)
- **E2E tests:** Playwright tests covering home page rendering, form validation, error states
