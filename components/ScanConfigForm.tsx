"use client";

import { useState } from "react";
import type { ScanConfig } from "@/lib/types";
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

interface Props {
  onSubmit: (config: ScanConfig) => void;
  loading?: boolean;
}

const MAX_PAGES_OPTIONS = [10, 50, 100, 200];
const DEPTH_OPTIONS = [
  { label: "Unlimited", value: "" },
  { label: "1 level deep", value: "1" },
  { label: "2 levels deep", value: "2" },
  { label: "3 levels deep", value: "3" },
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
        <Input
          id="targetUrl"
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          required
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
        <RadioGroup
          value={String(maxPages)}
          onValueChange={(v) => setMaxPages(Number(v) as 10 | 50 | 100 | 200)}
          className="flex gap-4"
        >
          {MAX_PAGES_OPTIONS.map((n) => (
            <div key={n} className="flex items-center gap-1.5">
              <RadioGroupItem value={String(n)} id={`maxPages-${n}`} />
              <label htmlFor={`maxPages-${n}`} className="text-sm cursor-pointer">
                {n}
              </label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div>
        <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-1">
          Crawl depth
        </label>
        <Select
          value={maxDepth !== undefined ? String(maxDepth) : ""}
          onValueChange={(v) => { if (v !== null) setMaxDepth(v === "" ? undefined : Number(v)); }}
        >
          <SelectTrigger id="maxDepth" className="w-auto">
            <SelectValue placeholder="Unlimited" />
          </SelectTrigger>
          <SelectContent>
            {DEPTH_OPTIONS.map(({ label, value }) => (
              <SelectItem key={label} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full"
      >
        {loading ? "Discovering URLs…" : "Discover URLs →"}
      </Button>
    </form>
  );
}
