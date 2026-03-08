"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScheduleForm, type ScheduleFormData } from "@/components/ScheduleForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-sm border border-border p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/schedules" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-sm")}>
              ← Back to schedules
            </Link>
            <h1 className="text-xl font-bold text-foreground mt-2">New schedule</h1>
            <p className="text-sm text-muted-foreground">Set up a recurring accessibility scan.</p>
          </div>
          <ThemeToggle />
        </div>
        <ScheduleForm onSubmit={handleSubmit} loading={loading} error={error} />
      </div>
    </main>
  );
}
