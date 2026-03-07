"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { UrlPreviewList } from "@/components/UrlPreviewList";
import type { CrawledUrl } from "@/lib/types";

export default function CrawlPreviewPage() {
  const params = useParams<{ scanId: string }>();
  const scanId = params.scanId;
  const router = useRouter();
  const [urls, setUrls] = useState<CrawledUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Retrieve crawled URLs stored by the home page after crawl completes
    const stored = sessionStorage.getItem(`crawl-${scanId}`);
    if (stored) {
      setUrls(JSON.parse(stored) as CrawledUrl[]);
    }
  }, [scanId]);

  async function handleStart(selectedUrls: string[]) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, selectedUrls }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start scan");
      }

      router.push(`/scan/${scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Discovered pages
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Select which pages to include in your accessibility scan.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {urls.length > 0 ? (
          <UrlPreviewList urls={urls} onStart={handleStart} loading={loading} />
        ) : (
          <p className="text-sm text-gray-500">
            Loading discovered pages… If this persists, go back and try again.
          </p>
        )}
      </div>
    </main>
  );
}
