import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * An operator removing a customer's JARVIS device, against real PostgreSQL with
 * the real migrations: only an admin with a second factor and a reason, the
 * device's key is gone, its open work stops, and the removal is on the record.
 */
let twin: DatabaseTwin;
const ADMIN = "adadadad-3333-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON = "bebebebe-4444-4bbb-8bbb-bbbbbbbbbbbb";
const DEVICE = "dededede-5555-4ddd-8ddd-dddddddddddd";
const CONVERSATION = "cfcfcfcf-6666-4fff-8fff-ffffffffffff";

const remove = (user: string, reason: string, aal: "aal1" | "aal2") =>
  twin.asTenant<{ removed: boolean }>(
    user,
    `select public.ocade_admin_remove_device('${DEVICE}', '${reason}') as removed`,
    { aal },
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${ADMIN}', 'admin@ocade.invalid'),
       ('${PERSON}', 'person@ocade.invalid') on conflict do nothing;
     insert into public.user_roles (user_id, role) values ('${ADMIN}', 'admin') on conflict do nothing;
     insert into public.jarvis_devices (id, user_id, name, public_key)
       values ('${DEVICE}', '${PERSON}', 'Office PC', repeat('k', 88));
     insert into public.ocade_conversations (id, user_id, title, surface)
       values ('${CONVERSATION}', '${PERSON}', 'Work', 'jarvis');
     insert into public.jarvis_tasks (user_id, conversation_id, device_id, title, status)
       values ('${PERSON}', '${CONVERSATION}', '${DEVICE}', 'Tidy files', 'running');`,
  );
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("an operator removing a device", () => {
  it("passes its verification script", async () => {
    const result = await twin.runScript(
      "supabase/verification",
      "20260929100000_admin_device_removal_verify.sql",
    );
    expect(result.error).toBeUndefined();
  });

  it("refuses the customer, and an admin without a second factor or a reason", async () => {
    expect((await remove(PERSON, "a customer tries this", "aal2")).error).toMatch(
      /Only support admins/,
    );
    expect((await remove(ADMIN, "no second factor here", "aal1")).error).toMatch(/second factor/);
    expect((await remove(ADMIN, "short", "aal2")).error).toMatch(/at least ten/);
    const [device] = await twin.asServiceRole<{ revoked_at: string | null }>(
      `select revoked_at from public.jarvis_devices where id = '${DEVICE}'`,
    );
    expect(device!.revoked_at).toBeNull();
  });

  it("removes the key, stops its open task, and keeps the record once", async () => {
    expect(
      (await remove(ADMIN, "customer reported a stolen laptop", "aal2")).rows[0]!.removed,
    ).toBe(true);
    const [device] = await twin.asServiceRole<{ revoked_at: string | null; public_key: string }>(
      `select revoked_at, public_key from public.jarvis_devices where id = '${DEVICE}'`,
    );
    expect(device!.revoked_at).not.toBeNull();
    expect(device!.public_key).toBeNull();
    const [task] = await twin.asServiceRole<{ status: string }>(
      `select status from public.jarvis_tasks where device_id = '${DEVICE}'`,
    );
    expect(task!.status).toBe("stopped");
    // Already removed: nothing changes and nothing more is recorded.
    expect(
      (await remove(ADMIN, "customer reported a stolen laptop", "aal2")).rows[0]!.removed,
    ).toBe(false);
    const actions = await twin.asServiceRole<{ actor: string; target_user: string }>(
      `select actor, target_user from public.ocade_admin_actions`,
    );
    expect(actions).toEqual([{ actor: ADMIN, target_user: PERSON }]);
  });

  it("no signed-in browser reads the operator record", async () => {
    expect(
      (await twin.asTenant(ADMIN, `select * from public.ocade_admin_actions`)).error,
    ).toBeDefined();
  });
});
