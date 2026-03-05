"use client";

import type { ReportFilters } from "@/lib/types";

interface Props {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  total: number;
  filtered: number;
}

export function FilterBar({ filters, onChange, total, filtered }: Props) {
  function set(key: keyof ReportFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3" role="search" aria-label="Filter issues">
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="filter-severity" className="sr-only">
            Severity
          </label>
          <select
            id="filter-severity"
            value={filters.severity}
            onChange={(e) => set("severity", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All severities</option>
            {["critical", "serious", "moderate", "minor"].map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-wcag" className="sr-only">
            WCAG level
          </label>
          <select
            id="filter-wcag"
            value={filters.wcagLevel}
            onChange={(e) => set("wcagLevel", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All WCAG levels</option>
            {["A", "AA", "AAA"].map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-eaa" className="sr-only">
            EAA risk
          </label>
          <select
            id="filter-eaa"
            value={filters.eaaRisk}
            onChange={(e) => set("eaaRisk", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All EAA risk</option>
            {["high", "medium", "low"].map((r) => (
              <option key={r} value={r}>
                EAA {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-effort" className="sr-only">
            Fix effort
          </label>
          <select
            id="filter-effort"
            value={filters.fixComplexity}
            onChange={(e) => set("fixComplexity", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All fix efforts</option>
            {["low", "medium", "high"].map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)} effort
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-40">
          <label htmlFor="filter-search" className="sr-only">
            Search issues
          </label>
          <input
            id="filter-search"
            type="search"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search issues\u2026"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500" aria-live="polite" aria-atomic="true">
        Showing {filtered} of {total} issues
      </p>
    </div>
  );
}
