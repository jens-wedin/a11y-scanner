import type { ScanReport } from "@/lib/types";

interface Props {
  report: ScanReport;
}

const SEVERITY_COLORS = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  serious: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  minor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export function ReportSummary({ report }: Props) {
  const { summary } = report;
  return (
    <section aria-label="Report summary" className="space-y-4">
      {report.analysisFailed && (
        <div
          role="alert"
          className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400"
        >
          AI analysis failed — showing raw axe-core findings. Results may
          contain technical language.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["critical", "serious", "moderate", "minor"] as const).map((sev) => (
          <div key={sev} className={`rounded-xl p-4 ${SEVERITY_COLORS[sev]}`}>
            <p className="text-2xl font-bold">{summary.bySeverity[sev]}</p>
            <p className="text-xs font-medium capitalize">{sev}</p>
          </div>
        ))}
      </div>

      <dl className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div>
          <dt className="inline font-medium text-foreground">Pages scanned: </dt>
          <dd className="inline">{report.pagesScanned}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Unique issues: </dt>
          <dd className="inline">{summary.totalIssues}</dd>
        </div>
        <div className="text-red-700 dark:text-red-400">
          <dt className="inline font-medium">EAA high risk: </dt>
          <dd className="inline font-semibold">{summary.eaaHighRisk}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">By WCAG level: </dt>
          <dd className="inline">
            A: {summary.byLevel.A} · AA: {summary.byLevel.AA} · AAA: {summary.byLevel.AAA}
          </dd>
        </div>
      </dl>
    </section>
  );
}
