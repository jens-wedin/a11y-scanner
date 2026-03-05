import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ScanReport, A11yIssue } from "./types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 20, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: "#666666", marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  statRow: { flexDirection: "row", marginBottom: 4, gap: 16 },
  stat: { fontSize: 10 },
  issueCard: {
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 4,
  },
  issueTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  badgeRow: { flexDirection: "row", marginBottom: 4, gap: 4 },
  badge: { fontSize: 8, padding: 2 },
  label: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  row: { flexDirection: "row", marginBottom: 2 },
});

const SEVERITY_COLORS: Record<A11yIssue["severity"], string> = {
  critical: "#dc2626",
  serious: "#ea580c",
  moderate: "#d97706",
  minor: "#2563eb",
};

function IssueRow({ issue }: { issue: A11yIssue }) {
  return (
    <View style={styles.issueCard} wrap={false}>
      <Text style={styles.issueTitle}>{issue.title}</Text>
      <View style={styles.badgeRow}>
        <Text
          style={[styles.badge, { color: SEVERITY_COLORS[issue.severity] }]}
        >
          {issue.severity.toUpperCase()}
        </Text>
        <Text style={styles.badge}>WCAG {issue.wcagLevel}</Text>
        {issue.eaaRisk === "high" && (
          <Text style={[styles.badge, { color: "#dc2626" }]}>EAA Risk</Text>
        )}
      </View>
      <Text style={{ marginBottom: 2 }}>{issue.description}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>WCAG:</Text>
        <Text>{issue.wcagCriterion}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Impact:</Text>
        <Text>{issue.businessImpact}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Pages affected:</Text>
        <Text>
          {issue.affectedPages.length} ({issue.occurrenceCount} occurrences)
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Fix effort:</Text>
        <Text>{issue.fixComplexity}</Text>
      </View>
    </View>
  );
}

function ReportDocument({ report }: { report: ScanReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Accessibility Report</Text>
        <Text style={styles.subtitle}>
          {report.targetUrl} &bull;{" "}
          {new Date(report.completedAt).toLocaleDateString()} &bull;{" "}
          {report.pagesScanned} pages scanned
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statRow}>
            <Text style={styles.stat}>
              Total issues: {report.summary.totalIssues}
            </Text>
            <Text style={styles.stat}>
              Critical: {report.summary.bySeverity.critical}
            </Text>
            <Text style={styles.stat}>
              Serious: {report.summary.bySeverity.serious}
            </Text>
            <Text style={styles.stat}>
              EAA high risk: {report.summary.eaaHighRisk}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Issues</Text>
          {report.issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderPDF(report: ScanReport): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />);
}
