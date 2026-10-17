import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";
import { taskToCarryOn } from "../background.server";
import { runDueSchedules } from "../schedules.server";
import { restOver } from "./rest-adapter";

/**
 * Reminders and scheduled work against real PostgreSQL with the real
 * migrations: who can see and change a schedule, that each run happens once,
 * and that work starts only on a computer the person allowed for it.
 */
const notified = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/notifications/send.server", () => ({
  sendNotification: async (input: { title: string }) => {
    notified.push(input.title);
  },
}));

let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
let conversation: string;
let device: string;
const admin = () => restOver(twin) as never;
const sql = <T = Record<string, unknown>>(text: string) => twin.asServiceRole<T>(text);
const NOW = new Date("2026-10-01T09:00:30Z");

async function schedule(
  what: string,
  options: { device?: string; repeat?: string; at?: string } = {},
) {
  const [row] = await sql<{ id: string }>(
    `insert into public.jarvis_schedules (user_id, conversation_id, device_id, what, next_at, repeat, time_zone)
     values ('${A}', '${conversation}', ${options.device ? `'${options.device}'` : "null"}, '${what}',
             '${options.at ?? "2026-10-01T09:00:00Z"}', '${options.repeat ?? "none"}', 'Asia/Kolkata')
     returning id`,
  );
  return row!.id;
}
const row = async (id: string) =>
  (
    await sql<{ active: boolean; next_at: Date; last_outcome: string | null }>(
      `select active, next_at, last_outcome from public.jarvis_schedules where id = '${id}'`,
    )
  )[0]!;
const said = async () =>
  (
    await sql<{ role: string; content: string }>(
      `select role, content from public.ocade_messages where conversation_id = '${conversation}' order by created_at`,
    )
  ).map((m) => `${m.role}: ${m.content}`);
const allow = (capability: string, allowed: boolean) =>
  sql(
    `insert into public.jarvis_permissions (user_id, capability, allowed, device_id)
     values ('${A}', '${capability}', ${allowed}, '${device}')`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${A}', 'a@jarvis.invalid'), ('${B}', 'b@jarvis.invalid')
     on conflict do nothing;`,
  );
  [{ id: conversation }] = await sql<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title, surface) values ('${A}', 'j', 'jarvis') returning id`,
  );
  [{ id: device }] = await sql<{ id: string }>(
    `insert into public.jarvis_devices (user_id, name, public_key, capabilities)
     values ('${A}', 'Desk', repeat('d', 122), '{"files":true}'::jsonb) returning id`,
  );
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  notified.length = 0;
  await sql(`delete from public.jarvis_schedules`);
  await sql(`delete from public.jarvis_tasks`);
  await sql(`delete from public.jarvis_permissions`);
  await sql(`delete from public.ocade_messages`);
  await sql(
    `update public.jarvis_devices set background_enabled = true, last_seen_at = '${NOW.toISOString()}' where id = '${device}'`,
  );
});

describe("who can see and change a schedule", () => {
  it("its owner reads and removes it; nobody writes one but the server", async () => {
    const id = await schedule("Call the bank");
    expect((await twin.asTenant(A, `select what from public.jarvis_schedules`)).rows).toEqual([
      { what: "Call the bank" },
    ]);
    expect((await twin.asTenant(B, `select what from public.jarvis_schedules`)).rows).toEqual([]);
    expect((await twin.asAnon(`select * from public.jarvis_schedules`)).errorCode).toBe("42501");
    for (const write of [
      `insert into public.jarvis_schedules (user_id, conversation_id, what, next_at) values ('${A}', '${conversation}', 'x', now())`,
      `update public.jarvis_schedules set next_at = now() where id = '${id}'`,
    ]) {
      expect((await twin.asTenant(A, write)).errorCode, write).toBe("42501");
    }
    await twin.asTenant(B, `delete from public.jarvis_schedules where id = '${id}'`);
    expect(await row(id)).toBeTruthy();
    await twin.asTenant(A, `delete from public.jarvis_schedules where id = '${id}'`);
    expect(await sql(`select id from public.jarvis_schedules`)).toEqual([]);
  });
});

describe("OCADE's clock", () => {
  it("a reminder is said in its conversation and notified, once", async () => {
    const id = await schedule("Call the bank");
    expect(await runDueSchedules(admin(), NOW)).toBe(1);
    expect(await runDueSchedules(admin(), NOW)).toBe(0);
    expect(await said()).toEqual(["assistant: Reminder: Call the bank"]);
    expect(notified).toEqual(["Reminder: Call the bank"]);
    expect(await row(id)).toMatchObject({ active: false, last_outcome: "Reminded" });
  });

  it("a run whose words could not be saved goes back to the next tick instead of being used up", async () => {
    const id = await schedule("Call the bank");
    const real = admin() as { from(table: string): unknown };
    const down = new Proxy(real, {
      get: (target, key) =>
        key === "from"
          ? (table: string) =>
              table === "ocade_messages"
                ? { insert: async () => ({ error: { message: "unavailable", code: "57P01" } }) }
                : target.from(table)
          : Reflect.get(target, key),
    });
    await runDueSchedules(down as never, NOW);
    expect(await row(id)).toMatchObject({ active: true });
    expect((await row(id)).next_at.toISOString()).toBe("2026-10-01T09:00:00.000Z");
    expect(await runDueSchedules(admin(), NOW)).toBe(1);
    expect(await said()).toEqual(["assistant: Reminder: Call the bank"]);
  });

  /** The process dies at the first database call after its `after`th use of `table`. */
  const dyingAfter = (table: string, after: number) => {
    const real = admin() as { from(table: string): unknown };
    let used = 0;
    return new Proxy(real, {
      get: (target, key) =>
        key === "from"
          ? (name: string) => {
              if (used >= after) throw new Error("the process died");
              if (name === table) used += 1;
              return target.from(name);
            }
          : Reflect.get(target, key),
    });
  };

  it("a run claimed just before the process died is done by a later tick, once (Phase 06 V09)", async () => {
    const id = await schedule("Stretch", { repeat: "daily" });
    // The claim (the schedule's own update) lands, then the process dies: no reminder, and
    // the compensation in the catch never runs.
    await expect(runDueSchedules(dyingAfter("jarvis_schedules", 2) as never, NOW)).rejects.toThrow(
      /process died/,
    );
    expect(await said()).toEqual([]);
    // Before: the occurrence was used up and nothing ever said it. Now a later tick does it.
    const later = new Date(NOW.getTime() + 10 * 60_000);
    expect(await runDueSchedules(admin(), later)).toBe(1);
    expect(await runDueSchedules(admin(), later)).toBe(0);
    expect(await said()).toEqual(["assistant: Reminder: Stretch"]);
    expect(notified).toEqual(["Reminder: Stretch"]);
    // The cadence is kept: tomorrow's run is still tomorrow's.
    expect((await row(id)).next_at.toISOString()).toBe("2026-10-02T09:00:00.000Z");
  });

  it("a run that died after saying its reminder says it once, not twice", async () => {
    await schedule("Stretch", { repeat: "daily" });
    await expect(runDueSchedules(dyingAfter("ocade_messages", 1) as never, NOW)).rejects.toThrow(
      /process died/,
    );
    expect(await runDueSchedules(admin(), new Date(NOW.getTime() + 10 * 60_000))).toBe(1);
    expect(await said()).toEqual(["assistant: Reminder: Stretch"]);
  });

  it("two clocks at once run a due reminder once", async () => {
    await schedule("Call the bank");
    const runs = await Promise.all([runDueSchedules(admin(), NOW), runDueSchedules(admin(), NOW)]);
    expect(runs.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await said()).toEqual(["assistant: Reminder: Call the bank"]);
  });

  it("the claim migration verifies, rolls back and applies again", async () => {
    const MIGRATION = "20261017090000_schedule_occurrence_claims";
    const verify = () => twin.runScript("supabase/verification", `${MIGRATION}_verify.sql`);
    expect((await verify()).error).toBeUndefined();
    expect(
      (await twin.runScript("supabase/rollback", `${MIGRATION}_rollback.sql`)).error,
    ).toBeUndefined();
    expect((await verify()).error).toBeTruthy();
    expect((await twin.runScript("supabase/migrations", `${MIGRATION}.sql`)).error).toBeUndefined();
    expect((await verify()).error).toBeUndefined();
  });

  it("scheduled work started just before the process died is not started twice or called busy", async () => {
    await allow("autonomous", true);
    const id = await schedule("Tidy the reports", { device });
    await expect(runDueSchedules(dyingAfter("jarvis_tasks", 1) as never, NOW)).rejects.toThrow(
      /process died/,
    );
    const later = new Date(NOW.getTime() + 10 * 60_000);
    await sql(
      `update public.jarvis_devices set last_seen_at = '${later.toISOString()}' where id = '${device}'`,
    );
    expect(await runDueSchedules(admin(), later)).toBe(1);
    expect(
      await sql(`select id from public.jarvis_tasks where device_id = '${device}'`),
    ).toHaveLength(1);
    expect(await row(id)).toMatchObject({ last_outcome: "Started" });
    expect(notified).toEqual([]);
  });

  it("a repeating one moves to its next time and is not run again early", async () => {
    const id = await schedule("Stretch", { repeat: "daily" });
    await runDueSchedules(admin(), NOW);
    expect((await row(id)).next_at.toISOString()).toBe("2026-10-02T09:00:00.000Z");
    expect(await runDueSchedules(admin(), new Date("2026-10-02T08:59:00Z"))).toBe(0);
    expect(await runDueSchedules(admin(), new Date("2026-10-02T09:00:10Z"))).toBe(1);
    expect(notified).toEqual(["Reminder: Stretch", "Reminder: Stretch"]);
  });

  it("scheduled work starts on the computer only when the person allowed it", async () => {
    const id = await schedule("Tidy the reports", { device });
    await runDueSchedules(admin(), NOW);
    expect((await row(id)).last_outcome).toBe("Scheduled work is off on Desk.");
    expect(await sql(`select id from public.jarvis_tasks`)).toEqual([]);
    expect(notified).toEqual(["JARVIS could not start: Tidy the reports"]);
    expect(await said()).toEqual([
      "assistant: I could not start “Tidy the reports”: Scheduled work is off on Desk.",
    ]);
  });

  it("with Background Mode and Scheduled work on, the computer starts and holds the task", async () => {
    await allow("autonomous", true);
    const id = await schedule("Tidy the reports", { device });
    await runDueSchedules(admin(), NOW);
    expect((await row(id)).last_outcome).toBe("Started");
    const [task] = await sql<{ id: string; controller: string; status: string; title: string }>(
      `select id, controller, status, title from public.jarvis_tasks`,
    );
    expect(task).toMatchObject({
      controller: device,
      status: "running",
      title: "Tidy the reports",
    });
    expect(await said()).toEqual(["user: Scheduled for now: Tidy the reports"]);
    // It is this computer's to carry on at once: nobody else is driving it.
    expect(await taskToCarryOn(admin(), { id: device, userId: A })).toBe(task!.id);
  });

  it("never over a computer that is off, offline or busy", async () => {
    await allow("autonomous", true);
    await sql(`update public.jarvis_devices set background_enabled = false where id = '${device}'`);
    const off = await schedule("One", { device });
    await runDueSchedules(admin(), NOW);
    expect((await row(off)).last_outcome).toBe("Background Mode is off on Desk.");

    await sql(
      // Ten minutes before the clock this run uses, not the wall clock's.
      `update public.jarvis_devices set background_enabled = true, last_seen_at = '${NOW.toISOString()}'::timestamptz - interval '10 minutes' where id = '${device}'`,
    );
    const away = await schedule("Two", { device });
    await runDueSchedules(admin(), NOW);
    expect((await row(away)).last_outcome).toBe("Desk was not online.");

    await sql(
      `update public.jarvis_devices set last_seen_at = '${NOW.toISOString()}' where id = '${device}'`,
    );
    await sql(
      `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title) values ('${A}', '${conversation}', '${device}', 'Already here')`,
    );
    const busy = await schedule("Three", { device });
    await runDueSchedules(admin(), NOW);
    expect((await row(busy)).last_outcome).toBe("Desk was busy with another task.");
    expect(await sql(`select title from public.jarvis_tasks`)).toEqual([{ title: "Already here" }]);
  });

  it("OCADE's emergency stop and JARVIS turned off both refuse it", async () => {
    await allow("autonomous", true);
    process.env.JARVIS_EXECUTION_DISABLED = "1";
    try {
      const paused = await schedule("One", { device });
      await runDueSchedules(admin(), NOW);
      expect((await row(paused)).last_outcome).toBe(
        "work on computers is paused by OCADE right now.",
      );
    } finally {
      delete process.env.JARVIS_EXECUTION_DISABLED;
    }
    await sql(
      `insert into public.jarvis_permissions (user_id, capability, allowed) values ('${A}', 'master', false)`,
    );
    const off = await schedule("Two", { device });
    await runDueSchedules(admin(), NOW);
    expect((await row(off)).last_outcome).toBe("OCADE JARVIS is turned off.");
    expect(await sql(`select id from public.jarvis_tasks`)).toEqual([]);
  });

  it("removing the computer removes its scheduled work", async () => {
    const [{ id: spare }] = await sql<{ id: string }>(
      `insert into public.jarvis_devices (user_id, name, public_key) values ('${A}', 'Spare', repeat('s', 122)) returning id`,
    );
    await schedule("On the spare", { device: spare });
    await sql(`delete from public.jarvis_devices where id = '${spare}'`);
    expect(await sql(`select id from public.jarvis_schedules`)).toEqual([]);
  });
});
