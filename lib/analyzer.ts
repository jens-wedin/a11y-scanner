import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import type { RawPageResult, A11yIssue } from "./types";

function getClient(): Anthropic {
  return new Anthropic();
}

function readSkillContent(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "lib", "a11y-qa-skill.md"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

function buildSystemPrompt(skillContent: string): string {
  return `You are an expert accessibility auditor trained in WCAG 2.2 and the European Accessibility Act (EAA).

${skillContent}

Analyze the provided axe-core violations collected from a website scan.
Return a JSON array where each element matches this TypeScript type exactly:

{
  id: string,                    // unique slug identifier
  title: string,                 // concise issue title (max 10 words)
  description: string,           // plain-language explanation for non-technical readers
  wcagCriterion: string,         // e.g. "1.1.1 Non-text Content"
  wcagLevel: "A" | "AA" | "AAA",
  wcagDocUrl: string,            // WCAG Understanding doc URL
  eaaRisk: "high" | "medium" | "low",
  businessImpact: string,        // who is affected and how
  fixComplexity: "low" | "medium" | "high",
  affectedPages: string[],       // all URLs where this violation appears
  occurrenceCount: number,       // total violating nodes across all pages
  severity: "critical" | "serious" | "moderate" | "minor",
  codeExample: string,           // representative HTML snippet from violations
  recommendedFix: string         // corrected HTML code
}

Rules:
- DEDUPLICATE: group the same axe-core violation id across all pages into ONE issue
- affectedPages: list all URLs where that violation appears
- occurrenceCount: sum of nodes across all pages for that violation type
- description: write for a non-technical client stakeholder, no jargon
- businessImpact: be specific (e.g. "Screen reader users cannot identify this button's purpose")
- eaaRisk: "high" if WCAG Level A or AA (legally required under EAA); "low" if AAA or informational
- Sort output by severity: critical -> serious -> moderate -> minor
- Return ONLY a valid JSON array. No markdown fences, no explanation text.`;
}

function createFallbackIssues(pageResults: RawPageResult[]): A11yIssue[] {
  const grouped = new Map<
    string,
    {
      violation: RawPageResult["violations"][0];
      pages: string[];
      count: number;
    }
  >();

  for (const page of pageResults) {
    for (const v of page.violations) {
      const existing = grouped.get(v.id);
      if (existing) {
        if (!existing.pages.includes(page.url)) existing.pages.push(page.url);
        existing.count += v.nodes.length;
      } else {
        grouped.set(v.id, {
          violation: v,
          pages: [page.url],
          count: v.nodes.length,
        });
      }
    }
  }

  return Array.from(grouped.values()).map(({ violation, pages, count }) => ({
    id: violation.id,
    title: violation.help,
    description: violation.description,
    wcagCriterion: "See axe-core helpUrl",
    wcagLevel: "AA" as const,
    wcagDocUrl: violation.helpUrl,
    eaaRisk: (
      violation.impact === "critical" || violation.impact === "serious"
        ? "high"
        : "medium"
    ) as "high" | "medium" | "low",
    businessImpact:
      "Affects users with disabilities — see axe-core details for specifics",
    fixComplexity: "medium" as const,
    affectedPages: pages,
    occurrenceCount: count,
    severity: (violation.impact ?? "moderate") as A11yIssue["severity"],
    codeExample: violation.nodes[0]?.html ?? "",
    recommendedFix:
      violation.nodes[0]?.failureSummary ?? "See helpUrl for fix guidance",
  }));
}

export async function analyzeViolations(
  pageResults: RawPageResult[],
  targetUrl: string
): Promise<A11yIssue[]> {
  const skillContent = readSkillContent();
  const domain = new URL(targetUrl).hostname;

  const systemPrompt = buildSystemPrompt(skillContent);
  const userMessage = `Analyze these axe-core violations from ${pageResults.length} pages of ${domain}:\n\n${JSON.stringify(pageResults, null, 2)}`;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    // Strip markdown code fences if present
    const text = content.text
      .replace(/^```json\n?|^```\n?|\n?```$/gm, "")
      .trim();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Response is not an array");

    return parsed as A11yIssue[];
  } catch {
    return createFallbackIssues(pageResults);
  }
}
