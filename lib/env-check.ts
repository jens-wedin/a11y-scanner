/**
 * Startup validation for required environment variables.
 *
 * Exists because `ANTROPHIC_API_KEY` sat misspelled in .env.local: the Anthropic
 * SDK reads `ANTHROPIC_API_KEY`, so every scan silently fell back to axe-only
 * issues and looked like a working product. Misconfiguration should be loud.
 */

type Env = Record<string, string | undefined>;

/** Returns human-readable problems. Empty array means the environment is usable. */
export function checkEnvironment(env: Env): string[] {
  const problems: string[] = [];

  if (!env.ANTHROPIC_API_KEY) {
    if (env.ANTROPHIC_API_KEY) {
      problems.push(
        "ANTROPHIC_API_KEY is set but misspelled — the Anthropic SDK reads " +
          "ANTHROPIC_API_KEY. Rename it, or AI analysis will silently fall back " +
          "to axe-only issues."
      );
    } else {
      problems.push(
        "ANTHROPIC_API_KEY is not set — AI analysis will fall back to " +
          "axe-only issues and every report will be flagged analysisFailed."
      );
    }
  }

  if (env.RESEND_API_KEY && !env.RESEND_FROM) {
    problems.push(
      "RESEND_API_KEY is set but RESEND_FROM is not — email sending will be disabled."
    );
  }

  if (env.RESEND_FROM && !env.RESEND_API_KEY) {
    problems.push(
      "RESEND_FROM is set but RESEND_API_KEY is not — email sending will be disabled."
    );
  }

  return problems;
}

/** Logs any problems at startup. Never prints variable values. */
export function reportEnvironment(env: Env = process.env): void {
  for (const problem of checkEnvironment(env)) {
    console.warn(`[env] ${problem}`);
  }
}
