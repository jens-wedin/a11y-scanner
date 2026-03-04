// Scan configuration provided by the user
export interface ScanConfig {
  targetUrl: string;
  maxPages: number; // 10 | 50 | 100 | 200
  maxDepth?: number;
  selectedUrls?: string[]; // user-selected subset after preview
}

// A URL discovered during crawl phase
export interface CrawledUrl {
  url: string;
  title?: string;
  depth: number;
}

// Raw violation node from axe-core
export interface RawViolationNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

// Raw violation from axe-core (per violation type per page)
export interface RawViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor" | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: RawViolationNode[];
}

// Raw scan result per page
export interface RawPageResult {
  url: string;
  violations: RawViolation[];
  scannedAt: string;
  error?: string;
}

// Claude-analyzed, deduplicated accessibility issue
export interface A11yIssue {
  id: string;
  title: string;
  description: string; // plain language
  wcagCriterion: string; // e.g. "1.1.1 Non-text Content"
  wcagLevel: "A" | "AA" | "AAA";
  wcagDocUrl: string;
  eaaRisk: "high" | "medium" | "low";
  businessImpact: string;
  fixComplexity: "low" | "medium" | "high";
  affectedPages: string[];
  occurrenceCount: number;
  severity: "critical" | "serious" | "moderate" | "minor";
  codeExample: string; // representative HTML snippet
  recommendedFix: string; // corrected code example
}

// Final report persisted to /reports/[scanId].json
export interface ScanReport {
  scanId: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  pagesScanned: number;
  issues: A11yIssue[];
  analysisFailed?: boolean; // true if Claude fallback was used
  summary: {
    totalIssues: number;
    byLevel: { A: number; AA: number; AAA: number };
    bySeverity: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
    eaaHighRisk: number;
  };
}

// In-memory scan job
export interface ScanJob {
  id: string;
  status: "pending" | "crawling" | "scanning" | "analyzing" | "done" | "error";
  config: ScanConfig;
  startedAt: string;
  progress: {
    currentUrl?: string;
    scannedCount: number;
    totalCount: number;
  };
  crawledUrls?: CrawledUrl[];
  report?: ScanReport;
  error?: string;
}

// SSE events streamed to client
export type ScanEvent =
  | { type: "crawl-complete"; urls: CrawledUrl[] }
  | {
      type: "scan-progress";
      url: string;
      violations: number;
      scannedCount: number;
      totalCount: number;
    }
  | { type: "analysis-start" }
  | { type: "analysis-complete"; report: ScanReport }
  | { type: "error"; message: string };

// Filter state for the report UI
export interface ReportFilters {
  severity: string; // "all" | "critical" | "serious" | "moderate" | "minor"
  wcagLevel: string; // "all" | "A" | "AA" | "AAA"
  eaaRisk: string; // "all" | "high" | "medium" | "low"
  fixComplexity: string; // "all" | "low" | "medium" | "high"
  search: string;
}
