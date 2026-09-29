import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * The emergency stop for JARVIS device work, against real PostgreSQL with the
 * real migrations. Only an admin with a recent second factor and a reason can
 * change it, every change is recorded, and no browser can touch it directly.
 */
let twin: DatabaseTwin;
const ADMIN = "adadadad-1111-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON = "bebebebe-2222-4bbb-8bbb-bbbbbbbbbbbb";

const set = (user: string, pause: boolean, reason: string, aal: "aal1" | "aal2") =>
  twin.asTenant<{ paused: boolean }>(
    user,
    `select paused from public.ocade_set_service_control('jarvis_execution', ${pause}, '${reason}')`,
    { aal },
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${ADMIN}', 'admin@ocade.invalid'),
       ('${PERSON}', 'person@ocade.invalid') on conflict do nothing;
     insert into public.user_roles (user_id, role) values ('${ADMIN}', 'admin') on conflict do nothing;`,
  );
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("the JARVIS emergency stop", () => {
  it("passes its verification script", async () => {
    const result = await twin.runScript(
      "supabase/verification",
      "20260929090000_jarvis_execution_control_verify.sql",
    );
    expect(result.error).toBeUndefined();
  });

  it("refuses a customer, and an admin without a second factor or a reason", async () => {
    expect((await set(PERSON, true, "a customer tries this", "aal2")).error).toMatch(
      /Only support admins/,
    );
    expect((await set(ADMIN, true, "no second factor here", "aal1")).error).toMatch(
      /second factor/,
    );
    expect((await set(ADMIN, true, "short", "aal2")).error).toMatch(/at least ten/);
    const [row] = await twin.asServiceRole<{ paused: boolean }>(
      `select paused from public.ocade_service_controls where key = 'jarvis_execution'`,
    );
    expect(row!.paused).toBe(false);
  });

  it("an admin with a second factor pauses and resumes, and both are on the record", async () => {
    expect((await set(ADMIN, true, "incident: stop all device work", "aal2")).rows[0]!.paused).toBe(
      true,
    );
    expect((await set(ADMIN, false, "incident resolved, resuming", "aal2")).rows[0]!.paused).toBe(
      false,
    );
    const events = await twin.asServiceRole<{ paused: boolean; changed_by: string }>(
      `select paused, changed_by from public.ocade_service_control_events order by changed_at`,
    );
    expect(events.map((e) => e.paused)).toEqual([true, false]);
    expect(events.every((e) => e.changed_by === ADMIN)).toBe(true);
  });

  it("the Device Agent and the extension pause on their own, recorded the same way", async () => {
    const result = await twin.runScript(
      "supabase/verification",
      "20260929110000_scoped_jarvis_controls_verify.sql",
    );
    expect(result.error).toBeUndefined();
    const paused = await twin.asTenant<{ key: string; paused: boolean }>(
      ADMIN,
      `select key, paused from public.ocade_set_service_control('jarvis_extension', true, 'extension incident under review')`,
      { aal: "aal2" },
    );
    expect(paused.rows[0]).toEqual({ key: "jarvis_extension", paused: true });
    const rows = await twin.asServiceRole<{ key: string; paused: boolean }>(
      `select key, paused from public.ocade_service_controls order by key`,
    );
    expect(rows).toEqual([
      { key: "jarvis_agent", paused: false },
      { key: "jarvis_execution", paused: false },
      { key: "jarvis_extension", paused: true },
    ]);
  });

  it("no signed-in browser reads or writes the tables directly", async () => {
    expect(
      (await twin.asTenant(ADMIN, `select * from public.ocade_service_controls`)).error,
    ).toBeDefined();
    expect(
      (
        await twin.asTenant(
          ADMIN,
          `update public.ocade_service_controls set paused = true where key = 'jarvis_execution'`,
        )
      ).error,
    ).toBeDefined();
  });
});
