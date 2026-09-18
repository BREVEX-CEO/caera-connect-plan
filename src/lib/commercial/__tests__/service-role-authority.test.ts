import { afterAll, beforeAll, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

const migration = "20260918081533_profiles_usage_authority";
const account = "c86e6eb4-f504-473d-b382-3b3c66ca5f70";
let twin: DatabaseTwin;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const files = DatabaseTwin.migrationFiles();
  const applied = await twin.applyMigrations({ limit: files.indexOf(`${migration}.sql`) });
  expect(applied.filter((entry) => !entry.ok)).toEqual([]);
  await twin.execSuperuser(`
    insert into auth.users (id, email, created_at)
    values ('${account}', 'anchor-regression@invalid.test', now() - interval '1 hour');
    select * from public.ocade_acquire_generation_permit(
      '${account}', 'existing', 'existing', 'chat', 'free', 2800, null, 100);
  `);
});

afterAll(async () => twin?.close());

it("reproduces all six production permission failures, then preserves existing usage through migration", async () => {
  const calls = [
    `ocade_read_commercial_usage('${account}')`,
    `ocade_acquire_generation_permit('${account}', 'new', 'new', 'chat', 'free', 2800, null, 100)`,
    `ocade_finalize_generation_permit('${account}', 'existing', 100)`,
    `ocade_release_generation_permit('${account}', 'existing', 'failed')`,
    `ocade_allocate_offline_usage('${account}', gen_random_uuid(), 'install', repeat('K',44), 'key', 'free', 2800, null, 700, false)`,
    `ocade_return_offline_usage('${account}', gen_random_uuid(), gen_random_uuid())`,
  ];
  for (const call of calls) {
    await expect(twin.asServiceRole(`select * from public.${call}`)).rejects.toThrow(
      "permission denied for table users",
    );
  }
  const before = await twin.asSuperuser(
    `select * from public.ocade_read_commercial_usage('${account}')`,
  );
  expect(await twin.runScript("supabase/migrations", `${migration}.sql`)).toEqual({ ok: true });
  expect(
    await twin.asServiceRole(`select * from public.ocade_read_commercial_usage('${account}')`),
  ).toEqual(before);
  expect(
    await twin.asTenant(
      account,
      `update public.profiles set created_at = now() where id = '${account}'`,
    ),
  ).toMatchObject({ errorCode: "42501" });
  expect(
    await twin.asTenant(
      account,
      `update public.profiles set display_name = 'Still editable' where id = '${account}'`,
    ),
  ).not.toHaveProperty("error");
  for (const call of calls) {
    expect(await twin.asTenant(account, `select * from public.${call}`)).toMatchObject({
      errorCode: "42501",
    });
    expect(await twin.asAnon(`select * from public.${call}`)).toMatchObject({ errorCode: "42501" });
  }
  expect(await twin.runScript("supabase/verification", `${migration}_verify.sql`)).toEqual({
    ok: true,
  });
});
