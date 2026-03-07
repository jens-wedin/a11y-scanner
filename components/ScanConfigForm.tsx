"use client";

import { useState } from "react";
import type { ScanConfig } from "@/lib/types";

interface Props {
  onSubmit: (config: ScanConfig) => void;
  loading?: boolean;
}

const MAX_PAGES_OPTIONS = [10, 50, 100, 200];
const DEPTH_OPTIONS = [
  { label: "Unlimited", value: undefined },
  { label: "1 level deep", value: 1 },
  { label: "2 levels deep", value: 2 },
  { label: "3 levels deep", value: 3 },
];

export function ScanConfigForm({ onSubmit, loading }: Props) {
  const [targetUrl, setTargetUrl] = useState("");
  const [maxPages, setMaxPages] = useState(50);
  const [maxDepth, setMaxDepth] = useState<number | undefined>(undefined);
  const [urlError, setUrlError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlError("");

    try {
      const parsed = new URL(targetUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setUrlError("URL must start with http:// or https://");
        return;
      }
    } catch {
      setUrlError("Please enter a valid URL");
      return;
    }

    onSubmit({ targetUrl: targetUrl.trim(), maxPages, maxDepth });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Scan configuration">
      <div>
        <label htmlFor="targetUrl" className="block text-sm font-medium text-gray-700 mb-1">
          Website URL
        </label>
        <input
          id="targetUrl"
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-describedby={urlError ? "url-error" : undefined}
          aria-invalid={urlError ? true : undefined}
        />
        {urlError && (
          <p id="url-error" role="alert" className="mt-1 text-sm text-red-600">
            {urlError}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          Max pages to scan
        </legend>
        <div className="flex gap-3">
          {MAX_PAGES_OPTIONS.map((n) => (
            <label key={n} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="maxPages"
                value={n}
                checked={maxPages === n}
                onChange={() => setMaxPages(n)}
                className="accent-indigo-600"
              />
              <span className="text-sm">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-1">
          Crawl depth
        </label>
        <select
          id="maxDepth"
          value={maxDepth ?? ""}
          onChange={(e) =>
            setMaxDepth(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {DEPTH_OPTIONS.map(({ label, value }) => (
            <option key={label} value={value ?? ""}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-busy={loading}
      >
        {loading ? "Discovering URLs\u2026" : "Discover URLs \u2192"}
      </button>
    </form>
  );
}
