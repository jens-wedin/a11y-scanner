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
    cached = neon(url);
  }
  return cached;
}

let schemaReady: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  const sql = getSql();

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
