// Shared lazy-initialised Resend client
// Used by both scheduled email notifications and ad-hoc report sharing

type ResendClient = {
  emails: {
    send: (params: Record<string, unknown>) => Promise<unknown>;
  };
};

let resendClient: ResendClient | null = null;

export function getResendClient(): ResendClient | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require("resend") as {
    Resend: new (key: string) => ResendClient;
  };
  resendClient = new Resend(apiKey);
  return resendClient;
}

export function getResendFrom(): string | undefined {
  return process.env.RESEND_FROM;
}
