"use client";
import { fetchJson } from "@/lib/fetch-json";

import { useState, useRef, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ATTACHMENT_TYPES, type AttachmentType } from "@/lib/email-format";

type DeliveryMode = "embed" | "attach";

const MODE_OPTIONS: { value: DeliveryMode; label: string; description: string }[] = [
  { value: "embed", label: "Embed in email", description: "Full report in the email body" },
  { value: "attach", label: "Send as attachments", description: "Summary email with files attached" },
];

const ATTACHMENT_LABELS: Record<AttachmentType, { label: string; description: string }> = {
  pdf: { label: "PDF", description: "Formatted report for sharing" },
  json: { label: "JSON", description: "Raw data for tooling" },
  csv: { label: "CSV", description: "One row per issue per page, for spreadsheets" },
};

interface EmailReportDialogProps {
  scanId: string;
}

export function EmailReportDialog({ scanId }: EmailReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<DeliveryMode>("attach");
  const [attachments, setAttachments] = useState<AttachmentType[]>(["pdf"]);

  function toggleAttachment(type: AttachmentType) {
    setAttachments((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  // The API takes a "+"-joined string, e.g. "pdf+csv".
  const format = mode === "embed" ? "embed" : attachments.join("+");
  const nothingSelected = mode === "attach" && attachments.length === 0;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  async function handleSend() {
    setLoading(true);
    setResult(null);

    try {
      await fetchJson(`/api/scan/${scanId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, format }),
      });

      setResult({ type: "success", message: `Report sent to ${email}` });
      if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = setTimeout(() => {
        setOpen(false);
        setResult(null);
        setEmail("");
      }, 2000);
    } catch (err) {
      // fetchJson throws with the server's message, or a sign-in prompt when an
      // auth gate returned HTML instead of JSON.
      setResult({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to send email. Please try again.",
      });
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
              value={mode}
              onValueChange={(v) => setMode(v as DeliveryMode)}
              className="space-y-2"
            >
              {MODE_OPTIONS.map((opt) => (
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

          {mode === "attach" && (
            <fieldset disabled={loading} className="mt-4">
              <legend className="text-sm font-medium text-foreground mb-2">
                Files to attach
              </legend>
              <div className="space-y-2">
                {ATTACHMENT_TYPES.map((type) => (
                  <div key={type} className="flex items-start gap-2">
                    <Checkbox
                      id={`attach-${type}`}
                      checked={attachments.includes(type)}
                      onCheckedChange={() => toggleAttachment(type)}
                      aria-label={`Attach ${ATTACHMENT_LABELS[type].label}`}
                      className="mt-0.5"
                    />
                    <label htmlFor={`attach-${type}`} className="cursor-pointer">
                      <div className="text-sm font-medium text-foreground">
                        {ATTACHMENT_LABELS[type].label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ATTACHMENT_LABELS[type].description}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              {nothingSelected && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  Choose at least one file to attach.
                </p>
              )}
            </fieldset>
          )}

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
            <Button
              type="submit"
              disabled={loading || !email || nothingSelected}
              aria-busy={loading}
            >
              {loading ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
