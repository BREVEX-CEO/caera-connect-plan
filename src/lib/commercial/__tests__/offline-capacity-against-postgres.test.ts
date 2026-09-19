import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import { ALLOWANCES } from "../usage-policy";
import { toHundredths } from "../supabase-ledger";

/**
 * ONE ACCOUNT'S CAPACITY, SHARED BY EVERY DEVICE AND BOTH MECHANISMS.
 *
 * `PLAN.md` Phase 4's gate is a single sentence — "possible consumption cannot
 * exceed authoritative capacity" — and the word doing the work is POSSIBLE.
 * Not "recorded", not "settled": everything an account could still spend
 * without asking anybody, added up across every place it can be held.
 *
 * There are two such places and they are easy to reason about separately and
 * wrong to. A CONNECTED request holds a reservation on a durable permit. An
 * OFFLINE device holds a signed block of allocation it can spend with the
 * network down and nobody watching. Two devices, each with a block, plus a
 * connected request in flight, is three claims on one allowance — and if any of
 * them were counted anywhere but the account's own window, the plan would be a
 * suggestion.
 *
 * The migration's verification proves each function on its own, with one
 * device. What is proved here is the ARITHMETIC BETWEEN THEM, which is the part
 * no single function owns:
 *
 *   * two devices draw from one pool rather than one each,
 *   * an offline block spends the same allowance a connected request does,
 *   * reconciling one device's events cannot move another device's lease,
 *   * a device that returns its block gives that capacity back to the account.
 *
 * Against real PostgreSQL, because a capacity rule enforced by anything other
 * than the database is a capacity rule two servers can disagree about.
 */

let twin: DatabaseTwin;
let account: string;
let laptop: string;
let phone: string;

const FREE_SESSION_HUNDREDTHS = toHundredths(ALLOWANCES.free.session);
/** Ed25519 public keys are 44 base64 characters; the column checks 40 to 60. */
const LAPTOP_KEY = "L".repeat(44);
const PHONE_KEY = "P".repeat(44);

interface Allocation {
  lease_id: string | null;
  outcome: string;
  allocated_hundredths: string;
}

async function allocate(
  device: string,
  install: string,
  key: string,
  requestKey: string,
  amountHundredths: number,
): Promise<Allocation> {
  const rows = await twin.asServiceRole<Allocation>(
    `select lease_id, outcome, allocated_hundredths
       from public.ocade_allocate_offline_usage(
         '${account}'::uuid, '${device}'::uuid, '${install}', '${key}',
         '${requestKey}', 'free', ${FREE_SESSION_HUNDREDTHS}, NULL,
         ${amountHundredths}, false)`,
  );
  return rows[0]!;
}

/**
 * Sign a block, the way the server does before handing it to a device.
 *
 * A freshly allocated lease is `pending_signature` and CANNOT be reconciled —
 * correctly, because an unsigned block was never given to anybody, and letting
 * a device report consumption against one would be accepting spending it was
 * never authorised to do. So every reconciliation test signs first.
 *
 * The payload is read back from the row rather than reconstructed, because
 * `ocade_activate_offline_usage_lease` compares FOURTEEN fields and activates
 * nothing if any one of them disagrees. That strictness is the point of it: the
 * signature covers what the device is allowed to spend, so a payload saying
 * anything different is not the thing that was signed.
 */
async function activate(lease: string): Promise<void> {
  const rows = await twin.asServiceRole<Record<string, string>>(
    `select id::text, user_id::text, device_id::text, tier,
            allocated_hundredths::text, sequence_start::text, sequence_end::text,
            session_window_start::text, session_reset_at::text,
            week_window_start::text, week_reset_at::text,
            issued_at::text, not_before::text, expires_at::text, preissued::text
       from public.ocade_device_usage_leases where id = '${lease}'`,
  );
  const row = rows[0]!;
  const payload = {
    version: 1,
    keyId: "capacity-proof-key",
    leaseId: row.id,
    accountId: row.user_id,
    deviceId: row.device_id,
    tier: row.tier,
    allocatedHundredths: Number(row.allocated_hundredths),
    sequenceStart: Number(row.sequence_start),
    sequenceEnd: Number(row.sequence_end),
    sessionWindowStart: row.session_window_start,
    sessionResetAt: row.session_reset_at,
    weekWindowStart: row.week_window_start,
    weekResetAt: row.week_reset_at,
    issuedAt: row.issued_at,
    notBefore: row.not_before,
    expiresAt: row.expires_at,
    preissued: row.preissued === "true",
  };
  const activated = await twin.asServiceRole<{ ocade_activate_offline_usage_lease: boolean }>(
    `select public.ocade_activate_offline_usage_lease(
       '${account}'::uuid, '${lease}'::uuid, 'capacity-proof-key',
       '${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb,
       '${"S".repeat(88)}')`,
  );
  expect(
    activated[0]!.ocade_activate_offline_usage_lease,
    "the signed block was refused, so nothing below is testing reconciliation",
  ).toBe(true);
}

/** What the account has spent and is holding, in hundredths. */
async function sessionHundredths(): Promise<number> {
  const rows = await twin.asServiceRole<{ used_hundredths: string }>(
    `select used_hundredths from public.ocade_commercial_usage
      where user_id = '${account}' and window_kind = 'session'`,
  );
  return rows.length === 0 ? 0 : Number(rows[0]!.used_hundredths);
}

async function registerDevice(name: string, install: string): Promise<string> {
  const rows = await twin.asServiceRole<{ id: string }>(
    `insert into public.devices (user_id, kind, name)
     values ('${account}', 'desktop', '${name}') returning id`,
  );
  const id = rows[0]!.id;
  await twin.execSuperuser(
    `insert into public.browser_grants (user_id, device_id, browser_install_id, origin, user_agent)
     values ('${account}', '${id}', '${install}', 'https://ocade.invalid', 'capacity proof')`,
  );
  return id;
}

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((migration) => !migration.ok).map((migration) => migration.file),
    "a migration failed",
  ).toEqual([]);

  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into auth.users (id, email, created_at)
     values (gen_random_uuid(), 'offline-capacity-proof@invalid.test', statement_timestamp())
     returning id`,
  );
  account = rows[0]!.id;
  laptop = await registerDevice("Capacity proof laptop", "install-laptop");
  phone = await registerDevice("Capacity proof phone", "install-phone");
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  await twin.execSuperuser(
    `delete from public.ocade_offline_usage_events where user_id = '${account}'`,
  );
  await twin.execSuperuser(
    `delete from public.ocade_offline_usage_allocations where user_id = '${account}'`,
  );
  await twin.execSuperuser(
    `delete from public.ocade_device_usage_leases where user_id = '${account}'`,
  );
  await twin.execSuperuser(
    `delete from public.ocade_generation_permits where user_id = '${account}'`,
  );
  await twin.execSuperuser(
    `delete from public.ocade_commercial_usage where user_id = '${account}'`,
  );
});

describe("two devices draw from one allowance", () => {
  it("adds both devices' blocks to the same account window", async () => {
    const first = await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-1", 700);
    const second = await allocate(phone, "install-phone", PHONE_KEY, "phone-1", 700);

    expect(first.outcome).toBe("allocated");
    expect(second.outcome).toBe("allocated");
    expect(first.lease_id).not.toBe(second.lease_id);
    /*
     * 1400, not 700. If each device kept its own counter this would read 700
     * twice and the account would hold double what it is owed — the exact shape
     * of "capacity per device" rather than "capacity per account".
     */
    expect(await sessionHundredths()).toBe(1400);
  });

  it("refuses the second device once the shared allowance is gone", async () => {
    // The laptop takes the whole Free session allowance.
    const all = await allocate(
      laptop,
      "install-laptop",
      LAPTOP_KEY,
      "laptop-everything",
      FREE_SESSION_HUNDREDTHS,
    );
    expect(all.outcome).toBe("allocated");

    const refused = await allocate(phone, "install-phone", PHONE_KEY, "phone-after", 100);
    expect(refused.outcome, "a second device allocated capacity the account no longer had").toBe(
      "session_exhausted",
    );
    expect(refused.lease_id).toBeNull();
    expect(await sessionHundredths()).toBe(FREE_SESSION_HUNDREDTHS);
  });

  it("gives capacity back to the account, not to the device that held it", async () => {
    const held = await allocate(
      laptop,
      "install-laptop",
      LAPTOP_KEY,
      "laptop-hold",
      FREE_SESSION_HUNDREDTHS,
    );
    expect((await allocate(phone, "install-phone", PHONE_KEY, "phone-blocked", 100)).outcome).toBe(
      "session_exhausted",
    );

    const returned = await twin.asServiceRole<{ ocade_return_offline_usage: string }>(
      `select public.ocade_return_offline_usage(
         '${account}'::uuid, '${laptop}'::uuid, '${held.lease_id}'::uuid)`,
    );
    expect(Number(returned[0]!.ocade_return_offline_usage)).toBe(FREE_SESSION_HUNDREDTHS);
    expect(await sessionHundredths()).toBe(0);

    // The phone can now have what the laptop gave back.
    const after = await allocate(phone, "install-phone", PHONE_KEY, "phone-after-return", 100);
    expect(after.outcome).toBe("allocated");
  });
});

describe("an offline block and a connected request spend the same allowance", () => {
  it("refuses a connected permit when offline blocks have taken the window", async () => {
    await allocate(
      laptop,
      "install-laptop",
      LAPTOP_KEY,
      "laptop-all",
      FREE_SESSION_HUNDREDTHS - 100,
    );

    const granted = await twin.asServiceRole<{ outcome: string }>(
      `select outcome from public.ocade_acquire_generation_permit(
         '${account}'::uuid, 'connected-1', 'generation-connected-1', 'chat', 'free',
         ${FREE_SESSION_HUNDREDTHS}, NULL, 100)`,
    );
    // Exactly fills it, so it is allowed: refusing the last unit would turn an
    // allowance of 28 into an allowance of 27.
    expect(granted[0]!.outcome).toBe("granted");

    const refused = await twin.asServiceRole<{ outcome: string }>(
      `select outcome from public.ocade_acquire_generation_permit(
         '${account}'::uuid, 'connected-2', 'generation-connected-2', 'chat', 'free',
         ${FREE_SESSION_HUNDREDTHS}, NULL, 100)`,
    );
    expect(
      refused[0]!.outcome,
      "a connected request was granted capacity an offline device was already holding",
    ).toBe("session_exhausted");
  });

  it("refuses an offline block when connected requests have taken the window", async () => {
    await twin.asServiceRole(
      `select outcome from public.ocade_acquire_generation_permit(
         '${account}'::uuid, 'connected-first', 'generation-connected-first', 'chat', 'free',
         ${FREE_SESSION_HUNDREDTHS}, NULL, ${FREE_SESSION_HUNDREDTHS})`,
    );

    const refused = await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-late", 100);
    expect(
      refused.outcome,
      "an offline device took capacity a connected request was already holding",
    ).toBe("session_exhausted");
  });
});

describe("reconciling one device cannot move another", () => {
  /** A signed-event envelope in the shape `ocade_reconcile_offline_usage` reads. */
  function envelope(lease: string, device: string, sequence: number, cost: number): string {
    const payload = {
      /*
       * The event id carries the DEVICE as well as the sequence.
       * `ocade_offline_usage_events.id` is a primary key across every lease in
       * the deployment — a device generates a random UUID per event, so a
       * collision is not a thing that happens — and a fixture that numbered
       * events by sequence alone made the laptop's first event and the phone's
       * first event the same row.
       */
      eventId: `00000000-0000-4000-8000-${device.replaceAll("-", "").slice(0, 8)}${String(
        sequence,
      ).padStart(4, "0")}`,
      leaseId: lease,
      accountId: account,
      deviceId: device,
      sequence,
      generationId: `generation-${device}-${sequence}`,
      idempotencyKey: `key-${device}-${sequence}`,
      surface: "chat",
      status: "succeeded",
      costHundredths: cost,
      occurredAt: new Date().toISOString(),
      previousHash: sequence === 1 ? "" : `hash-${sequence - 1}`,
    };
    const event = {
      payload,
      eventHash: `hash-${sequence}`,
      deviceSignature: `signature-${device}-${sequence}`,
    };
    return JSON.stringify([event]).replaceAll("'", "''");
  }

  async function reconcile(
    lease: string,
    device: string,
    consumed: number,
    sequence: number,
    events: string,
  ): Promise<void> {
    await twin.asServiceRole(
      `select public.ocade_reconcile_offline_usage(
         '${account}'::uuid, '${device}'::uuid, '${lease}'::uuid,
         ${consumed}, ${sequence}, 'hash-${sequence}', '${events}'::jsonb)`,
    );
  }

  it("records each device's consumption against its own lease", async () => {
    const laptopLease = (await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-r", 700))
      .lease_id!;
    const phoneLease = (await allocate(phone, "install-phone", PHONE_KEY, "phone-r", 700))
      .lease_id!;
    await activate(laptopLease);
    await activate(phoneLease);

    await reconcile(laptopLease, laptop, 300, 1, envelope(laptopLease, laptop, 1, 300));
    await reconcile(phoneLease, phone, 100, 1, envelope(phoneLease, phone, 1, 100));

    const rows = await twin.asServiceRole<{ id: string; consumed_hundredths: string }>(
      `select id, consumed_hundredths from public.ocade_device_usage_leases
        where user_id = '${account}' order by device_id`,
    );
    const consumed = new Map(rows.map((row) => [row.id, Number(row.consumed_hundredths)]));
    expect(consumed.get(laptopLease)).toBe(300);
    expect(consumed.get(phoneLease)).toBe(100);
  });

  it("refuses events that name one device against another device's lease", async () => {
    const laptopLease = (await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-x", 700))
      .lease_id!;
    const phoneLease = (await allocate(phone, "install-phone", PHONE_KEY, "phone-x", 700))
      .lease_id!;
    await activate(laptopLease);
    await activate(phoneLease);

    /*
     * The phone's own signed events, replayed against the laptop's lease. Both
     * leases belong to the same ACCOUNT, so an identity check that only
     * compared account ids would let this through — and one device would be
     * able to spend another's block.
     */
    await expect(
      reconcile(laptopLease, laptop, 100, 1, envelope(phoneLease, phone, 1, 100)),
    ).rejects.toThrow(/identity mismatch/i);

    const rows = await twin.asServiceRole<{ consumed_hundredths: string }>(
      `select consumed_hundredths from public.ocade_device_usage_leases where id = '${laptopLease}'`,
    );
    expect(Number(rows[0]!.consumed_hundredths)).toBe(0);
  });

  it("accepts the same events twice without counting them twice", async () => {
    const lease = (await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-replay", 700))
      .lease_id!;
    await activate(lease);
    const events = envelope(lease, laptop, 1, 250);

    await reconcile(lease, laptop, 250, 1, events);
    // A device that lost its connection mid-upload sends the same block again.
    await reconcile(lease, laptop, 250, 1, events);

    const stored = await twin.asServiceRole<{ count: string }>(
      `select count(*) from public.ocade_offline_usage_events where lease_id = '${lease}'`,
    );
    expect(Number(stored[0]!.count), "a replayed upload was stored twice").toBe(1);

    const rows = await twin.asServiceRole<{ consumed_hundredths: string }>(
      `select consumed_hundredths from public.ocade_device_usage_leases where id = '${lease}'`,
    );
    expect(Number(rows[0]!.consumed_hundredths)).toBe(250);
  });

  /*
   * REMOVING A DEVICE GIVES BACK WHAT IT NEVER SPENT — ONCE.
   *
   * `ocade_return_offline_usage` had no caller in the product at all, so a
   * block a removed device was holding stayed charged to the account until its
   * window expired: a week, on a paid tier. `closeOfflineUsageForRevokedDevice`
   * is its caller now, and these are the two things that make calling it safe.
   */
  it("returns only the part a removed device never spent", async () => {
    const lease = (await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-return", 700))
      .lease_id!;
    await activate(lease);
    await reconcile(lease, laptop, 300, 1, envelope(lease, laptop, 1, 300));
    expect(await sessionHundredths()).toBe(700);

    const returned = await twin.asServiceRole<{ ocade_return_offline_usage: string }>(
      `select public.ocade_return_offline_usage(
         '${account}'::uuid, '${laptop}'::uuid, '${lease}'::uuid)`,
    );
    // The 300 it spent stays spent; the 400 it was holding comes back.
    expect(Number(returned[0]!.ocade_return_offline_usage)).toBe(400);
    expect(await sessionHundredths()).toBe(300);
  });

  it("credits a repeated return once, however many times it is retried", async () => {
    const lease = (await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-retry", 700))
      .lease_id!;
    await activate(lease);
    expect(await sessionHundredths()).toBe(700);

    const call = async () =>
      Number(
        (
          await twin.asServiceRole<{ ocade_return_offline_usage: string }>(
            `select public.ocade_return_offline_usage(
               '${account}'::uuid, '${laptop}'::uuid, '${lease}'::uuid)`,
          )
        )[0]!.ocade_return_offline_usage,
      );

    expect(await call()).toBe(700);
    // A lost response, and the browser tries again. The account must not be
    // credited twice for one block.
    expect(await call()).toBe(0);
    expect(await sessionHundredths()).toBe(0);
  });

  it("refuses a different event claiming a sequence that is already settled", async () => {
    const lease = (await allocate(laptop, "install-laptop", LAPTOP_KEY, "laptop-fork", 700))
      .lease_id!;
    await activate(lease);
    await reconcile(lease, laptop, 250, 1, envelope(lease, laptop, 1, 250));

    // Same sequence, different event id and hash: a forked chain, which is what
    // a tampered or duplicated device would produce.
    const forked = JSON.stringify([
      {
        payload: {
          eventId: "00000000-0000-4000-8000-999999999999",
          leaseId: lease,
          accountId: account,
          deviceId: laptop,
          sequence: 1,
          generationId: "generation-fork",
          idempotencyKey: "key-fork",
          surface: "chat",
          status: "succeeded",
          costHundredths: 250,
          occurredAt: new Date().toISOString(),
          previousHash: "",
        },
        eventHash: "hash-fork",
        deviceSignature: "signature-fork",
      },
    ]).replaceAll("'", "''");

    await expect(reconcile(lease, laptop, 250, 1, forked)).rejects.toThrow(
      /already reconciled sequence/i,
    );
  });
});

it("signing retries cannot refund an active lease and unsigned cancellation is exact", async () => {
  expect(
    await twin.runScript(
      "supabase/verification",
      "20260918132426_offline_signing_retry_verify.sql",
    ),
  ).toEqual({ ok: true });
});
