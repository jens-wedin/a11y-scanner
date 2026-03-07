"use client";

import { useState } from "react";
import type { A11yIssue } from "@/lib/types";

interface Props {
  issue: A11yIssue;
}

const SEVERITY_STYLES: Record<A11yIssue["severity"], string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  serious: "bg-orange-100 text-orange-800 border-orange-200",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  minor: "bg-blue-100 text-blue-800 border-blue-200",
};

const EAA_STYLES: Record<A11yIssue["eaaRisk"], string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-50 text-gray-600 border-gray-200",
};

export function IssueCard({ issue }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cardId = `issue-${issue.id}`;
  const detailsId = `${cardId}-details`;

  return (
    <article aria-labelledby={cardId} className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${SEVERITY_STYLES[issue.severity]}`}>
            {issue.severity.toUpperCase()}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium border border-gray-200 text-gray-600">
            WCAG {issue.wcagLevel}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${EAA_STYLES[issue.eaaRisk]}`}>
            EAA {issue.eaaRisk} risk
          </span>
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium border border-gray-200 text-gray-600">
            {issue.fixComplexity} effort
          </span>
        </div>

        {/* Title + description */}
        <div>
          <h3 id={cardId} className="text-base font-semibold text-gray-900">
            {issue.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
        </div>

        {/* Meta */}
        <dl className="flex flex-wrap gap-4 text-sm text-gray-500">
          <div>
            <dt className="inline font-medium text-gray-700">WCAG: </dt>
            <dd className="inline">
              <a
                href={issue.wcagDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
                aria-label={`WCAG criterion ${issue.wcagCriterion} (opens in new tab)`}
              >
                {issue.wcagCriterion}
              </a>
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-gray-700">Impact: </dt>
            <dd className="inline">{issue.businessImpact}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-gray-700">Pages: </dt>
            <dd className="inline">
              {issue.affectedPages.length} ({issue.occurrenceCount} occurrences)
            </dd>
          </div>
        </dl>

        {/* Toggle */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((p) => !p)}
          className="text-sm text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          {expanded ? "Hide details \u2191" : "View details \u2193"}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          id={detailsId}
          className="border-t border-gray-200 bg-gray-50 p-4 space-y-4"
        >
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
              Code violation
            </h4>
            <pre className="text-xs text-gray-900 bg-red-50 border border-red-100 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
              <code>{issue.codeExample}</code>
            </pre>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
              Recommended fix
            </h4>
            <pre className="text-xs text-gray-900 bg-green-50 border border-green-100 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
              <code>{issue.recommendedFix}</code>
            </pre>
          </div>
          {issue.affectedPages.length > 1 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Affected pages
              </h4>
              <ul
                className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto"
                aria-label="Affected pages"
              >
                {issue.affectedPages.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline truncate block"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
