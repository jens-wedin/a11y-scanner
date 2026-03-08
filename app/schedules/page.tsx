"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Schedule } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function frequencyLabel(cronExpr: string): string {
  if (/^0 \d+ \* \* \*$/.test(cronExpr)) return "Daily";
  if (/^0 \d+ \* \* 1$/.test(cronExpr)) return "Weekly (Mon)";
  if (/^0 \d+ 1 \* \*$/.test(cronExpr)) return "Monthly";
  return cronExpr;
}

function Spinner() {
  return (
    <svg
      className="inline-block h-4 w-4 animate-spin text-indigo-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSchedules() {
    const res = await fetch("/api/schedules");
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchSchedules();
  }, []);

  // Poll every 3 s while any schedule is running
  useEffect(() => {
    const anyRunning = schedules.some((s) => s.runningAt);
    if (!anyRunning) return;
    const id = setInterval(fetchSchedules, 3000);
    return () => clearInterval(id);
  }, [schedules]);

  async function toggleEnabled(s: Schedule) {
    await fetch(`/api/schedules/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    fetchSchedules();
  }

  async function runNow(id: string) {
    await fetch(`/api/schedules/${id}/run`, { method: "POST" });
    fetchSchedules();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete schedule "${name}"?`)) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    fetchSchedules();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-sm")}>
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Schedules</h1>
            <p className="text-sm text-gray-500">Recurring accessibility scans</p>
          </div>
          <Link href="/schedules/new" className={buttonVariants()}>
            New schedule
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : schedules.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500 mb-4">No schedules yet.</p>
            <Link href="/schedules/new" className={cn(buttonVariants({ variant: "link" }), "text-sm")}>
              Create your first schedule →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id} className={s.runningAt ? "bg-indigo-50/40" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.runningAt && <Spinner />}
                        <div>
                          <p className="font-medium text-gray-900">{s.name}</p>
                          <p className="text-gray-400 text-xs truncate max-w-xs">
                            {s.config.targetUrl}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {frequencyLabel(s.cronExpression)}
                    </TableCell>
                    <TableCell>
                      {s.runningAt ? (
                        <span className="inline-flex items-center gap-1.5 text-indigo-600 text-xs font-medium">
                          <Spinner />
                          Running…
                        </span>
                      ) : s.lastRunAt ? (
                        <div>
                          <p className="text-gray-600">
                            {new Date(s.lastRunAt).toLocaleDateString()}
                          </p>
                          {s.lastRunSummary && (
                            <p className="text-xs mt-0.5 flex items-center gap-1">
                              <span className="text-gray-500">
                                {s.lastRunSummary.totalIssues} issues
                              </span>
                              {s.lastRunSummary.criticalCount > 0 && (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">
                                  {s.lastRunSummary.criticalCount} critical
                                </Badge>
                              )}
                            </p>
                          )}
                          {s.lastScanId && (
                            <Link
                              href={`/scan/${s.lastScanId}`}
                              className="text-xs text-indigo-600 underline"
                            >
                              View report
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={() => toggleEnabled(s)}
                        aria-label={s.enabled ? "Disable schedule" : "Enable schedule"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runNow(s.id)}
                          disabled={!!s.runningAt}
                        >
                          {s.runningAt ? <Spinner /> : "Run now"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(s.id, s.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          aria-label={`Delete schedule ${s.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}
