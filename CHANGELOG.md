# Changelog

All notable changes to this project will be documented in this file.

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
