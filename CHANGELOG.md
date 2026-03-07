# Changelog

All notable changes to this project will be documented in this file.

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
