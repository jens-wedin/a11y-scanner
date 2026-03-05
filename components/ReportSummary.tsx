import type { ScanReport } from "@/lib/types";

interface Props {
  report: ScanReport;
}

const SEVERITY_COLORS = {
  critical: "bg-red-100 text-red-800",
  serious: "bg-orange-100 text-orange-800",
  moderate: "bg-yellow-100 text-yellow-800",
  minor: "bg-blue-100 text-blue-800",
};

export function ReportSummary({ report }: Props) {
  const { summary } = report;
  return (
    <section aria-label="Report summary" className="space-y-4">
      {report.analysisFailed && (
        <div
          role="alert"
          className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"
        >
          AI analysis failed \u2014 showing raw axe-core findings. Results may
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

      <dl className="flex flex-wrap gap-4 text-sm text-gray-600">
        <div>
          <dt className="inline font-medium text-gray-700">Pages scanned: </dt>
          <dd className="inline">{report.pagesScanned}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-gray-700">Unique issues: </dt>
          <dd className="inline">{summary.totalIssues}</dd>
        </div>
        <div className="text-red-700">
          <dt className="inline font-medium">EAA high risk: </dt>
          <dd className="inline font-semibold">{summary.eaaHighRisk}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-gray-700">By WCAG level: </dt>
          <dd className="inline">
            A: {summary.byLevel.A} \u00b7 AA: {summary.byLevel.AA} \u00b7 AAA: {summary.byLevel.AAA}
          </dd>
        </div>
      </dl>
    </section>
  );
}
