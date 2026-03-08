"use client";

import type { ReportFilters } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <Select value={filters.severity} onValueChange={(v) => v !== null && set("severity", v)}>
          <SelectTrigger className="w-auto" aria-label="Severity">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {["critical", "serious", "moderate", "minor"].map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.wcagLevel} onValueChange={(v) => v !== null && set("wcagLevel", v)}>
          <SelectTrigger className="w-auto" aria-label="WCAG level">
            <SelectValue placeholder="All WCAG levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All WCAG levels</SelectItem>
            {["A", "AA", "AAA"].map((l) => (
              <SelectItem key={l} value={l}>
                Level {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.eaaRisk} onValueChange={(v) => v !== null && set("eaaRisk", v)}>
          <SelectTrigger className="w-auto" aria-label="EAA risk">
            <SelectValue placeholder="All EAA risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All EAA risk</SelectItem>
            {["high", "medium", "low"].map((r) => (
              <SelectItem key={r} value={r}>
                EAA {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.fixComplexity} onValueChange={(v) => v !== null && set("fixComplexity", v)}>
          <SelectTrigger className="w-auto" aria-label="Fix effort">
            <SelectValue placeholder="All fix efforts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fix efforts</SelectItem>
            {["low", "medium", "high"].map((c) => (
              <SelectItem key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)} effort
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1 min-w-40">
          <label htmlFor="filter-search" className="sr-only">
            Search issues
          </label>
          <Input
            id="filter-search"
            type="search"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search issues…"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500" aria-live="polite" aria-atomic="true">
        Showing {filtered} of {total} issues
      </p>
    </div>
  );
}
