"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScheduleForm, type ScheduleFormData } from "@/components/ScheduleForm";

export default function NewSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: ScheduleFormData) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create schedule");
      }
      router.push("/schedules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <Link href="/schedules" className="text-sm text-indigo-600 hover:underline">
            ← Back to schedules
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-2">New schedule</h1>
          <p className="text-sm text-gray-500">Set up a recurring accessibility scan.</p>
        </div>
        <ScheduleForm onSubmit={handleSubmit} loading={loading} error={error} />
      </div>
    </main>
  );
}
