/**
 * Parses the `format` field of an email-report request.
 *
 * The wire format has always been a `+`-joined string ("pdf+json"), so rather
 * than enumerate every combination — which grows as 2^n with each new
 * attachment type — this parses the parts generically. Existing callers
 * sending "pdf", "json" or "pdf+json" are unaffected.
 */

export const ATTACHMENT_TYPES = ["pdf", "json", "csv"] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export type EmailFormat =
  | { mode: "embed" }
  | { mode: "attach"; attachments: AttachmentType[] }
  | { error: string };

function isAttachmentType(value: string): value is AttachmentType {
  return (ATTACHMENT_TYPES as readonly string[]).includes(value);
}

export function parseEmailFormat(raw: unknown): EmailFormat {
  const accepted = `embed, ${ATTACHMENT_TYPES.join(", ")}, or a combination joined with "+" (e.g. pdf+csv)`;

  if (typeof raw !== "string" || !raw.trim()) {
    return { error: `Format is required. Accepted: ${accepted}.` };
  }

  const parts = raw
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);

  if (parts.length === 0) {
    return { error: `Format is required. Accepted: ${accepted}.` };
  }

  if (parts.includes("embed")) {
    if (parts.length > 1) {
      return {
        error: "Embedding the report and attaching files are separate choices.",
      };
    }
    return { mode: "embed" };
  }

  const attachments: AttachmentType[] = [];
  for (const part of parts) {
    if (!isAttachmentType(part)) {
      return { error: `Unknown format "${part}". Accepted: ${accepted}.` };
    }
    if (!attachments.includes(part)) attachments.push(part);
  }

  return { mode: "attach", attachments };
}
