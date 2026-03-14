"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type EmailFormat = "embed" | "pdf" | "json" | "pdf+json";

const FORMAT_OPTIONS: { value: EmailFormat; label: string; description: string }[] = [
  { value: "embed", label: "Embed in email", description: "Full report in the email body" },
  { value: "pdf", label: "Attach PDF", description: "Summary email with PDF attachment" },
  { value: "json", label: "Attach JSON", description: "Summary email with JSON attachment" },
  { value: "pdf+json", label: "Attach PDF + JSON", description: "Summary email with both files" },
];

interface EmailReportDialogProps {
  scanId: string;
}

export function EmailReportDialog({ scanId }: EmailReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [format, setFormat] = useState<EmailFormat>("pdf");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSend() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/scan/${scanId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, format }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ type: "success", message: `Report sent to ${email}` });
        setTimeout(() => {
          setOpen(false);
          setResult(null);
          setEmail("");
        }, 2000);
      } else {
        setResult({ type: "error", message: data.error || "Failed to send email" });
      }
    } catch {
      setResult({ type: "error", message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors">
            Email Report
          </button>
        }
      />
      <DialogPopup>
        <DialogTitle>Email Report</DialogTitle>
        <DialogDescription className="mt-1">
          Send this accessibility report to an email address.
        </DialogDescription>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-4 space-y-4"
        >
          <div>
            <label htmlFor="email-to" className="block text-sm font-medium text-foreground mb-1">
              Email address
            </label>
            <Input
              id="email-to"
              type="email"
              required
              placeholder="recipient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <fieldset disabled={loading}>
            <legend className="text-sm font-medium text-foreground mb-2">
              Delivery format
            </legend>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as EmailFormat)}
              className="space-y-2"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <RadioGroupItem
                    value={opt.value}
                    id={`format-${opt.value}`}
                    aria-label={opt.label}
                    className="mt-0.5"
                  />
                  <label htmlFor={`format-${opt.value}`} className="cursor-pointer">
                    <div className="text-sm font-medium text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          {result && (
            <div
              role="alert"
              aria-live="polite"
              className={`text-sm rounded-lg px-3 py-2 ${
                result.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose
              render={
                <button
                  type="button"
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                >
                  Cancel
                </button>
              }
            />
            <Button type="submit" disabled={loading || !email} aria-busy={loading}>
              {loading ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
