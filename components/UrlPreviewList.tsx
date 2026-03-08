"use client";

import { useState } from "react";
import type { CrawledUrl } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{selected.size}</strong> of <strong className="text-foreground">{urls.length}</strong> pages selected
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={toggleAll}
          className="p-0 h-auto text-sm"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>

      <ul
        className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border"
        aria-label="Discovered URLs"
      >
        {urls.map((crawledUrl) => {
          const checkId = `url-${encodeURIComponent(crawledUrl.url)}`;
          return (
            <li key={crawledUrl.url}>
              <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted">
                <Checkbox
                  id={checkId}
                  checked={selected.has(crawledUrl.url)}
                  onCheckedChange={() => toggle(crawledUrl.url)}
                  className="mt-0.5 flex-shrink-0"
                  aria-label={`Include ${crawledUrl.url}`}
                />
                <label htmlFor={checkId} className="min-w-0 cursor-pointer flex-1">
                  <span className="block text-sm text-foreground truncate">{crawledUrl.url}</span>
                  {crawledUrl.title && (
                    <span className="text-xs text-muted-foreground">{crawledUrl.title}</span>
                  )}
                </label>
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  depth {crawledUrl.depth}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        onClick={() => onStart(Array.from(selected))}
        disabled={loading || selected.size === 0}
        aria-busy={loading}
        className="w-full"
      >
        {loading ? "Starting scan…" : `Scan ${selected.size} pages →`}
      </Button>
    </div>
  );
}
