"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { ReportSummary } from "@/components/ReportSummary";
import { FilterBar } from "@/components/FilterBar";
import { IssueCard } from "@/components/IssueCard";
import type { ScanReport, ReportFilters } from "@/lib/types";

const DEFAULT_FILTERS: ReportFilters = {
  severity: "all",
  wcagLevel: "all",
  eaaRisk: "all",
  fixComplexity: "all",
  search: "",
};

export default function ReportPage() {
  const params = useParams<{ scanId: string }>();
  const scanId = params.scanId;
  const [report, setReport] = useState<ScanReport | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/scan/${scanId}/report`)
      .then((r) => {
        if (!r.ok) throw new Error("Report not found");
        return r.json();
      })
      .then((data: ScanReport) => setReport(data))
      .catch((err: Error) => setError(err.message));
  }, [scanId]);

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    return report.issues.filter((issue) => {
      if (filters.severity !== "all" && issue.severity !== filters.severity)
        return false;
      if (filters.wcagLevel !== "all" && issue.wcagLevel !== filters.wcagLevel)
        return false;
      if (filters.eaaRisk !== "all" && issue.eaaRisk !== filters.eaaRisk)
        return false;
      if (
        filters.fixComplexity !== "all" &&
        issue.fixComplexity !== filters.fixComplexity
      )
        return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return (
          issue.title.toLowerCase().includes(q) ||
          issue.description.toLowerCase().includes(q) ||
          issue.wcagCriterion.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [report, filters]);

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div
          role="alert"
          className="bg-white rounded-2xl border border-red-200 p-8 text-red-700 max-w-md text-center"
        >
          <p className="font-semibold mb-2">Report not available</p>
          <p className="text-sm">{error}</p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
          >
            ← Start a new scan
          </a>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-gray-500">Loading report…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a
              href="/"
              className="text-xs text-indigo-600 hover:underline mb-2 inline-block"
              aria-label="Start a new scan"
            >
              ← New scan
            </a>
            <h1 className="text-2xl font-bold text-gray-900">
              Accessibility Report
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {report.targetUrl} ·{" "}
              {new Date(report.completedAt).toLocaleDateString("en-GB", {
                dateStyle: "long",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/scan/${scanId}/export/json`}
              download
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              Export JSON
            </a>
            <a
              href={`/api/scan/${scanId}/export/pdf`}
              download
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              Export PDF
            </a>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <ReportSummary report={report} />
        </div>

        {/* Filter + issue list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            total={report.issues.length}
            filtered={filteredIssues.length}
          />

          {filteredIssues.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No issues match the current filters.
            </p>
          ) : (
            <ul className="space-y-3" aria-label="Accessibility issues">
              {filteredIssues.map((issue) => (
                <li key={issue.id}>
                  <IssueCard issue={issue} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
