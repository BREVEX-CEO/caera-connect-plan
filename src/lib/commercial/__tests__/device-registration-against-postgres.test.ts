import { afterAll, beforeAll, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * REGISTERING A BROWSER, AGAINST REAL POSTGRES.
 *
 * The client used to insert the device and then the grant, and compensate by
 * deleting the device when the second failed. Whether that compensation ran —
 * and whether it worked — decided if one of the account's two slots for that
 * kind was lost for ever, with no row anybody could see pointing at it.
 *
 * The repair is a single function whose body is one transaction, and the only
 * way to prove that claim is to make the second write fail inside a real
 * database and look at what is left. A mock cannot fail a statement the way
 * Postgres does, and it certainly cannot roll one back.
 *
 * Everything below runs as `authenticated` with a JWT claim, which is how
 * PostgREST calls it, so the cap trigger and RLS are in force exactly as they
 * are in production.
 */
let twin: DatabaseTwin;
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const register = (user: string, browser: string, kind: "desktop" | "mobile" = "desktop") =>
  twin.asTenant<{ register_browser_device_for_current_user: string | null }>(
    user,
    `select public.register_browser_device_for_current_user(
       '${browser}', '${kind}'::public.device_kind, 'Chrome Windows',
       'https://ocade.in', 'Mozilla/5.0')`,
  );

const devicesOf = async (user: string) =>
  twin.asServiceRole<{ id: string; revoked_at: string | null; kind: string }>(
    `select id, revoked_at, kind from public.devices where user_id = '${user}'`,
  );

const grantsOf = async (user: string) =>
  twin.asServiceRole<{ device_id: string; browser_install_id: string; revoked_at: string | null }>(
    `select device_id, browser_install_id, revoked_at from public.browser_grants
      where user_id = '${user}'`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  const failed = applied.filter((migration) => !migration.ok);
  expect(failed.map((migration) => `${migration.file}: ${migration.error}`)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values
       ('${ACCOUNT}', 'one@ocade.invalid'), ('${OTHER}', 'two@ocade.invalid')
     on conflict do nothing;`,
  );
}, 180_000);

afterAll(async () => {
  await twin?.close();
});

it("writes the device and its grant together, or neither", async () => {
  // Make the SECOND write fail the way a policy or a constraint would. The
  // first has already succeeded inside the function's transaction, so what is
  // in the table afterwards is the whole claim this migration makes.
  await twin.execSuperuser(`
    create or replace function public.fail_grant_insert() returns trigger
      language plpgsql as $$ begin raise exception 'grant write refused'; end $$;
    create trigger fail_grant_insert before insert on public.browser_grants
      for each row execute function public.fail_grant_insert();
  `);

  const refused = await register(ACCOUNT, "browser-atomic");
  expect(refused.error).toMatch(/grant write refused/);
  expect(await devicesOf(ACCOUNT)).toEqual([]);
  expect(await grantsOf(ACCOUNT)).toEqual([]);

  await twin.execSuperuser(`
    drop trigger if exists fail_grant_insert on public.browser_grants;
    drop function if exists public.fail_grant_insert();
  `);

  // And with the write allowed, both rows land and a slot is genuinely used.
  const ok = await register(ACCOUNT, "browser-atomic");
  expect(ok.rows[0]?.register_browser_device_for_current_user).toBeTruthy();
  expect(await devicesOf(ACCOUNT)).toHaveLength(1);
  expect(await grantsOf(ACCOUNT)).toHaveLength(1);
});

it("gives the same browser the same device rather than a second one", async () => {
  const first = await register(ACCOUNT, "browser-atomic");
  const again = await register(ACCOUNT, "browser-atomic");
  expect(again.rows[0]?.register_browser_device_for_current_user).toBe(
    first.rows[0]?.register_browser_device_for_current_user,
  );
  expect(await devicesOf(ACCOUNT)).toHaveLength(1);
});

it("refuses past the cap with the code the browser turns into a sentence", async () => {
  await register(ACCOUNT, "browser-two");
  expect(await devicesOf(ACCOUNT)).toHaveLength(2);

  const over = await register(ACCOUNT, "browser-three");
  // 23514 is check_violation, which `device-identity.ts` maps to "device_limit"
  // — the one refusal a person can act on.
  expect(over.errorCode).toBe("23514");
  // The refusal must not have cost a device row: an orphan here is the slot
  // leak in a different disguise.
  expect(await devicesOf(ACCOUNT)).toHaveLength(2);
  expect(await grantsOf(ACCOUNT)).toHaveLength(2);
});

it("does not re-admit a browser whose device was removed", async () => {
  const devices = await devicesOf(ACCOUNT);
  const revoked = devices[0]!.id;
  const removal = await twin.asTenant<{ revoke_device_for_current_user: boolean }>(
    ACCOUNT,
    `select public.revoke_device_for_current_user('${revoked}')`,
  );
  expect(removal.rows[0]?.revoke_device_for_current_user).toBe(true);

  // The freed slot is real: a different browser can now register.
  const replacement = await register(ACCOUNT, "browser-three");
  expect(replacement.rows[0]?.register_browser_device_for_current_user).toBeTruthy();

  // And the removed one does not quietly take it back, which would make Remove
  // a button that undoes itself on the next visit.
  const returning = await register(ACCOUNT, "browser-atomic");
  expect(returning.error).toBeUndefined();
  expect(returning.rows[0]?.register_browser_device_for_current_user).toBeNull();
});

/*
 * REMOVE MUST NOT BE UNDOABLE FROM THE CLIENT.
 *
 * `authenticated` held INSERT, UPDATE and DELETE on `devices` and
 * `browser_grants`, and both policies checked ownership and nothing else. RLS
 * does not restrict WHICH COLUMNS a permitted row may change, so an account
 * could clear its own revoked row's `revoked_at` straight through the Data API
 * and put a removed browser back — defeating the one control a person has over
 * which devices may answer for them without a network. Registration and removal
 * both go through audited SECURITY DEFINER functions, so the write grants were
 * reachable authority nothing needed.
 */
it("refuses a direct write to devices, so a removal cannot be undone", async () => {
  const revoked = (await devicesOf(ACCOUNT)).find((row) => row.revoked_at !== null);
  expect(revoked, "this suite has already removed a device").toBeTruthy();

  const undo = await twin.asTenant(
    ACCOUNT,
    `update public.devices set revoked_at = null where id = '${revoked!.id}'`,
  );
  expect(undo.error).toMatch(/permission denied/i);

  const after = await devicesOf(ACCOUNT);
  expect(after.find((row) => row.id === revoked!.id)?.revoked_at).toEqual(revoked!.revoked_at);

  // Nor by inserting a device the cap trigger and the registration function
  // never saw, nor by deleting one to free a slot without an audit trail.
  const inserted = await twin.asTenant(
    ACCOUNT,
    `insert into public.devices (user_id, kind, name)
       values ('${ACCOUNT}', 'desktop'::public.device_kind, 'Smuggled')`,
  );
  expect(inserted.error).toMatch(/permission denied/i);
  const deleted = await twin.asTenant(
    ACCOUNT,
    `delete from public.devices where id = '${revoked!.id}'`,
  );
  expect(deleted.error).toMatch(/permission denied/i);

  // Reading stays open: Usage & Limits lists these rows through RLS.
  const read = await twin.asTenant(ACCOUNT, `select id from public.devices`);
  expect(read.error).toBeUndefined();
});

it("refuses a direct write to a browser grant for the same reason", async () => {
  const grant = (await grantsOf(ACCOUNT)).find((row) => row.revoked_at !== null);
  expect(grant, "this suite has already revoked a grant").toBeTruthy();

  const undo = await twin.asTenant(
    ACCOUNT,
    `update public.browser_grants set revoked_at = null
      where device_id = '${grant!.device_id}'`,
  );
  expect(undo.error).toMatch(/permission denied/i);
  const rebind = await twin.asTenant(
    ACCOUNT,
    `insert into public.browser_grants (user_id, device_id, browser_install_id)
       values ('${ACCOUNT}', '${grant!.device_id}', 'smuggled-browser')`,
  );
  expect(rebind.error).toMatch(/permission denied/i);
  expect(
    (await twin.asTenant(ACCOUNT, `select id from public.browser_grants`)).error,
  ).toBeUndefined();
});

/*
 * THE CAP WAS SERIALISED BY THE WRONG KEY.
 *
 * The advisory lock included the browser install id, so two DIFFERENT browsers
 * of one account took two different locks — and the cap is a count-then-insert,
 * so both could see the last slot free and both take it. The cap is per account
 * AND kind, so that is what the lock must be per.
 *
 * PGlite is one connection, so two simultaneous registrations cannot be
 * interleaved here; what is checked is the key the transaction locks on, which
 * is the thing that was wrong.
 */
it("serialises registration per account and device kind, not per browser", async () => {
  const [source] = await twin.asServiceRole<{ prosrc: string }>(
    `select prosrc from pg_proc where proname = 'register_browser_device_for_current_user'`,
  );
  const lock = /pg_advisory_xact_lock\(([^;]*?)\)\);/.exec(source!.prosrc)?.[1] ?? "";
  expect(lock).toContain("_kind");
  expect(lock).not.toContain("_browser_install_id");
});

it("never lets one account register against another's", async () => {
  const mine = await register(OTHER, "browser-atomic");
  const id = mine.rows[0]?.register_browser_device_for_current_user;
  expect(id).toBeTruthy();
  const rows = await devicesOf(OTHER);
  expect(rows.map((row) => row.id)).toEqual([id]);
  // The same browser install id on two accounts is two devices, not a shared one.
  const theirs = await grantsOf(ACCOUNT);
  expect(theirs.some((grant) => grant.device_id === id)).toBe(false);
});
