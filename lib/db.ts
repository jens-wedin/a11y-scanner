import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon Postgres access.
 *
 * Replaces the local-filesystem stores (`reports/*.json`, `schedules.json`) and
 * the module-scope job Map, none of which survive on Vercel: the filesystem is
 * read-only outside /tmp, and separate invocations do not share memory.
 *
 * Records are stored as jsonb documents keyed by id. That keeps the domain
 * types unchanged from the filesystem era; fields are still queryable via
 * `data->>'field'` if reporting needs it later.
 */

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_SOCKET",
]);

/**
 * Whether a database error is worth retrying.
 *
 * Neon computes scale to zero after five minutes idle, and the first query
 * afterwards can have its TLS handshake reset while the compute wakes. In
 * production that rejection escaped and killed the function outright
 * (exit status 128), discarding a crawl that had already succeeded.
 *
 * SQL errors are deliberately excluded: a bad query never becomes a good one.
 */
export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const seen = new Set<unknown>();
  let current: unknown = err;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as { code?: unknown; message?: unknown; cause?: unknown; sourceError?: unknown };

    if (typeof e.code === "string") {
      // Postgres SQLSTATE codes are five characters; those are real SQL faults.
      if (/^[0-9A-Z]{5}$/.test(e.code)) return false;
      if (TRANSIENT_CODES.has(e.code)) return true;
    }
    if (typeof e.message === "string" && /fetch failed|socket disconnected|connection closed|terminated unexpectedly/i.test(e.message)) {
      return true;
    }

    current = e.sourceError ?? e.cause;
  }

  return false;
}

const MAX_ATTEMPTS = 3;

/** Retries transient failures with a short backoff. */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isTransientDbError(err)) throw err;
      const backoff = 150 * 2 ** (attempt - 1);
      console.warn(
        `[db] transient failure (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoff}ms`
      );
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

let cached: NeonQueryFunction<false, false> | null = null;

/**
 * Lazy so that importing this module never throws at build time — Next.js
 * evaluates top-level module code during `next build`, when DATABASE_URL may
 * not be set yet.
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Provision Neon with `vercel integration add neon`, " +
          "then run `vercel env pull .env.local --yes`."
      );
    }
    const base = neon(url);
    // Wrap the tagged-template function so every query inherits the retry.
    cached = ((...args: unknown[]) =>
      withRetry(() => (base as unknown as (...a: unknown[]) => Promise<unknown>)(...args))
    ) as unknown as NeonQueryFunction<false, false>;
  }
  return cached;
}

let schemaReady: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  // Neon advises the direct (non-pooled) connection for DDL — the pooled
  // endpoint runs PgBouncer in transaction mode. Falls back to the pooled URL
  // when no unpooled one is provisioned.
  const direct = process.env.DATABASE_URL_UNPOOLED;
  const sql = direct
    ? ((...args: unknown[]) =>
        withRetry(() =>
          (neon(direct) as unknown as (...a: unknown[]) => Promise<unknown>)(...args)
        )) as unknown as NeonQueryFunction<false, false>
    : getSql();

  await sql`
    create table if not exists scan_jobs (
      id uuid primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists reports (
      scan_id uuid primary key,
      data jsonb not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists schedules (
      id uuid primary key,
      data jsonb not null,
      created_at timestamptz not null default now()
    )
  `;

  // Jobs are transient; this supports pruning finished ones.
  await sql`
    create index if not exists scan_jobs_updated_at_idx on scan_jobs (updated_at)
  `;
}

/**
 * Creates tables if absent. Safe to call on every request — the work is done
 * once per process and the result memoised.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createSchema().catch((err) => {
      schemaReady = null; // let a later call retry after a transient failure
      throw err;
    });
  }
  return schemaReady;
}

/** Test helper: drops memoised state so a fresh connection is made. */
export function resetDbForTests(): void {
  cached = null;
  schemaReady = null;
}
