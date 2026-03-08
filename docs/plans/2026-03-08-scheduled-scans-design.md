# Scheduled Scans — Design

**Date:** 2026-03-08
**Status:** Approved

## Problem

Users need to run recurring accessibility audits (daily, weekly, monthly) without manually triggering each scan. Results should be persisted and optionally delivered by email.

## Decisions

| Question | Decision |
|---|---|
| Persistence | `schedules.json` on disk (consistent with existing `reports/*.json` pattern) |
| Scheduler | `node-cron` — in-process, initialized via Next.js `instrumentation.ts` |
| URL strategy | Re-crawl each time (discovers new pages automatically) |
| Email | Resend API (`RESEND_API_KEY` + `RESEND_FROM` in `.env.local`) |
| Frequencies | Daily, Weekly (Mon), Monthly (1st), Custom cron expression |

## Data Model

```ts
interface Schedule {
  id: string;
  name: string;                    // user-given label
  cronExpression: string;          // e.g. "0 9 1 * *"
  config: {
    targetUrl: string;
    maxPages: 10 | 50 | 100 | 200;
    maxDepth?: number;
  };
  enabled: boolean;
  createdAt: string;               // ISO
  lastRunAt?: string;              // ISO
  lastScanId?: string;             // links to /reports/{id}.json
  lastRunSummary?: {
    totalIssues: number;
    criticalCount: number;
    errorCount: number;
  };
  nextRunAt?: string;              // computed from cronExpression
  notification: {
    email?: string;
  };
}
```

Stored at `schedules.json` (project root, gitignored).

## Architecture

```
schedules.json (disk)
    ↑↓
lib/schedules.ts          CRUD: load, save, create, update, delete
    ↑
lib/scheduler.ts          node-cron: register/unregister jobs, run scan pipeline
    ↑
instrumentation.ts        Next.js server-start hook — calls initScheduler()
    ↓ (on cron fire)
crawl() [lib/crawler.ts]  existing crawler (re-crawl)
    ↓
runScan() [lib/scanner.ts] existing per-page scanner
    ↓
saveScanReport() [lib/report.ts]  existing disk persistence
    ↓
Resend API                email with summary + report link
```

## New Files

| File | Purpose |
|---|---|
| `lib/schedules.ts` | CRUD for `schedules.json` |
| `lib/scheduler.ts` | node-cron job management + scan execution |
| `instrumentation.ts` | Next.js server-start hook |
| `app/api/schedules/route.ts` | `GET` list, `POST` create |
| `app/api/schedules/[id]/route.ts` | `GET`, `PUT` (update/toggle), `DELETE` |
| `app/api/schedules/[id]/run/route.ts` | `POST` — trigger manual run |
| `app/schedules/page.tsx` | Schedule list UI |
| `app/schedules/new/page.tsx` | Create schedule page |
| `components/ScheduleForm.tsx` | Shared form (name, URL, frequency, maxPages, email) |

## Modified Files

| File | Change |
|---|---|
| `app/page.tsx` | Add "Schedules" nav link |
| `.env.local` | Add `RESEND_API_KEY`, `RESEND_FROM` |
| `README.md` | Document scheduling setup |
| `CHANGELOG.md` | Add v0.2.0 entry |

## New Dependencies

```
node-cron
@types/node-cron
resend
```

## UI

### `/schedules` — List page
- Table rows: name, URL, frequency label, next run, last run (issue count + severity badge), enable toggle, "Run now" button, delete
- Empty state with link to create first schedule

### `/schedules/new` — Create form
Fields:
- **Name** — text, required
- **URL** — text, required, validated
- **Frequency** — radio: Daily / Weekly / Monthly / Custom cron
- **Time** — time picker (shown for Daily/Weekly/Monthly)
- **Max pages** — radio: 10 / 50 / 100 / 200
- **Max depth** — dropdown: unlimited / 1–3
- **Notification email** — optional email field

Frequency → cron mapping:
- Daily → `0 {HH} * * *`
- Weekly → `0 {HH} * * 1`
- Monthly → `0 {HH} 1 * *`
- Custom → raw expression

## Execution Flow (cron fires)

1. `scheduler.ts` receives cron tick for schedule ID
2. Calls `crawl(config.targetUrl, config.maxPages, config.maxDepth)`
3. On crawl success, creates a `ScanJob` via `createJob()`
4. Runs scanner on all discovered URLs, saves report via `saveScanReport()`
5. Updates `schedule.lastRunAt`, `lastScanId`, `lastRunSummary`, `nextRunAt`
6. If `notification.email` set, sends email via Resend

## Email

- **Subject:** `A11y Scan Complete: {name}`
- **Body:** total issues, critical/serious/moderate/minor breakdown, link to `http://localhost:3000/scan/{scanId}`
- **From:** `RESEND_FROM` env var
- **To:** `schedule.notification.email`

## Environment Variables

```env
RESEND_API_KEY=re_...
RESEND_FROM=a11y-scanner@yourdomain.com
```

## Verification

1. `npm install node-cron @types/node-cron resend`
2. Add `RESEND_API_KEY` and `RESEND_FROM` to `.env.local`
3. Navigate to `http://localhost:3000/schedules` — list should be empty
4. Create a schedule with a 1-minute-from-now cron expression
5. Wait for it to fire — check `schedules.json` for `lastRunAt`, check `/reports/` for new report
6. Verify email received (or check Resend dashboard)
7. Disable the schedule — cron should not fire again
8. "Run now" button triggers immediate scan
9. Delete schedule — removed from `schedules.json` and cron unregistered
