"use client";

import { useState } from "react";
import type { A11yIssue, ReportFilters } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  issue: A11yIssue;
  onFilter?: (update: Partial<ReportFilters>) => void;
}

const SEVERITY_STYLES: Record<A11yIssue["severity"], string> = {
  critical: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/30",
  serious: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 dark:hover:bg-orange-900/30",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800 dark:hover:bg-yellow-900/30",
  minor: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/30",
};

const EAA_STYLES: Record<A11yIssue["eaaRisk"], string> = {
  high: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/30",
  medium: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900 dark:hover:bg-amber-950/30",
  low: "bg-muted text-muted-foreground border-border hover:bg-muted",
};

export function IssueCard({ issue, onFilter }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cardId = `issue-${issue.id}`;
  const detailsId = `${cardId}-details`;

  return (
    <article aria-labelledby={cardId} className="border border-border rounded-xl overflow-hidden">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4 space-y-3">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => onFilter?.({ severity: issue.severity })}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              aria-label={`Filter by severity: ${issue.severity}`}
            >
              <Badge variant="outline" className={SEVERITY_STYLES[issue.severity]}>
                {issue.severity.toUpperCase()}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => onFilter?.({ wcagLevel: issue.wcagLevel })}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              aria-label={`Filter by WCAG level: ${issue.wcagLevel}`}
            >
              <Badge variant="outline" className="text-muted-foreground">
                WCAG {issue.wcagLevel}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => onFilter?.({ eaaRisk: issue.eaaRisk })}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              aria-label={`Filter by EAA risk: ${issue.eaaRisk}`}
            >
              <Badge variant="outline" className={EAA_STYLES[issue.eaaRisk]}>
                EAA {issue.eaaRisk} risk
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => onFilter?.({ fixComplexity: issue.fixComplexity })}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              aria-label={`Filter by fix effort: ${issue.fixComplexity}`}
            >
              <Badge variant="outline" className="text-muted-foreground">
                {issue.fixComplexity} effort
              </Badge>
            </button>
          </div>

          {/* Title + description */}
          <div>
            <h3 id={cardId} className="text-base font-semibold text-foreground">
              {issue.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
          </div>

          {/* Meta */}
          <dl className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {(issue.wcagCriterion || issue.wcagDocUrl) && (
              <div>
                <dt className="inline font-medium text-foreground">WCAG: </dt>
                <dd className="inline">
                  {issue.wcagCriterion}
                  {issue.wcagDocUrl && (
                    <>
                      {" "}
                      <a
                        href={issue.wcagDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        aria-label={`WCAG documentation${issue.wcagCriterion ? ` for ${issue.wcagCriterion}` : ""} (opens in new tab)`}
                      >
                        ↗
                      </a>
                    </>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium text-foreground">Impact: </dt>
              <dd className="inline">{issue.businessImpact}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Pages: </dt>
              <dd className="inline">
                {issue.affectedPages.length} ({issue.occurrenceCount} occurrences)
              </dd>
            </div>
          </dl>

          {/* Toggle */}
          <CollapsibleTrigger
            className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-sm text-indigo-600 dark:text-indigo-400")}
            aria-controls={detailsId}
          >
            {expanded ? "Hide details ↑" : "View details ↓"}
          </CollapsibleTrigger>
        </div>

        {/* Expanded details */}
        <CollapsibleContent>
          <div
            id={detailsId}
            className="border-t border-border bg-muted p-4 space-y-4"
          >
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">
                Code violation
              </h4>
              <pre className="text-xs text-foreground bg-red-50 border border-red-100 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words dark:bg-red-950/20 dark:border-red-900">
                <code>{issue.codeExample}</code>
              </pre>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">
                Recommended fix
              </h4>
              <pre className="text-xs text-foreground bg-green-50 border border-green-100 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words dark:bg-green-950/20 dark:border-green-900">
                <code>{issue.recommendedFix}</code>
              </pre>
            </div>
            {issue.affectedPages.length > 1 && (
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">
                  Affected pages
                </h4>
                <ul
                  className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto"
                  aria-label="Affected pages"
                >
                  {issue.affectedPages.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
