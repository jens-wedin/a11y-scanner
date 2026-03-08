"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScanConfigForm } from "@/components/ScanConfigForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScanConfig, CrawledUrl } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState("");
  const [error, setError] = useState("");

  async function handleStart(config: ScanConfig) {
    setLoading(true);
    setError("");
    setCrawlStatus("Launching browser and discovering pages…");

    // Cycle through status messages so it doesn't look frozen
    const messages = [
      "Launching browser and discovering pages…",
      "Following internal links…",
      "Still crawling — large sites can take up to a minute…",
      "Almost there, collecting the last pages…",
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, messages.length - 1);
      setCrawlStatus(messages[msgIdx]);
    }, 8000);

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

      const { scanId, urls, headless } = (await res.json()) as {
        scanId: string;
        urls: CrawledUrl[];
        headless: boolean;
      };

      // Store URLs + config in sessionStorage so the preview page can recreate
      // the job if the server-side queue was cleared by a hot reload
      clearInterval(msgInterval);
      sessionStorage.setItem(
        `crawl-${scanId}`,
        JSON.stringify({ urls, config, headless })
      );
      router.push(`/crawl/${scanId}`);
    } catch (err) {
      clearInterval(msgInterval);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setCrawlStatus("");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex justify-end mb-4">
          <Link href="/schedules" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-sm")}>
            Schedules →
          </Link>
        </div>
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

        {loading && crawlStatus && (
          <div
            aria-live="polite"
            className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 p-3 flex items-center gap-3"
          >
            <svg
              className="animate-spin h-4 w-4 text-indigo-600 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-indigo-700">{crawlStatus}</p>
          </div>
        )}

        <ScanConfigForm onSubmit={handleStart} loading={loading} />
      </div>
    </main>
  );
}
