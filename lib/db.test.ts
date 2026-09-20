import { describe, it, expect, beforeAll } from "vitest";
import { getSql, ensureSchema, isTransientDbError } from "./db";

describe("db schema", () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  it("creates the three tables the app needs", async () => {
    const sql = getSql();
    const rows = await sql`
      select tablename from pg_tables where schemaname = current_schema()
    `;
    const tables = rows.map((r) => r.tablename as string);
    expect(tables).toContain("scan_jobs");
    expect(tables).toContain("reports");
    expect(tables).toContain("schedules");
  });

  it("is idempotent — running it twice does not throw", async () => {
    await expect(ensureSchema()).resolves.not.toThrow();
  });

  it("stores and reads back a jsonb document", async () => {
    const sql = getSql();
    const id = "11111111-1111-4111-8111-111111111111";
    await sql`delete from reports where scan_id = ${id}`;
    await sql`insert into reports (scan_id, data) values (${id}, ${JSON.stringify({ hello: "world" })})`;
    const rows = await sql`select data from reports where scan_id = ${id}`;
    expect(rows[0].data).toEqual({ hello: "world" });
    await sql`delete from reports where scan_id = ${id}`;
  });
});

describe("isTransientDbError", () => {
  // Production: the Neon compute had scaled to zero and the TLS handshake was
  // reset while it woke. The rejection escaped and killed the function
  // (exit status 128), taking a successful crawl down with it.
  it("treats a reset socket as transient", () => {
    expect(
      isTransientDbError(
        Object.assign(new Error("fetch failed"), {
          sourceError: Object.assign(new Error("socket disconnected"), {
            cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }),
          }),
        })
      )
    ).toBe(true);
  });

  it("treats a bare fetch failure as transient", () => {
    expect(isTransientDbError(new Error("Error connecting to database: TypeError: fetch failed"))).toBe(true);
  });

  it("treats connection timeouts as transient", () => {
    for (const code of ["ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH"]) {
      expect(isTransientDbError(Object.assign(new Error("x"), { code }))).toBe(true);
    }
  });

  // A schema or query mistake must not be retried — it will never succeed and
  // retrying just delays the real error.
  it("does not treat a SQL error as transient", () => {
    expect(
      isTransientDbError(
        Object.assign(new Error('relation "nope" does not exist'), { code: "42P01" })
      )
    ).toBe(false);
  });

  it("does not treat an arbitrary error as transient", () => {
    expect(isTransientDbError(new Error("something else"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});
