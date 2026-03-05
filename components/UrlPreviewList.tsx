"use client";

import { useState } from "react";
import type { CrawledUrl } from "@/lib/types";

interface Props {
  urls: CrawledUrl[];
  onStart: (selectedUrls: string[]) => void;
  loading?: boolean;
}

export function UrlPreviewList({ urls, onStart, loading }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(urls.map((u) => u.url))
  );

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === urls.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(urls.map((u) => u.url)));
    }
  }

  const allSelected = selected.size === urls.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong>{selected.size}</strong> of <strong>{urls.length}</strong> pages selected
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <ul
        className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100"
        aria-label="Discovered URLs"
      >
        {urls.map((crawledUrl) => (
          <li key={crawledUrl.url}>
            <label className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(crawledUrl.url)}
                onChange={() => toggle(crawledUrl.url)}
                className="mt-0.5 accent-indigo-600 flex-shrink-0"
                aria-label={`Include ${crawledUrl.url}`}
              />
              <span className="min-w-0">
                <span className="block text-sm text-gray-900 truncate">{crawledUrl.url}</span>
                {crawledUrl.title && (
                  <span className="text-xs text-gray-500">{crawledUrl.title}</span>
                )}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                depth {crawledUrl.depth}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onStart(Array.from(selected))}
        disabled={loading || selected.size === 0}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-busy={loading}
      >
        {loading ? "Starting scan\u2026" : `Scan ${selected.size} pages \u2192`}
      </button>
    </div>
  );
}
