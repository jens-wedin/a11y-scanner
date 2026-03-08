"use client";

import { useState } from "react";

type Frequency = "daily" | "weekly" | "monthly" | "custom";

function buildCron(frequency: Frequency, time: string, customExpr: string): string {
  const [hh, mm] = time.split(":").map(Number);
  const h = isNaN(hh) ? 9 : hh;
  const m = isNaN(mm) ? 0 : mm;
  if (frequency === "daily") return `${m} ${h} * * *`;
  if (frequency === "weekly") return `${m} ${h} * * 1`;
  if (frequency === "monthly") return `${m} ${h} 1 * *`;
  return customExpr;
}

export interface ScheduleFormData {
  name: string;
  cronExpression: string;
  config: { targetUrl: string; maxPages: 10 | 50 | 100 | 200; maxDepth?: number };
  notification: { email?: string };
}

interface ScheduleFormProps {
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  loading: boolean;
  error: string;
}

export function ScheduleForm({ onSubmit, loading, error }: ScheduleFormProps) {
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [time, setTime] = useState("09:00");
  const [customCron, setCustomCron] = useState("");
  const [maxPages, setMaxPages] = useState<10 | 50 | 100 | 200>(50);
  const [maxDepth, setMaxDepth] = useState<string>("unlimited");
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cronExpression = buildCron(frequency, time, customCron);
    await onSubmit({
      name,
      cronExpression,
      config: {
        targetUrl,
        maxPages,
        maxDepth: maxDepth === "unlimited" ? undefined : Number(maxDepth),
      },
      notification: { email: email || undefined },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="sched-name" className="block text-sm font-medium text-gray-700 mb-1">
          Schedule name <span aria-hidden="true">*</span>
        </label>
        <input
          id="sched-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monthly audit"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="sched-url" className="block text-sm font-medium text-gray-700 mb-1">
          URL to scan <span aria-hidden="true">*</span>
        </label>
        <input
          id="sched-url"
          type="url"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Frequency</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["daily", "weekly", "monthly", "custom"] as Frequency[]).map((f) => (
            <label
              key={f}
              className={`flex items-center justify-center rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                frequency === f
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={f}
                checked={frequency === f}
                onChange={() => setFrequency(f)}
                className="sr-only"
              />
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

      {frequency !== "custom" ? (
        <div>
          <label htmlFor="sched-time" className="block text-sm font-medium text-gray-700 mb-1">
            Run at
          </label>
          <input
            id="sched-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="sched-cron" className="block text-sm font-medium text-gray-700 mb-1">
            Cron expression
          </label>
          <input
            id="sched-cron"
            required={frequency === "custom"}
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 9 * * 1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-400">minute hour day month weekday</p>
        </div>
      )}

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Max pages</legend>
        <div className="flex gap-4">
          {([10, 50, 100, 200] as const).map((n) => (
            <label
              key={n}
              className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="radio"
                name="maxPages"
                value={n}
                checked={maxPages === n}
                onChange={() => setMaxPages(n)}
                className="accent-indigo-600"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="sched-depth" className="block text-sm font-medium text-gray-700 mb-1">
          Max crawl depth
        </label>
        <select
          id="sched-depth"
          value={maxDepth}
          onChange={(e) => setMaxDepth(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="unlimited">Unlimited</option>
          <option value="1">1 level</option>
          <option value="2">2 levels</option>
          <option value="3">3 levels</option>
        </select>
      </div>

      <div>
        <label htmlFor="sched-email" className="block text-sm font-medium text-gray-700 mb-1">
          Notification email{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="sched-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Creating…" : "Create schedule"}
      </button>
    </form>
  );
}
