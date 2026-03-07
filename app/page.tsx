"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanConfigForm } from "@/components/ScanConfigForm";
import type { ScanConfig, CrawledUrl } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart(config: ScanConfig) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Crawl failed");
      }

      const { scanId, urls } = (await res.json()) as {
        scanId: string;
        urls: CrawledUrl[];
      };

      // Store discovered URLs in sessionStorage so the preview page can read them
      sessionStorage.setItem(`crawl-${scanId}`, JSON.stringify(urls));
      router.push(`/crawl/${scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Accessibility Scanner
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Crawl a website and get an AI-powered accessibility audit with WCAG
          and EAA compliance insights.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <ScanConfigForm onSubmit={handleStart} loading={loading} />
      </div>
    </main>
  );
}
