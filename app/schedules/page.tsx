"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Schedule } from "@/lib/types";

function frequencyLabel(cronExpr: string): string {
  if (/^0 \d+ \* \* \*$/.test(cronExpr)) return "Daily";
  if (/^0 \d+ \* \* 1$/.test(cronExpr)) return "Weekly (Mon)";
  if (/^0 \d+ 1 \* \*$/.test(cronExpr)) return "Monthly";
  return cronExpr;
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
    alert("Scan started! Check back in a few minutes.");
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
            <Link href="/" className="text-sm text-indigo-600 hover:underline">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Schedules</h1>
            <p className="text-sm text-gray-500">Recurring accessibility scans</p>
          </div>
          <Link
            href="/schedules/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New schedule
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : schedules.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500 mb-4">No schedules yet.</p>
            <Link href="/schedules/new" className="text-indigo-600 underline text-sm">
              Create your first schedule →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Frequency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last run</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Enabled</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-gray-400 text-xs truncate max-w-xs">
                        {s.config.targetUrl}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {frequencyLabel(s.cronExpression)}
                    </td>
                    <td className="px-4 py-3">
                      {s.lastRunAt ? (
                        <div>
                          <p className="text-gray-600">
                            {new Date(s.lastRunAt).toLocaleDateString()}
                          </p>
                          {s.lastRunSummary && (
                            <p className="text-xs mt-0.5">
                              <span className="text-gray-500">
                                {s.lastRunSummary.totalIssues} issues
                              </span>
                              {s.lastRunSummary.criticalCount > 0 && (
                                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-medium">
                                  {s.lastRunSummary.criticalCount} critical
                                </span>
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
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEnabled(s)}
                        aria-label={s.enabled ? "Disable schedule" : "Enable schedule"}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          s.enabled ? "bg-indigo-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            s.enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => runNow(s.id)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Run now
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="text-xs text-red-500 hover:underline"
                          aria-label={`Delete schedule ${s.name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
