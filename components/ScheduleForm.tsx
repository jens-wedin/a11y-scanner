"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <Input
          id="sched-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monthly audit"
        />
      </div>

      <div>
        <label htmlFor="sched-url" className="block text-sm font-medium text-gray-700 mb-1">
          URL to scan <span aria-hidden="true">*</span>
        </label>
        <Input
          id="sched-url"
          type="url"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      {/* Frequency — keeps sr-only native radio pattern for reliable accessible card-buttons */}
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
          <Input
            id="sched-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-auto"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="sched-cron" className="block text-sm font-medium text-gray-700 mb-1">
            Cron expression
          </label>
          <Input
            id="sched-cron"
            required={frequency === "custom"}
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 9 * * 1"
            className="font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">minute hour day month weekday</p>
        </div>
      )}

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Max pages</legend>
        <RadioGroup
          value={String(maxPages)}
          onValueChange={(v) => setMaxPages(Number(v) as 10 | 50 | 100 | 200)}
          className="flex gap-4"
        >
          {([10, 50, 100, 200] as const).map((n) => (
            <div key={n} className="flex items-center gap-1.5">
              <RadioGroupItem value={String(n)} id={`sched-maxPages-${n}`} />
              <label
                htmlFor={`sched-maxPages-${n}`}
                className="text-sm text-gray-700 cursor-pointer"
              >
                {n}
              </label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div>
        <label htmlFor="sched-depth" className="block text-sm font-medium text-gray-700 mb-1">
          Max crawl depth
        </label>
        <Select value={maxDepth} onValueChange={(v) => v !== null && setMaxDepth(v)}>
          <SelectTrigger id="sched-depth" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unlimited">Unlimited</SelectItem>
            <SelectItem value="1">1 level</SelectItem>
            <SelectItem value="2">2 levels</SelectItem>
            <SelectItem value="3">3 levels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="sched-email" className="block text-sm font-medium text-gray-700 mb-1">
          Notification email{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <Input
          id="sched-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full"
      >
        {loading ? "Creating…" : "Create schedule"}
      </Button>
    </form>
  );
}
