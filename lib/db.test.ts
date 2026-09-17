import { describe, it, expect, beforeAll } from "vitest";
import { getSql, ensureSchema } from "./db";

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
