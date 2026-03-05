"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanEvent } from "@/lib/types";

interface Props {
  scanId: string;
}

type Phase = "scanning" | "analyzing" | "done" | "error";

export function ScanProgressView({ scanId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [current, setCurrent] = useState("");
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(0);
  const [violationsFound, setViolationsFound] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const es = new EventSource(`/api/scan/${scanId}/progress`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ScanEvent;

        if (data.type === "scan-progress") {
          setCurrent(data.url);
          setScanned(data.scannedCount);
          setTotal(data.totalCount);
          setViolationsFound((prev) => prev + data.violations);
        } else if (data.type === "analysis-start") {
          setPhase("analyzing");
        } else if (data.type === "analysis-complete") {
          setPhase("done");
          es.close();
          router.push(`/report/${scanId}`);
        } else if (data.type === "error") {
          setPhase("error");
          setError((data as { type: "error"; message: string }).message);
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setPhase("error");
      setError("Connection to server lost. The scan may still be running \u2014 try refreshing.");
      es.close();
    };

    return () => es.close();
  }, [scanId, router]);

  const progress = total > 0 ? Math.round((scanned / total) * 100) : 0;

  return (
    <div className="space-y-6" aria-live="polite" aria-label="Scan progress">
      {/* Phase stepper */}
      <ol className="flex gap-6" aria-label="Scan phases">
        {[
          { id: "scanning", label: "Scanning pages" },
          { id: "analyzing", label: "Analysing with Claude" },
          { id: "done", label: "Complete" },
        ].map(({ id, label }, idx) => {
          const isActive = phase === id;
          const isDone =
            (id === "scanning" && ["analyzing", "done"].includes(phase)) ||
            (id === "analyzing" && phase === "done");
          return (
            <li key={id} className="flex items-center gap-2">
              <span
                aria-current={isActive ? "step" : undefined}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isDone ? "bg-green-500 text-white" : isActive ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}
              >
                {isDone ? "\u2713" : idx + 1}
              </span>
              <span className={`text-sm ${isActive ? "font-medium text-gray-900" : "text-gray-500"}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Progress bar */}
      {phase === "scanning" && (
        <div>
          {total > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{scanned} / {total} pages</span>
                <span>{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Scan progress"
                className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}
          {current && (
            <p className="mt-2 text-xs text-gray-500 truncate" aria-label="Currently scanning">
              Scanning: {current}
            </p>
          )}
          {violationsFound > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {violationsFound} violations found so far
            </p>
          )}
          {total === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Waiting for scan to start\u2026</span>
            </div>
          )}
        </div>
      )}

      {phase === "analyzing" && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Analysing violations with Claude AI\u2026</span>
        </div>
      )}

      {phase === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>Scan error:</strong> {error}
        </div>
      )}
    </div>
  );
}
